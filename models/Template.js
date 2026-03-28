import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const Template = sequelize.define('Template', {
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
  }, {
    tableName: 'templates',
    timestamps: false
  });

  return Template;
}
