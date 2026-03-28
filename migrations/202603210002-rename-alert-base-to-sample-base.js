export const up = async ({ models, transaction }) => {
  const { Template, RouteConfig } = models;

  const alertTemplate = await Template.findOne({
    where: { name: 'alert.base' },
    transaction
  });

  const sampleTemplate = await Template.findOne({
    where: { name: 'sample.base' },
    transaction
  });

  if (alertTemplate && !sampleTemplate) {
    await alertTemplate.update({ name: 'sample.base' }, { transaction });
  }

  const routes = await RouteConfig.findAll({ transaction });
  for (const route of routes) {
    let changed = false;
    let moduleOptions;

    try {
      moduleOptions = JSON.parse(route.module_options_json || '{}');
    } catch {
      continue;
    }

    if (moduleOptions.templateName === 'alert.base') {
      moduleOptions.templateName = 'sample.base';
      changed = true;
    }

    if (changed) {
      await route.update({
        module_options_json: JSON.stringify(moduleOptions)
      }, { transaction });
    }
  }
};

export const down = async ({ models, transaction }) => {
  const { Template, RouteConfig } = models;

  const sampleTemplate = await Template.findOne({
    where: { name: 'sample.base' },
    transaction
  });

  const alertTemplate = await Template.findOne({
    where: { name: 'alert.base' },
    transaction
  });

  if (sampleTemplate && !alertTemplate) {
    await sampleTemplate.update({ name: 'alert.base' }, { transaction });
  }

  const routes = await RouteConfig.findAll({ transaction });
  for (const route of routes) {
    let changed = false;
    let moduleOptions;

    try {
      moduleOptions = JSON.parse(route.module_options_json || '{}');
    } catch {
      continue;
    }

    if (moduleOptions.templateName === 'sample.base') {
      moduleOptions.templateName = 'alert.base';
      changed = true;
    }

    if (changed) {
      await route.update({
        module_options_json: JSON.stringify(moduleOptions)
      }, { transaction });
    }
  }
};
