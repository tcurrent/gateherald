import { sequelize } from '../models/index.js';
import { runMigrations } from '../models/db-config.js';

const run = async () => {
  try {
    await runMigrations(sequelize);
    console.log('Migrations complete.');
  } finally {
    await sequelize.close();
  }
};

run().catch((err) => {
  console.error('Failed to run migrations:', err);
  process.exit(1);
});
