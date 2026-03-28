export const up = async ({ models, transaction }) => {
  const { RouteConfig } = models;

  const path = '/webhook/sample/01J0Z8X3GWBD9117Q9H4M2KCFP';

  const existing = await RouteConfig.findOne({
    where: { path },
    transaction
  });

  if (existing) return;

  await RouteConfig.create({
    path,
    method: 'POST',
    enabled: true,
    module_options_json: JSON.stringify({
      templateName: 'sample.base',
      fieldMap: {
        alertTitle: 'name',
        alertTriggered: 'timestamp',
        alertSource: 'name',
        alertHost: 'host',
        alertSummary: 'description'
      }
    }),
    headers_json: JSON.stringify([
      { name: 'X-API-KEY', value: 'process.env.API_TOKEN' }
    ]),
    targets_json: JSON.stringify([
      { url: 'https://localhost:3000/api' }
    ])
  }, { transaction });
};

export const down = async ({ models, transaction }) => {
  const { RouteConfig } = models;
  await RouteConfig.destroy({
    where: { path: '/webhook/sample/01J0Z8X3GWBD9117Q9H4M2KCFP' },
    transaction
  });
};
