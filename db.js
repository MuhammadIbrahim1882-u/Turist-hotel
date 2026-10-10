const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'data.db'));
db.exec(`
CREATE TABLE IF NOT EXISTS hotels(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, city TEXT NOT NULL, address TEXT,
  price REAL NOT NULL, rating REAL DEFAULT 0, type TEXT NOT NULL, amenities TEXT DEFAULT '',
  image TEXT, description TEXT, phone TEXT, email TEXT, website TEXT NOT NULL, featured INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS clicks(id INTEGER PRIMARY KEY AUTOINCREMENT, hotel_id INTEGER, at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT);
`);
module.exports = db;
