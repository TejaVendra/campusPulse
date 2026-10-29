import { query } from './db.js';

const rows = [
  [1,'Library','2026-10-28 09:00:00',8.2],[2,'Academic Block','2026-10-28 09:00:00',15.4],[3,'Hostel','2026-10-28 09:00:00',10.1],
  [4,'Library','2026-10-28 10:00:00',8.7],[5,'Academic Block','2026-10-28 10:00:00',16.1],[6,'Hostel','2026-10-28 10:00:00',11.4],
  [7,'Library','2026-10-28 11:00:00',9.0],[8,'Academic Block','2026-10-28 11:00:00',35.0],[9,'Hostel','2026-10-28 11:00:00',12.0],
  [10,'Library','2026-10-28 12:00:00',7.9],[11,'Academic Block','2026-10-28 12:00:00',17.2],[12,'Hostel','2026-10-28 12:00:00',11.8],
  [13,'Library','2026-10-29 00:00:00',2.1],[14,'Academic Block','2026-10-29 00:00:00',20.0],[15,'Hostel','2026-10-29 00:00:00',14.5],
  [16,'Library','2026-10-29 13:00:00',8.8],[17,'Academic Block','2026-10-29 13:00:00',18.3],[18,'Hostel','2026-10-29 13:00:00',12.7],
  [19,'Library','2026-10-29 14:00:00',9.4],[20,'Academic Block','2026-10-29 14:00:00',19.1],[21,'Hostel','2026-10-29 14:00:00',13.0],
  [22,'Library','2026-10-29 15:00:00',8.9],[23,'Academic Block','2026-10-29 15:00:00',18.7],[24,'Hostel','2026-10-29 15:00:00',12.4],
  [25,'Library','2026-10-29 16:00:00',8.0],[26,'Academic Block','2026-10-29 16:00:00',17.9],[27,'Hostel','2026-10-29 16:00:00',12.2],
  [28,'Library','2026-10-29 17:00:00',7.5],[29,'Academic Block','2026-10-29 17:00:00',16.4],[30,'Hostel','2026-10-29 17:00:00',11.9]
];

try {
  try { await query('DROP TABLE energy_readings'); } catch {}
  await query(`CREATE TABLE energy_readings (
    reading_id INT NOT NULL,
    building_name VARCHAR(80) NOT NULL,
    recorded_at TIMESTAMP NOT NULL,
    energy_kwh DOUBLE NOT NULL,
    data_source VARCHAR(20) NOT NULL
  )`);
  for (const [id,building,at,kwh] of rows) {
    const safeBuilding = String(building).replaceAll("'","''");
    await query(`INSERT INTO energy_readings VALUES (${id}, '${safeBuilding}', TIMESTAMP '${at}', ${kwh}, 'simulated')`);
  }
  console.log(`CampusPulse demo table created with ${rows.length} simulated readings.`);
} catch (error) {
  console.error('Seeding failed:', error.message);
  console.error('Check MonetDB is running and backend/.env matches your database credentials.');
  process.exitCode = 1;
}
