import {
  resolveTemplate,
  getTemplateFieldSet,
  getTemplateEditableFieldSet,
  getTemplateDocumentationTargetField
} from './templates/index.js';
import {
  buildFromTemplate,
  mapFields,
  filterFieldMapByAllowedTargets
} from './shared/templateMapper.js';

const moduleName = 'TemplateDriver';

const escapeValue = (value) => {
  if (value === undefined || value === null) return value;
  return value.toString().replace(/[\\'"]/g, char => '\\' + char);
};

const getDocumentationFromRules = (transformed, rules = []) => {
  for (const rule of rules) {
    const sourceValue = transformed[rule.field];
    if (sourceValue === undefined || sourceValue === null) continue;
    if (!rule.match || !rule.url) continue;

    if (sourceValue.toString().toLowerCase().includes(rule.match.toLowerCase())) {
      return rule.url;
    }
  }

  return null;
};

export const handle = function(webhookData) {
  try {
    const payload = JSON.parse(webhookData.body.toString());
    const options = webhookData.options || {};

    const templateName = options.templateName || 'sample.base';
    const selectedTemplate = resolveTemplate(templateName);
    const allowedTargets = getTemplateEditableFieldSet(templateName);
    const allTemplateFields = getTemplateFieldSet(templateName);
    const documentationTargetField = getTemplateDocumentationTargetField(templateName);

    const fieldMap = options.fieldMap || {};
    const filteredFieldMap = filterFieldMapByAllowedTargets(fieldMap, allowedTargets);
    const mappedFields = mapFields(payload, filteredFieldMap);

    const escapeFields = options.escapeFields || ['alertSummary'];
    for (const field of escapeFields) {
      if (mappedFields[field] !== undefined) {
        mappedFields[field] = escapeValue(mappedFields[field]);
      }
    }

    const transformed = buildFromTemplate({
      template: selectedTemplate,
      mapped: mappedFields
    });

    if (documentationTargetField && allTemplateFields.has(documentationTargetField)) {
      const documentationRules = options.documentationRules || [];
      if (documentationRules.length) {
        const documentationValue = getDocumentationFromRules(transformed, documentationRules);
        if (documentationValue !== null) {
          transformed[documentationTargetField] = documentationValue;
        }
      }
    }

    return transformed;
  } catch (err) {
    console.error(`Error transforming ${moduleName} payload:`, err);
    return null;
  }
};

export default { name: moduleName, handle };
