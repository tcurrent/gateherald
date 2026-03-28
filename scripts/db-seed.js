import { sequelize } from '../models/index.js';
import { runMigrations, runSeeders } from '../models/db-config.js';

const run = async () => {
  try {
    await runMigrations(sequelize);
    await runSeeders(sequelize);
    console.log('Seeders complete.');
  } finally {
    await sequelize.close();
  }
};

run().catch((err) => {
  console.error('Failed to run seeders:', err);
  process.exit(1);
});
