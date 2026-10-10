require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');
const A = 'WiFi,Parking,Breakfast,Pool,Gym,AC,Restaurant'.split(',');
const H = [
 ['Serena Hotel','Islamabad','Luxury',220,4.8,'https://www.serenahotels.com',[0,1,2,3,4,5,6],1],
 ['Pearl-Continental','Lahore','Luxury',190,4.7,'https://www.pchotels.com',[0,1,2,3,4,5,6],1],
 ['Marriott Hotel','Karachi','Luxury',180,4.6,'https://www.marriott.com',[0,1,2,3,4,5,6],1],
 ['Avari Towers','Karachi','Luxury',150,4.5,'https://www.avari.com',[0,1,2,3,5,6],0],
 ['Hilton Garden Inn','Lahore','Mid-range',95,4.3,'https://www.hilton.com',[0,1,2,4,5],1],
 ['Ramada by Wyndham','Islamabad','Mid-range',85,4.2,'https://www.wyndham.com',[0,1,2,5,6],0],
 ['Best Western Plus','Lahore','Mid-range',75,4.1,'https://www.bestwestern.com',[0,1,2,5],0],
 ['Holiday Inn','Karachi','Mid-range',90,4.2,'https://www.ihg.com',[0,1,2,4,5,6],0],
 ['Radisson Blu','Islamabad','Mid-range',110,4.4,'https://www.radissonhotels.com',[0,1,2,3,4,5],1],
 ['ibis Styles','Karachi','Budget',45,3.9,'https://www.accor.com',[0,2,5],0],
 ['Hotel One','Lahore','Budget',40,3.8,'https://www.hotelone.com.pk',[0,1,2,5],0],
 ['Murree Hills Guest House','Murree','Guest House',30,4.0,'https://example.com',[0,1,2],0],
 ['Lakeview Guest House','Skardu','Guest House',35,4.2,'https://example.com',[0,1,2,5],1],
 ['Lakeside Resort','Skardu','Resort',160,4.6,'https://example.com',[0,1,2,3,6],1],
 ['Valley Retreat Resort','Hunza','Resort',140,4.5,'https://example.com',[0,1,2,3,4,6],0]
];
db.exec('DELETE FROM hotels; DELETE FROM clicks;');
const ins = db.prepare(`INSERT INTO hotels(name,city,address,price,rating,type,amenities,image,description,phone,email,website,featured)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
H.forEach(([n,c,t,p,r,w,a,f],i) => ins.run(n,c,`Main Road, ${c}`,p,r,t,a.map(x=>A[x]).join(','),
  `https://picsum.photos/seed/hotel${i+1}/800/500`,
  `${n} in ${c} is a ${t.toLowerCase()} stay offering comfortable rooms, friendly service and easy access to local attractions. Ideal for tourists and families.`,
  `+92 300 000${String(1000+i).slice(1)}`, `info@hotel${i+1}.example`, w, f));
const u = process.env.ADMIN_USER || 'admin', pw = process.env.ADMIN_PASS || 'admin123';
db.prepare('DELETE FROM admins').run();
db.prepare('INSERT INTO admins(username,password) VALUES(?,?)').run(u, bcrypt.hashSync(pw, 10));
console.log(`Seeded ${H.length} hotels. Admin login: ${u} / ${pw}`);
