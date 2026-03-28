import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize } from '../models/index.js';
import { runMigrations, runSeeders } from '../models/db-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqliteStoragePath = path.resolve(
  __dirname,
  '..',
  process.env.DB_STORAGE_PATH || (process.env.NODE_ENV === 'test' ? 'gateherald.test.db' : 'gateherald.db')
);
const activeDialect = sequelize.getDialect();
const isSqlite = activeDialect === 'sqlite';

const resetInPlace = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();

  const normalized = tables
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry?.tableName && entry?.schema) return { tableName: entry.tableName, schema: entry.schema };
      return entry?.tableName;
    })
    .filter((tableName) => {
      if (!tableName) return false;
      if (typeof tableName !== 'string') return true;
      return tableName !== 'sqlite_sequence';
    });

  if (isSqlite) {
    await sequelize.query('PRAGMA foreign_keys = OFF;');
  }
  try {
    for (const tableName of normalized) {
      try {
        await queryInterface.dropTable(tableName, { cascade: true });
      } catch {
        await queryInterface.dropTable(tableName);
      }
    }
  } finally {
    if (isSqlite) {
      await sequelize.query('PRAGMA foreign_keys = ON;');
    }
  }
};

const run = async () => {
  try {
    let resetInPlaceRequired = false;

    if (isSqlite) {
      try {
        await fs.unlink(sqliteStoragePath);
        console.log(`Deleted database file: ${sqliteStoragePath}`);
      } catch (err) {
        if (err.code === 'ENOENT') {
          console.log(`Database file not found, continuing: ${sqliteStoragePath}`);
        } else if (err.code === 'EBUSY' || err.code === 'EPERM') {
          console.warn(`Database file is locked, falling back to in-place reset: ${sqliteStoragePath}`);
          resetInPlaceRequired = true;
        } else {
          throw err;
        }
      }
    } else {
      console.log(`Using ${activeDialect} reset strategy: dropping all tables in-place.`);
      resetInPlaceRequired = true;
    }

    await sequelize.authenticate();
    if (resetInPlaceRequired) {
      await resetInPlace();
    }
    await runMigrations(sequelize);
    await runSeeders(sequelize);
    console.log('Database reset complete.');
  } finally {
    await sequelize.close();
  }
};

run().catch((err) => {
  console.error('Failed to reset database:', err);
  process.exit(1);
});
