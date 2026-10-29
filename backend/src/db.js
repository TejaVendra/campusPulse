import 'dotenv/config';
import { Connection } from 'monetdb';

const options = {
  host: process.env.MONETDB_HOST || '127.0.0.1',
  port: Number(process.env.MONETDB_PORT || 50000),
  database: process.env.MONETDB_DATABASE || 'demo',
  username: process.env.MONETDB_USER || 'monetdb',
  password: process.env.MONETDB_PASSWORD || 'monetdb',
  autoCommit: true
};

export async function query(sql) {
  const connection = new Connection(options);
  await connection.connect();
  try {
    const result = await connection.execute(sql);
    return result.data ?? [];
  } finally {
    await connection.close();
  }
}

export function sqlString(value) {
  return String(value).replaceAll("'", "''");
}
