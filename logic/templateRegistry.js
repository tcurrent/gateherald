let templates = {};

const resolveTemplateEntry = (templateName, fallbackName) => {
  return templates[templateName] || templates[fallbackName] || null;
};

export const replaceTemplateRegistry = (entries = []) => {
  const nextTemplates = {};
  entries.forEach((entry) => {
    if (!entry || !entry.name || !entry.fields || typeof entry.fields !== 'object') return;
    nextTemplates[entry.name] = {
      fields: { ...entry.fields },
      needsDocumentationRules: entry.needsDocumentationRules === true,
      documentationTargetField: entry.documentationTargetField || null
    };
  });

  templates = nextTemplates;
};

export const listTemplates = () => Object.keys(templates);

export const resolveTemplate = (templateName, fallbackName = 'sample.base') => {
  const selected = resolveTemplateEntry(templateName, fallbackName);
  if (!selected) return {};
  return { ...selected.fields };
};

export const getTemplateFieldSet = (templateName, fallbackName = 'sample.base') => {
  const templateEntry = resolveTemplateEntry(templateName, fallbackName);
  if (!templateEntry) return new Set();
  const template = templateEntry.fields;
  return new Set(Object.keys(template));
};

export const getTemplateEditableFieldSet = (templateName, fallbackName = 'sample.base') => {
  const templateEntry = resolveTemplateEntry(templateName, fallbackName);
  if (!templateEntry) return new Set();
  const template = templateEntry.fields;
  const editableFields = Object.entries(template)
    .filter(([, defaultValue]) => defaultValue === '' || defaultValue === null)
    .map(([fieldName]) => fieldName);

  return new Set(editableFields);
};

export const getTemplateDocumentationTargetField = (templateName, fallbackName = 'sample.base') => {
  const templateEntry = resolveTemplateEntry(templateName, fallbackName);
  if (!templateEntry) return null;
  return templateEntry.documentationTargetField || null;
};

export const getTemplateCatalog = () => {
  return Object.entries(templates).map(([name, entry]) => {
    const fields = entry.fields;
    return {
      name,
      fields: Object.keys(fields),
      editableFields: Object.entries(fields)
        .filter(([, defaultValue]) => defaultValue === '' || defaultValue === null)
        .map(([fieldName]) => fieldName),
      defaults: { ...fields },
      needsDocumentationRules: entry.needsDocumentationRules,
      documentationTargetField: entry.documentationTargetField || null
    };
  });
};
