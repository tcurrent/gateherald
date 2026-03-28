import { DataTypes } from 'sequelize';

const tableExists = async (queryInterface, tableName, transaction) => {
  const tables = await queryInterface.showAllTables({ transaction });
  const normalized = tables.map((entry) => (typeof entry === 'string' ? entry : entry.tableName));
  return normalized.includes(tableName);
};

export const up = async ({ queryInterface, transaction }) => {
  if (!await tableExists(queryInterface, 'ingress', transaction)) {
    await queryInterface.createTable('ingress', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      method: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      url: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      headers: {
        type: DataTypes.TEXT
      },
      query_params: {
        type: DataTypes.TEXT
      },
      body: {
        type: DataTypes.TEXT
      }
    }, { transaction });
  }

  if (!await tableExists(queryInterface, 'egress', transaction)) {
    await queryInterface.createTable('egress', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      request_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'ingress',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      target_url: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      status: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      response_status: {
        type: DataTypes.INTEGER
      },
      timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      error_message: {
        type: DataTypes.TEXT
      }
    }, { transaction });
  }

  if (!await tableExists(queryInterface, 'templates', transaction)) {
    await queryInterface.createTable('templates', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true
      },
      needs_documentation_rules: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      documentation_target_field: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      fields_json: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    }, { transaction });
  }

  if (!await tableExists(queryInterface, 'route_configs', transaction)) {
    await queryInterface.createTable('route_configs', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      path: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true
      },
      method: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'POST'
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      module_options_json: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      headers_json: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      targets_json: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    }, { transaction });
  }
};

export const down = async ({ queryInterface, transaction }) => {
  if (await tableExists(queryInterface, 'route_configs', transaction)) {
    await queryInterface.dropTable('route_configs', { transaction });
  }
  if (await tableExists(queryInterface, 'templates', transaction)) {
    await queryInterface.dropTable('templates', { transaction });
  }
  if (await tableExists(queryInterface, 'egress', transaction)) {
    await queryInterface.dropTable('egress', { transaction });
  }
  if (await tableExists(queryInterface, 'ingress', transaction)) {
    await queryInterface.dropTable('ingress', { transaction });
  }
};
