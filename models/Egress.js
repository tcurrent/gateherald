import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const Egress = sequelize.define('Egress', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    request_id: {
      type: DataTypes.INTEGER,
      allowNull: false
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
  }, {
    tableName: 'egress',
    timestamps: false
  });

  return Egress;
}
