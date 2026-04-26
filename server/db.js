import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DATA_DIR = path.resolve('data');
const DB_PATH = process.env.ALICE_DB_PATH || path.join(DATA_DIR, 'alice.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

export function initSchema(targetDb = db) {
  targetDb.exec('');
}
