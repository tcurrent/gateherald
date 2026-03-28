import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const RouteConfig = sequelize.define('RouteConfig', {
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
  }, {
    tableName: 'route_configs',
    timestamps: false
  });

  return RouteConfig;
}
