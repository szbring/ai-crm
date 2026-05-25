import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'crm.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDb(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      industry TEXT,
      size TEXT,
      region TEXT,
      website TEXT,
      status TEXT DEFAULT '线索',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      doc_path TEXT
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      stage TEXT DEFAULT 'S1',
      customer_id INTEGER REFERENCES customers(id),
      amount REAL,
      close_date TEXT,
      next_action TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      doc_path TEXT
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      title TEXT,
      phone TEXT,
      email TEXT,
      role TEXT,
      customer_id INTEGER REFERENCES customers(id),
      opportunity_id INTEGER REFERENCES opportunities(id)
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      opportunity_id INTEGER REFERENCES opportunities(id),
      customer_id INTEGER REFERENCES customers(id),
      summary TEXT,
      doc_path TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);
}
