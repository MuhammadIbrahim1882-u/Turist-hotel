require('dotenv').config();
const express = require('express'), cors = require('cors'), jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs'), path = require('path');
const db = require('./db');
const app = express(), SECRET = process.env.JWT_SECRET || 'dev-secret';
app.use(cors(), express.json(), express.static(path.join(__dirname, 'public')));

const auth = (req, res, next) => {
  try { req.admin = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); next(); }
  catch { res.status(401).json({ error: 'Unauthorized' }); }
};
const fmt = h => h && ({ ...h, featured: !!h.featured, amenities: (h.amenities || '').split(',').map(s => s.trim()).filter(Boolean) });
const TYPES = ['Budget', 'Mid-range', 'Luxury', 'Guest House', 'Resort'];

function clean(b) {
  const s = k => String(b[k] ?? '').trim();
  const h = { name: s('name'), city: s('city'), address: s('address'), price: Number(b.price), rating: Number(b.rating) || 0,
    type: s('type'), amenities: Array.isArray(b.amenities) ? b.amenities.join(',') : s('amenities'), image: s('image'),
    description: s('description'), phone: s('phone'), email: s('email'), website: s('website'), featured: b.featured ? 1 : 0 };
  const err = [];
  if (!h.name) err.push('Name is required');
  if (!h.city) err.push('City is required');
  if (!(h.price >= 0) || isNaN(h.price)) err.push('Valid price is required');
  if (h.rating < 0 || h.rating > 5) err.push('Rating must be 0-5');
  if (!TYPES.includes(h.type)) err.push('Invalid type');
  if (!/^https?:\/\//i.test(h.website)) err.push('Website must start with http:// or https://');
  return { h, err };
}

app.get('/api/meta', (req, res) => res.json({
  cities: db.prepare('SELECT DISTINCT city FROM hotels ORDER BY city').all().map(r => r.city), types: TYPES }));

app.get('/api/hotels/featured', (req, res) =>
  res.json(db.prepare('SELECT * FROM hotels WHERE featured=1 ORDER BY rating DESC LIMIT 6').all().map(fmt)));

app.get('/api/hotels', (req, res) => {
  const q = req.query, w = [], p = [];
  if (q.search) { w.push('(name LIKE ? OR city LIKE ? OR address LIKE ?)'); const s = `%${q.search}%`; p.push(s, s, s); }
  if (q.city) { w.push('city=?'); p.push(q.city); }
  if (q.type) { w.push('type=?'); p.push(q.type); }
  if (q.minPrice) { w.push('price>=?'); p.push(+q.minPrice); }
  if (q.maxPrice) { w.push('price<=?'); p.push(+q.maxPrice); }
  if (q.rating) { w.push('rating>=?'); p.push(+q.rating); }
  [].concat(q.amenity || []).forEach(a => { w.push('amenities LIKE ?'); p.push(`%${a}%`); });
  const sorts = { price_asc: 'price ASC', price_desc: 'price DESC', rating: 'rating DESC', name: 'name ASC' };
  const page = Math.max(1, +q.page || 1), limit = Math.min(24, +q.limit || 9);
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) c FROM hotels ${where}`).get(...p).c;
  const rows = db.prepare(`SELECT * FROM hotels ${where} ORDER BY ${sorts[q.sort] || 'featured DESC, rating DESC'} LIMIT ? OFFSET ?`)
    .all(...p, limit, (page - 1) * limit);
  res.json({ hotels: rows.map(fmt), total, page, pages: Math.ceil(total / limit) });
});

app.get('/api/hotels/:id', (req, res) => {
  const h = db.prepare('SELECT * FROM hotels WHERE id=?').get(req.params.id);
  h ? res.json(fmt(h)) : res.status(404).json({ error: 'Hotel not found' });
});

const COLS = 'name,city,address,price,rating,type,amenities,image,description,phone,email,website,featured'.split(',');
app.post('/api/hotels', auth, (req, res) => {
  const { h, err } = clean(req.body);
  if (err.length) return res.status(400).json({ error: err.join(', ') });
  const r = db.prepare(`INSERT INTO hotels(${COLS}) VALUES(${COLS.map(() => '?')})`).run(...COLS.map(c => h[c]));
  res.status(201).json(fmt(db.prepare('SELECT * FROM hotels WHERE id=?').get(r.lastInsertRowid)));
});
app.put('/api/hotels/:id', auth, (req, res) => {
  const { h, err } = clean(req.body);
  if (err.length) return res.status(400).json({ error: err.join(', ') });
  const r = db.prepare(`UPDATE hotels SET ${COLS.map(c => c + '=?')} WHERE id=?`).run(...COLS.map(c => h[c]), req.params.id);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Hotel not found' });
});
app.delete('/api/hotels/:id', auth, (req, res) => {
  db.prepare('DELETE FROM clicks WHERE hotel_id=?').run(req.params.id);
  const r = db.prepare('DELETE FROM hotels WHERE id=?').run(req.params.id);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Hotel not found' });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const a = db.prepare('SELECT * FROM admins WHERE username=?').get(String(username || ''));
  if (!a || !bcrypt.compareSync(String(password || ''), a.password)) return res.status(401).json({ error: 'Invalid username or password' });
  res.json({ token: jwt.sign({ id: a.id, username: a.username }, SECRET, { expiresIn: '8h' }) });
});
app.get('/api/admin/stats', auth, (req, res) => res.json({
  totalHotels: db.prepare('SELECT COUNT(*) c FROM hotels').get().c,
  totalClicks: db.prepare('SELECT COUNT(*) c FROM clicks').get().c,
  top: db.prepare(`SELECT h.id,h.name,h.city,COUNT(c.id) clicks FROM hotels h LEFT JOIN clicks c ON c.hotel_id=h.id
        GROUP BY h.id ORDER BY clicks DESC LIMIT 5`).all() }));

// Tourist clicks "Visit Website": log the click, then redirect to the hotel's own site
app.get('/go/:id', (req, res) => {
  const h = db.prepare('SELECT id,website FROM hotels WHERE id=?').get(req.params.id);
  if (!h || !/^https?:\/\//i.test(h.website)) return res.status(404).send('Hotel not found');
  db.prepare('INSERT INTO clicks(hotel_id) VALUES(?)').run(h.id);
  res.redirect(h.website);
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((e, req, res, next) => res.status(500).json({ error: 'Server error' }));
app.listen(process.env.PORT || 3000, () => console.log(`Running on http://localhost:${process.env.PORT || 3000}`));
