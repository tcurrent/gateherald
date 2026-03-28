export const up = async ({ models, transaction }) => {
  const { Template } = models;

  const existing = await Template.findOne({
    where: { name: 'sample.base' },
    transaction
  });

  if (existing) return;

  await Template.create({
    name: 'sample.base',
    needs_documentation_rules: true,
    documentation_target_field: 'alertDocumentation',
    fields_json: JSON.stringify({
      alertTitle: '',
      alertDepartmentNameDropdown: '',
      technicianObjectID: '0',
      alertTriggered: '',
      alertSource: '',
      alertDocumentation: '',
      alertHost: '',
      alertStatusDropdown: 'Pending',
      alertResponseDropdown: 'Open',
      alertType: '',
      alertSummary: '',
      alertModifiedBy: '0'
    })
  }, { transaction });
};

export const down = async ({ models, transaction }) => {
  const { Template } = models;
  await Template.destroy({ where: { name: 'sample.base' }, transaction });
};
