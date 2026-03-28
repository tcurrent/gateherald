import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { DataTypes, QueryTypes, Sequelize as SequelizeLib } from 'sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'migrations');
const seedersDir = path.join(rootDir, 'seeders');
const scriptRunsTableName = 'gateherald_script_runs';

const listScriptFiles = async (dirPath) => {
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => entry.name)
    .sort();
};

const loadScriptModule = async (dirPath, fileName) => {
  const filePath = path.join(dirPath, fileName);
  const scriptUrl = pathToFileURL(filePath).href;
  const moduleExport = await import(scriptUrl);
  return moduleExport.default || moduleExport;
};

const listTableNames = async (queryInterface, transaction) => {
  const tables = await queryInterface.showAllTables({ transaction });
  return tables.map((entry) => (typeof entry === 'string' ? entry : entry.tableName));
};

const ensureScriptRunsTable = async (sequelize) => {
  const queryInterface = sequelize.getQueryInterface();
  const tableNames = await listTableNames(queryInterface);
  if (tableNames.includes(scriptRunsTableName)) {
    return;
  }

  await queryInterface.createTable(scriptRunsTableName, {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    label: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    file_name: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    applied_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  });
};

const getAppliedScriptNames = async (sequelize, label) => {
  const rows = await sequelize.query(
    `SELECT file_name FROM ${scriptRunsTableName} WHERE label = :label`,
    {
      replacements: { label },
      type: QueryTypes.SELECT
    }
  );

  return new Set(rows.map((row) => row.file_name));
};

const recordAppliedScript = async (queryInterface, { label, fileName, transaction }) => {
  await queryInterface.bulkInsert(
    scriptRunsTableName,
    [{
      label,
      file_name: fileName,
      applied_at: new Date()
    }],
    { transaction }
  );
};

const runScripts = async ({ sequelize, dirPath, label }) => {
  await ensureScriptRunsTable(sequelize);

  const files = await listScriptFiles(dirPath);
  const queryInterface = sequelize.getQueryInterface();
  const appliedScriptNames = await getAppliedScriptNames(sequelize, label);

  for (const fileName of files) {
    if (appliedScriptNames.has(fileName)) {
      console.log(`Skipping ${label}: ${fileName}`);
      continue;
    }

    const script = await loadScriptModule(dirPath, fileName);
    if (!script || typeof script.up !== 'function') {
      throw new Error(`${label} '${fileName}' must export an up function`);
    }

    const transaction = await sequelize.transaction();
    try {
      await script.up({
        sequelize,
        queryInterface,
        Sequelize: SequelizeLib,
        transaction,
        models: sequelize.models
      });
      await transaction.commit();
      await recordAppliedScript(queryInterface, { label, fileName });
      appliedScriptNames.add(fileName);
      console.log(`Ran ${label}: ${fileName}`);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};

export const runMigrations = async (sequelize) => {
  await runScripts({
    sequelize,
    dirPath: migrationsDir,
    label: 'migration'
  });
};

export const runSeeders = async (sequelize) => {
  await runScripts({
    sequelize,
    dirPath: seedersDir,
    label: 'seeder'
  });
};
