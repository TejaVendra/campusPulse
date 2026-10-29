import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { query, sqlString } from './db.js';

const app = express();
const PORT = Number(process.env.PORT || 5000);
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5174').split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) {
  if (!origin || origins.includes('*') || origins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin not allowed by CORS'));
}}));
app.use(express.json({ limit: '100kb' }));

function rowsToObjects(rows, keys) {
  return rows.map(row => Object.fromEntries(keys.map((key, index) => [key, row[index]])));
}
function asNumber(value) { return Number(value ?? 0); }
function safeError(res, error, fallback = 'Database query failed') {
  console.error(fallback, error);
  return res.status(500).json({ message: fallback, detail: process.env.NODE_ENV === 'production' ? undefined : error.message });
}

app.get('/api/health', async (_req, res) => {
  try { const rows = await query('SELECT 1'); res.json({ ok:true, database:'MonetDB', result:rows[0]?.[0] ?? 1 }); }
  catch (error) { res.status(503).json({ ok:false, message:'Cannot connect to MonetDB. Check the server and backend/.env.', detail:process.env.NODE_ENV === 'production' ? undefined : error.message }); }
});

app.get('/api/summary', async (_req, res) => {
  try {
    const rows = await query('SELECT COUNT(*), COALESCE(SUM(energy_kwh), 0), COALESCE(AVG(energy_kwh), 0), COUNT(DISTINCT building_name) FROM energy_readings');
    const r = rows[0] || [0,0,0,0];
    res.json({ readings:asNumber(r[0]), totalKwh:asNumber(r[1]), averageKwh:asNumber(r[2]), buildings:asNumber(r[3]), dataSource:'simulated' });
  } catch (error) { safeError(res,error,'Could not load summary. Ensure energy_readings exists; run npm run seed for a fresh demo.'); }
});

app.get('/api/buildings', async (_req, res) => {
  try {
    const rows = await query('SELECT building_name, SUM(energy_kwh), AVG(energy_kwh), COUNT(*) FROM energy_readings GROUP BY building_name ORDER BY SUM(energy_kwh) DESC');
    res.json(rowsToObjects(rows,['building','totalKwh','averageKwh','readings']).map(x=>({...x,totalKwh:asNumber(x.totalKwh),averageKwh:asNumber(x.averageKwh),readings:asNumber(x.readings)})));
  } catch (error) { safeError(res,error,'Could not load building summaries.'); }
});

app.get('/api/readings', async (req, res) => {
  try {
    const clauses = [];
    if (req.query.building) clauses.push(`building_name = '${sqlString(req.query.building)}'`);
    if (req.query.source) clauses.push(`data_source = '${sqlString(req.query.source)}'`);
    if (req.query.search) {
      const term = sqlString(String(req.query.search).slice(0,80));
      clauses.push(`(building_name LIKE '%${term}%' OR data_source LIKE '%${term}%')`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rawLimit = Number.parseInt(req.query.limit || '1000',10);
    const limit = Number.isFinite(rawLimit) ? Math.min(5000,Math.max(1,rawLimit)) : 1000;
    const rows = await query(`SELECT reading_id, building_name, CAST(recorded_at AS VARCHAR(30)), energy_kwh, data_source FROM energy_readings ${where} ORDER BY recorded_at DESC LIMIT ${limit}`);
    res.json(rowsToObjects(rows,['id','building','recordedAt','energyKwh','source']).map(x=>({...x,id:asNumber(x.id),energyKwh:asNumber(x.energyKwh)})));
  } catch (error) { safeError(res,error,'Could not load readings.'); }
});

app.get('/api/hourly', async (_req, res) => {
  try {
    const rows = await query('SELECT EXTRACT(HOUR FROM recorded_at), AVG(energy_kwh) FROM energy_readings GROUP BY EXTRACT(HOUR FROM recorded_at) ORDER BY EXTRACT(HOUR FROM recorded_at)');
    res.json(rowsToObjects(rows,['hour','averageKwh']).map(x=>({hour:asNumber(x.hour),label:`${String(asNumber(x.hour)).padStart(2,'0')}:00`,averageKwh:asNumber(x.averageKwh)})));
  } catch (error) { safeError(res,error,'Could not load hourly analytics.'); }
});

app.get('/api/alerts', async (_req, res) => {
  try {
    const rows = await query(`SELECT e.building_name, CAST(e.recorded_at AS VARCHAR(30)), e.energy_kwh, a.avg_kwh FROM energy_readings e JOIN (SELECT building_name, AVG(energy_kwh) AS avg_kwh FROM energy_readings GROUP BY building_name) a ON e.building_name = a.building_name WHERE e.energy_kwh > a.avg_kwh * 1.7 ORDER BY e.energy_kwh DESC`);
    res.json(rowsToObjects(rows,['building','recordedAt','energyKwh','buildingAverage']).map(x=>({...x,energyKwh:asNumber(x.energyKwh),buildingAverage:asNumber(x.buildingAverage),severity:'Review'})));
  } catch (error) { safeError(res,error,'Could not calculate anomaly alerts.'); }
});

app.post('/api/readings', async (req, res) => {
  const { building, recordedAt, energyKwh } = req.body || {};
  const allowed = ['Library','Academic Block','Hostel'];
  const value = Number(energyKwh);
  if (!allowed.includes(building) || typeof recordedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(recordedAt) || !Number.isFinite(value) || value < 0 || value > 1000000) {
    return res.status(400).json({ message:'Provide a valid building, date/time, and energy value between 0 and 1,000,000 kWh.' });
  }
  try {
    const idRows = await query('SELECT COALESCE(MAX(reading_id), 0) + 1 FROM energy_readings');
    const id = asNumber(idRows[0]?.[0] ?? 1);
    const safeBuilding = sqlString(building);
    const safeDate = sqlString(recordedAt.replace('T',' ') + ':00');
    await query(`INSERT INTO energy_readings VALUES (${id}, '${safeBuilding}', TIMESTAMP '${safeDate}', ${value}, 'manual')`);
    res.status(201).json({ message:'Reading added', id });
  } catch (error) { safeError(res,error,'Could not save reading.'); }
});

app.delete('/api/readings/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id,10);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({message:'Invalid reading ID.'});
  try {
    const rows = await query(`SELECT data_source FROM energy_readings WHERE reading_id = ${id}`);
    if (!rows.length) return res.status(404).json({message:'Reading not found.'});
    if (String(rows[0][0]).toLowerCase() !== 'manual') return res.status(403).json({message:'Only manual readings can be deleted from the app.'});
    await query(`DELETE FROM energy_readings WHERE reading_id = ${id}`);
    res.json({message:'Manual reading deleted',id});
  } catch (error) { safeError(res,error,'Could not delete reading.'); }
});

app.use((err,_req,res,_next) => {
  console.error(err);
  if (err.message === 'Origin not allowed by CORS') return res.status(403).json({message:'This frontend origin is not allowed by backend CORS_ORIGINS.'});
  res.status(500).json({message:'Unexpected API error.'});
});
app.listen(PORT, () => console.log(`CampusPulse API listening on port ${PORT}`));
