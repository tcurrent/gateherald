import {
  getTemplateFieldSet,
  getTemplateEditableFieldSet,
  getTemplateDocumentationTargetField,
  getTemplateCatalog,
  listTemplates
} from './templateRegistry.js';

const templateAwareModules = new Set(['TemplateDriver']);

const isValidMappingSpec = (mappingSpec) => {
  if (typeof mappingSpec === 'string') {
    return mappingSpec.length > 0;
  }

  if (!Array.isArray(mappingSpec)) {
    return false;
  }

  if (mappingSpec.length === 0) {
    return false;
  }

  return mappingSpec.every((segment) => {
    if (!segment || typeof segment !== 'object') {
      return false;
    }

    if (segment.type !== 'path' && segment.type !== 'text') {
      return false;
    }

    return typeof segment.value === 'string';
  });
};

export const validateRoutesConfig = (routes = []) => {
  const errors = [];
  const availableTemplates = new Set(listTemplates());
  const templatesByName = new Map(getTemplateCatalog().map((template) => [template.name, template]));

  routes.forEach((route, index) => {
    const routeId = route.path || `route[${index}]`;

    const options = route.moduleOptions || {};
    const templateName = options.templateName || 'sample.base';

    if (!availableTemplates.has(templateName)) {
      errors.push(
        `${routeId}: unknown templateName '${templateName}'. Available templates: ${[
          ...availableTemplates
        ].join(', ')}`
      );
      return;
    }

    const fieldMap = options.fieldMap || {};
    const allowedTargets = getTemplateEditableFieldSet(templateName);
    const allTemplateTargets = getTemplateFieldSet(templateName);
    const documentationTargetField = getTemplateDocumentationTargetField(templateName);
    const templateMeta = templatesByName.get(templateName);

    if (templateMeta?.needsDocumentationRules) {
      if (!documentationTargetField) {
        errors.push(
          `${routeId}: template '${templateName}' requires documentationRules and must define documentationTargetField`
        );
      } else if (!allTemplateTargets.has(documentationTargetField)) {
        errors.push(
          `${routeId}: documentationTargetField '${documentationTargetField}' is not part of template '${templateName}'`
        );
      }
    }

    Object.entries(fieldMap).forEach(([targetField, mappingSpec]) => {
      if (!allowedTargets.has(targetField)) {
        errors.push(
          `${routeId}: fieldMap target '${targetField}' is not editable in template '${templateName}' (only fields with default '' or null are editable)`
        );
        return;
      }

      if (!isValidMappingSpec(mappingSpec)) {
        errors.push(
          `${routeId}: fieldMap target '${targetField}' must be a path string or an array of { type, value } segments`
        );
      }
    });

    if (
      options.documentationSourceField &&
      !allTemplateTargets.has(options.documentationSourceField)
    ) {
      errors.push(
        `${routeId}: documentationSourceField '${options.documentationSourceField}' is not part of template '${templateName}'`
      );
    }

    if (options.documentationRules !== undefined) {
      if (!Array.isArray(options.documentationRules)) {
        errors.push(`${routeId}: documentationRules must be an array`);
      } else {
        options.documentationRules.forEach((rule, ruleIndex) => {
          const prefix = `${routeId}: documentationRules[${ruleIndex}]`;
          if (!rule || typeof rule !== 'object') {
            errors.push(`${prefix} must be an object`);
            return;
          }

          if (!rule.field || !allTemplateTargets.has(rule.field)) {
            errors.push(`${prefix}.field '${rule.field}' is not part of template '${templateName}'`);
          }

          if (!rule.match || typeof rule.match !== 'string') {
            errors.push(`${prefix}.match must be a non-empty string`);
          }

          if (!rule.url || typeof rule.url !== 'string') {
            errors.push(`${prefix}.url must be a non-empty string`);
          }
        });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};
