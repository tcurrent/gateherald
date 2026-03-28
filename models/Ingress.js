import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const Ingress = sequelize.define('Ingress', {
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
  }, {
    tableName: 'ingress',
    timestamps: false
  });

  return Ingress;
}
