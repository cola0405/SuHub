import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'fs'
import { join } from 'path'

let db: Database.Database

export function initDb(): void {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  db = new Database(join(dir, 'sucai.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate()
}

function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE COLLATE NOCASE,
      filename TEXT NOT NULL,
      ext TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('video','image','audio')),
      size INTEGER NOT NULL DEFAULT 0,
      duration REAL,
      width INTEGER,
      height INTEGER,
      thumb TEXT,
      missing INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
    CREATE INDEX IF NOT EXISTS idx_assets_missing ON assets(missing);

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS asset_tags (
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      UNIQUE (asset_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_asset_tags_tag ON asset_tags(tag_id);

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS asset_folders (
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      UNIQUE (asset_id, folder_id)
    );
    CREATE INDEX IF NOT EXISTS idx_asset_folders_folder ON asset_folders(folder_id);
  `)
}

export function getDb(): Database.Database {
  return db
}

export function thumbsDir(): string {
  const dir = join(app.getPath('userData'), 'thumbs')
  mkdirSync(dir, { recursive: true })
  return dir
}
