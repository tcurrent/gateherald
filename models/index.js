import { Sequelize } from 'sequelize';
import IngressModel from './Ingress.js';
import EgressModel from './Egress.js';
import TemplateModel from './Template.js';
import RouteConfigModel from './RouteConfig.js';

const truthyValues = new Set(['1', 'true', 'yes', 'on']);

const toBool = (value, defaultValue = false) => {
  if (value == null || value === '') return defaultValue;
  return truthyValues.has(String(value).trim().toLowerCase());
};

const normalizeDialect = (value) => (value || '').trim().toLowerCase();

const supportedDialects = new Set(['sqlite', 'postgres', 'mysql', 'mariadb', 'mssql']);

const throwDbConfigError = (message) => {
  throw new Error(`Invalid database configuration: ${message}`);
};

const validateDbConfig = (dbDialect) => {
  if (!dbDialect) return;

  if (!supportedDialects.has(dbDialect)) {
    throwDbConfigError(
      `DB_DIALECT '${dbDialect}' is not supported. Use one of: ${Array.from(supportedDialects).join(', ')}`
    );
  }

  if (dbDialect === 'sqlite') return;

  if (process.env.DATABASE_URL) return;

  const requiredVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missingVars = requiredVars.filter((envKey) => {
    const value = process.env[envKey];
    return value == null || String(value).trim() === '';
  });

  if (missingVars.length > 0) {
    throwDbConfigError(
      `DB_DIALECT is '${dbDialect}' but required variables are missing: ${missingVars.join(', ')}. ` +
      'Set those variables or provide DATABASE_URL.'
    );
  }
};

const buildSslOptions = () => {
  if (!toBool(process.env.DB_SSL)) return undefined;
  return {
    ssl: {
      require: true,
      rejectUnauthorized: toBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, false)
    }
  };
};

const buildSqliteStoragePath = () => {
  if (process.env.DB_STORAGE_PATH) return process.env.DB_STORAGE_PATH;
  return process.env.NODE_ENV === 'test' ? 'gateherald.test.db' : 'gateherald.db';
};

const buildSequelize = () => {
  const dbDialect = normalizeDialect(process.env.DB_DIALECT);
  const sslOptions = buildSslOptions();

  validateDbConfig(dbDialect);

  if (process.env.DATABASE_URL) {
    return new Sequelize(process.env.DATABASE_URL, {
      dialect: dbDialect || 'postgres',
      logging: false,
      dialectOptions: sslOptions
    });
  }

  if (dbDialect && dbDialect !== 'sqlite') {
    return new Sequelize({
      dialect: dbDialect,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || (dbDialect === 'mysql' || dbDialect === 'mariadb' ? 3306 : 5432)),
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      logging: false,
      dialectOptions: sslOptions
    });
  }

  return new Sequelize({
    dialect: 'sqlite',
    storage: buildSqliteStoragePath(),
    logging: false
  });
};

const sequelize = buildSequelize();

const Ingress = IngressModel(sequelize);
const Egress = EgressModel(sequelize);
const Template = TemplateModel(sequelize);
const RouteConfig = RouteConfigModel(sequelize);

Ingress.hasMany(Egress, {
  foreignKey: 'request_id'
});
Egress.belongsTo(Ingress, { 
  foreignKey: 'request_id'
});

export { sequelize, Ingress, Egress, Template, RouteConfig };
