    const configuredApiBaseUrl = (
      window.GATEHERALD_API_BASE_URL
      || document.documentElement?.dataset?.apiBaseUrl
      || ''
    ).trim();
    const API_BASE_URL = configuredApiBaseUrl.replace(/\/+$/, '');
    const apiUrl = (apiPath) => `${API_BASE_URL}${apiPath}`;

    const state = {
      templates: [],
      ingressPaths: [],
      configRecords: [],
      selectedConfigRecordId: null,
      configBaselineSnapshot: null,
      lastTemplateName: ''
    };

    const els = {
      configRecordSelect: document.getElementById('configRecordSelect'),
      loadConfigRecordBtn: document.getElementById('loadConfigRecordBtn'),
      newConfigRecordBtn: document.getElementById('newConfigRecordBtn'),
      saveConfigRecordBtn: document.getElementById('saveConfigRecordBtn'),
      deleteConfigRecordBtn: document.getElementById('deleteConfigRecordBtn'),
      configRecordStatus: document.getElementById('configRecordStatus'),
      templateName: document.getElementById('templateName'),
      templateTag: document.getElementById('templateTag'),
      templateFields: document.getElementById('templateFields'),
      ingressDiscoveryPanel: document.getElementById('ingressDiscoveryPanel'),
      fieldMappingPanel: document.getElementById('fieldMappingPanel'),
      previewConfigPanel: document.getElementById('previewConfigPanel'),
      samplePayload: document.getElementById('samplePayload'),
      extractFieldsBtn: document.getElementById('extractFieldsBtn'),
      clearFieldsBtn: document.getElementById('clearFieldsBtn'),
      ingressStatus: document.getElementById('ingressStatus'),
      mappingRows: document.getElementById('mappingRows'),
      docsPanel: document.getElementById('docsPanel'),
      docsNote: document.getElementById('docsNote'),
      docRows: document.getElementById('docRows'),
      addDocRuleBtn: document.getElementById('addDocRuleBtn'),
      routeName: document.getElementById('routeName'),
      routePath: document.getElementById('routePath'),
      regenerateRouteBtn: document.getElementById('regenerateRouteBtn'),
      targetRows: document.getElementById('targetRows'),
      addTargetBtn: document.getElementById('addTargetBtn'),
      headerRows: document.getElementById('headerRows'),
      addHeaderBtn: document.getElementById('addHeaderBtn'),
      output: document.getElementById('output'),
      outputStatus: document.getElementById('outputStatus')
    };

    const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const normalizeMethod = (method) => (method || 'POST').toUpperCase();

    const autoResizeTextarea = (textarea) => {
      if (!textarea) return;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    };

    const setStatus = (element, message, isError = false) => {
      element.replaceChildren();
      if (!isError) {
        element.textContent = message;
        return;
      }

      const error = document.createElement('span');
      error.className = 'error';
      error.textContent = message;
      element.appendChild(error);
    };

    const appendSelectOption = (select, { label, value, selected = false }) => {
      const option = new Option(label, value, false, selected);
      select.appendChild(option);
    };

    const initializeAutoResizeTextareas = () => {
      document.querySelectorAll('textarea').forEach((textarea) => {
        textarea.addEventListener('input', () => autoResizeTextarea(textarea));
        autoResizeTextarea(textarea);
      });
    };

    const encodeBase32 = (value, length) => {
      let output = '';
      let current = value;

      for (let i = 0; i < length; i += 1) {
        const index = Number(current % 32n);
        output = ULID_ALPHABET[index] + output;
        current /= 32n;
      }

      return output;
    };

    const randomBase32 = (length) => {
      let output = '';
      const cryptoObj = window.crypto || window.msCrypto;

      if (cryptoObj && cryptoObj.getRandomValues) {
        const bytes = new Uint8Array(length);
        cryptoObj.getRandomValues(bytes);
        for (let i = 0; i < length; i += 1) {
          output += ULID_ALPHABET[bytes[i] % 32];
        }
        return output;
      }

      for (let i = 0; i < length; i += 1) {
        output += ULID_ALPHABET[Math.floor(Math.random() * 32)];
      }
      return output;
    };

    const generateULID = () => {
      const timePart = encodeBase32(BigInt(Date.now()), 10);
      const randomPart = randomBase32(16);
      return `${timePart}${randomPart}`;
    };

    const syncRegenerateRouteButtonState = () => {
      els.regenerateRouteBtn.disabled = !els.routeName.value.trim();
    };

    const setGeneratedRoutePath = () => {
      const routeName = els.routeName.value.trim();
      syncRegenerateRouteButtonState();
      if (!routeName) {
        els.routePath.value = '';
        return;
      }
      els.routePath.value = `/webhook/${routeName}/${generateULID()}`;
    };

    const extractRouteNameFromPath = (routePath) => {
      if (typeof routePath !== 'string') return '';
      const parts = routePath.split('/').filter(Boolean);
      if (parts.length < 3) return '';
      if (parts[0] !== 'webhook') return '';
      return parts[1] || '';
    };

    const addTargetRow = (value = '') => {
      const wrapper = document.createElement('div');
      wrapper.className = 'target-row';
      const input = document.createElement('input');
      input.className = 'target-url input-base';
      input.placeholder = 'https://example.com/api';
      input.value = value;

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'remove-target btn btn-secondary btn-inline';
      removeButton.textContent = 'Remove';

      removeButton.addEventListener('click', () => {
        if (els.targetRows.children.length <= 1) {
          return;
        }
        wrapper.remove();
        syncTargetRemoveButtons();
      });

      wrapper.append(input, removeButton);

      els.targetRows.appendChild(wrapper);
      syncTargetRemoveButtons();
    };

    const syncTargetRemoveButtons = () => {
      const removeButtons = els.targetRows.querySelectorAll('.remove-target');
      const disableRemove = removeButtons.length <= 1;
      removeButtons.forEach((button) => {
        button.disabled = disableRemove;
      });
    };

    const addHeaderRow = (name = '', valueType = 'env', value = '') => {
      const wrapper = document.createElement('div');
      wrapper.className = 'header-row';
      const nameInput = document.createElement('input');
      nameInput.className = 'header-name input-base';
      nameInput.placeholder = 'X-API-KEY';
      nameInput.value = name;

      const typeSelect = document.createElement('select');
      typeSelect.className = 'header-value-type input-base';
      appendSelectOption(typeSelect, { label: 'Environment Variable', value: 'env', selected: valueType === 'env' });
      appendSelectOption(typeSelect, { label: 'Literal', value: 'literal', selected: valueType === 'literal' });

      const valueInput = document.createElement('input');
      valueInput.className = 'header-value input-base';
      valueInput.value = value;

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'remove-header btn btn-secondary btn-inline';
      removeButton.textContent = 'Remove';

      const updatePlaceholder = () => {
        valueInput.placeholder = typeSelect.value === 'env' ? 'API_TOKEN' : 'literal-value';
      };
      typeSelect.addEventListener('change', updatePlaceholder);
      updatePlaceholder();

      removeButton.addEventListener('click', () => {
        wrapper.remove();
      });

      wrapper.append(nameInput, typeSelect, valueInput, removeButton);

      els.headerRows.appendChild(wrapper);
    };

    const readHeaders = () => {
      const headers = [];
      els.headerRows.querySelectorAll('.header-row').forEach((row) => {
        const name = row.querySelector('.header-name').value.trim();
        const valueType = row.querySelector('.header-value-type').value;
        const raw = row.querySelector('.header-value').value.trim();
        if (!name || !raw) return;
        const value = valueType === 'env'
          ? (raw.startsWith('process.env.') ? raw : `process.env.${raw}`)
          : raw;
        headers.push({ name, value });
      });
      return headers;
    };

    const readTargetUrls = () => {
      const urls = [];
      els.targetRows.querySelectorAll('.target-row .target-url').forEach((input) => {
        const url = input.value.trim();
        if (url) urls.push(url);
      });
      return urls;
    };

    const flattenPaths = (obj, prefix = '', out = []) => {
      if (obj === null || obj === undefined) {
        if (prefix) out.push(prefix);
        return out;
      }

      if (Array.isArray(obj)) {
        if (obj.length === 0 && prefix) out.push(prefix);
        obj.forEach((item, i) => flattenPaths(item, `${prefix}[${i}]`, out));
        return out;
      }

      if (typeof obj !== 'object') {
        if (prefix) out.push(prefix);
        return out;
      }

      const entries = Object.entries(obj);
      if (!entries.length && prefix) out.push(prefix);

      for (const [key, value] of entries) {
        const path = prefix ? `${prefix}.${key}` : key;
        flattenPaths(value, path, out);
      }

      return out;
    };

    const getSelectedTemplate = () => {
      const name = els.templateName.value;
      return state.templates.find(t => t.name === name);
    };

    const extractIngressPathsFromRawPayload = (rawPayload) => {
      const payload = JSON.parse(rawPayload);
      return Array.from(new Set(flattenPaths(payload))).sort();
    };

    const renderIngressStatus = () => {
      if (!state.ingressPaths.length) {
        setStatus(els.ingressStatus, 'No ingress fields extracted yet.');
        return;
      }

      setStatus(els.ingressStatus, `Extracted ${state.ingressPaths.length} ingress fields.`);
    };

    const applyIngressDiscoveryState = ({ samplePayload = '', ingressPaths = [] } = {}) => {
      els.samplePayload.value = samplePayload;
      autoResizeTextarea(els.samplePayload);
      state.ingressPaths = Array.isArray(ingressPaths)
        ? Array.from(new Set(ingressPaths.filter((path) => typeof path === 'string' && path.trim()))).sort()
        : [];
      renderIngressStatus();
    };

    const captureConfigFormSnapshot = () => {
      const mappingRows = Array.from(els.mappingRows.querySelectorAll('.mapping-row')).map((row) => ({
        target: row.getAttribute('data-target') || '',
        expression: row.querySelector('.mapping-expression')?.value || ''
      }));

      const docRows = Array.from(els.docRows.querySelectorAll('.doc-row')).map((row) => ({
        field: row.querySelector('.doc-watch-field')?.value || '',
        match: row.querySelector('.doc-key')?.value || '',
        url: row.querySelector('.doc-url')?.value || ''
      }));

      const headerRows = Array.from(els.headerRows.querySelectorAll('.header-row')).map((row) => ({
        name: row.querySelector('.header-name')?.value || '',
        valueType: row.querySelector('.header-value-type')?.value || '',
        value: row.querySelector('.header-value')?.value || ''
      }));

      const targetRows = Array.from(els.targetRows.querySelectorAll('.target-row .target-url')).map((input) => input.value || '');

      return JSON.stringify({
        selectedConfigRecordId: state.selectedConfigRecordId,
        routeName: els.routeName.value || '',
        routePath: els.routePath.value || '',
        method: document.getElementById('method').value || '',
        enabled: document.getElementById('enabled').checked,
        templateName: els.templateName.value || '',
        samplePayload: els.samplePayload.value || '',
        ingressPaths: [...state.ingressPaths],
        mappings: mappingRows,
        documentationRules: docRows,
        headers: headerRows,
        targets: targetRows
      });
    };

    const markConfigClean = () => {
      state.configBaselineSnapshot = captureConfigFormSnapshot();
    };

    const hasUnsavedConfigChanges = () => {
      if (state.configBaselineSnapshot === null) return false;
      return captureConfigFormSnapshot() !== state.configBaselineSnapshot;
    };

    const confirmDiscardConfigChanges = (actionLabel = 'continue') => {
      if (!hasUnsavedConfigChanges()) return true;
      return window.confirm(`You have unsaved config changes. Discard them and ${actionLabel}?`);
    };

    const hasUnsavedConfigChangesForTemplateSwitch = () => {
      if (state.configBaselineSnapshot === null) return false;

      const selectedTemplate = els.templateName.value;
      const previousTemplate = state.lastTemplateName;

      if (selectedTemplate === previousTemplate) {
        return hasUnsavedConfigChanges();
      }

      els.templateName.value = previousTemplate;
      const hasChanges = hasUnsavedConfigChanges();
      els.templateName.value = selectedTemplate;
      return hasChanges;
    };

    const syncLoadConfigButtonState = () => {
      els.loadConfigRecordBtn.disabled = !els.configRecordSelect.value;
    };

    const renderConfigRecordSelect = () => {
      els.configRecordSelect.replaceChildren();
      appendSelectOption(els.configRecordSelect, { label: 'Select a configuration', value: '' });
      state.configRecords.forEach((record) => {
        const label = `${record.path} [${record.method}]`;
        appendSelectOption(els.configRecordSelect, { label, value: String(record.id) });
      });
      if (state.selectedConfigRecordId) {
        els.configRecordSelect.value = String(state.selectedConfigRecordId);
      }
      syncLoadConfigButtonState();
    };


    const loadConfigRecords = async () => {
      const response = await fetch(apiUrl('/api/configs'));
      if (!response.ok) throw new Error('Failed to load config records');
      const payload = await response.json();
      state.configRecords = payload.configs || [];
      renderConfigRecordSelect();
    };


    const loadConfigIntoBuilder = (configRecord) => {
      const routePath = configRecord.path || '';
      els.routePath.value = routePath;
      els.routeName.value = extractRouteNameFromPath(routePath) || '';
      syncRegenerateRouteButtonState();
      document.getElementById('method').value = normalizeMethod(configRecord.method || 'POST');
      document.getElementById('enabled').checked = configRecord.enabled !== false;

      els.targetRows.innerHTML = '';
      (configRecord.targets || []).forEach((target) => addTargetRow(target.url || ''));
      if (!els.targetRows.children.length) addTargetRow('');
      syncTargetRemoveButtons();

      els.headerRows.innerHTML = '';
      (configRecord.headers || []).forEach((header) => {
        const isEnv = typeof header.value === 'string' && header.value.startsWith('process.env.');
        const value = isEnv ? header.value.slice('process.env.'.length) : (header.value || '');
        addHeaderRow(header.name || '', isEnv ? 'env' : 'literal', value);
      });

      const options = configRecord.moduleOptions || {};
      els.templateName.value = options.templateName || '';
      renderTemplateSelectionSections();

      const ingressDiscovery = options.ingressDiscovery || {};
      let ingressPaths = Array.isArray(ingressDiscovery.ingressPaths)
        ? ingressDiscovery.ingressPaths
        : [];
      const samplePayload = typeof ingressDiscovery.samplePayload === 'string'
        ? ingressDiscovery.samplePayload
        : '';

      if (!ingressPaths.length && samplePayload.trim()) {
        try {
          ingressPaths = extractIngressPathsFromRawPayload(samplePayload);
        } catch {
          ingressPaths = [];
        }
      }

      applyIngressDiscoveryState({ samplePayload, ingressPaths });

      renderMappingRows(options.fieldMap || {});
      renderDocumentationSection();
      renderDocumentationRules(options.documentationRules || []);

      state.lastTemplateName = els.templateName.value;
      markConfigClean();
    };

    const loadConfigRecordIntoBuilder = () => {
      const id = Number(els.configRecordSelect.value);
      if (!id) return;
      if (!confirmDiscardConfigChanges('load another config')) {
        return;
      }

      const record = state.configRecords.find((item) => item.id === id);
      if (!record) return;

      state.selectedConfigRecordId = id;
      loadConfigIntoBuilder(record);
      setStatus(els.configRecordStatus, `Loaded config '${record.path}'.`);
    };

    const newConfigRecord = (skipUnsavedPrompt = false) => {
      if (!skipUnsavedPrompt && !confirmDiscardConfigChanges('start a new config')) {
        return;
      }

      state.selectedConfigRecordId = null;
      els.configRecordSelect.value = '';
      syncLoadConfigButtonState();
      els.routeName.value = '';
      setGeneratedRoutePath();
      document.getElementById('method').value = 'POST';
      document.getElementById('enabled').checked = true;
      applyIngressDiscoveryState();
      els.targetRows.innerHTML = '';
      addTargetRow('');
      syncTargetRemoveButtons();
      els.headerRows.innerHTML = '';
      els.templateName.value = '';
      refreshTemplateUI();
      renderMappingRows({});
      renderDocumentationRules([]);
      setStatus(els.configRecordStatus, 'Config form reset.');
      state.lastTemplateName = els.templateName.value;
      markConfigClean();
    };

    const saveConfigRecord = async () => {
      const configEntry = generateConfig();
      const isUpdate = Boolean(state.selectedConfigRecordId);
      const url = isUpdate
        ? apiUrl(`/api/configs/${state.selectedConfigRecordId}`)
        : apiUrl('/api/configs');
      const method = isUpdate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configEntry)
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Failed to save config record');
      }

      const responsePayload = await response.json();
      state.selectedConfigRecordId = responsePayload.config?.id || state.selectedConfigRecordId;
      await loadConfigRecords();
      setStatus(els.configRecordStatus, isUpdate ? 'Config updated.' : 'Config created.');
      markConfigClean();
    };

    const deleteConfigRecord = async () => {
      if (!state.selectedConfigRecordId) throw new Error('Select a config record first');
      if (!window.confirm('Delete this config record? This action cannot be undone.')) return;

      const response = await fetch(apiUrl(`/api/configs/${state.selectedConfigRecordId}`), {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Failed to delete config record');
      }

      newConfigRecord(true);
      await loadConfigRecords();
      setStatus(els.configRecordStatus, 'Config deleted.');
    };

    const normalizeMappingSpec = (mappingSpec) => {
      if (!mappingSpec) return [];

      if (typeof mappingSpec === 'string') {
        return [{ type: 'path', value: mappingSpec }];
      }

      if (!Array.isArray(mappingSpec)) {
        return [];
      }

      return mappingSpec
        .filter(segment => segment && typeof segment === 'object')
        .filter(segment => segment.type === 'path' || segment.type === 'text')
        .map(segment => ({
          type: segment.type,
          value: segment.value || ''
        }));
    };

    const segmentsToExpression = (mappingSpec) => {
      const segments = normalizeMappingSpec(mappingSpec);
      return segments
        .map((segment) => {
          if (segment.type === 'path') {
            return `$${segment.value}`;
          }

          return segment.value;
        })
        .join('');
    };

    const expressionToSegments = (expression) => {
      const segments = [];
      let literalBuffer = '';

      const flushLiteral = () => {
        if (!literalBuffer) return;
        segments.push({ type: 'text', value: literalBuffer });
        literalBuffer = '';
      };

      for (let i = 0; i < expression.length; i += 1) {
        const ch = expression[i];

        if (ch !== '$') {
          literalBuffer += ch;
          continue;
        }

        if (expression[i + 1] === '$') {
          literalBuffer += '$';
          i += 1;
          continue;
        }

        flushLiteral();
        let token = '';
        let cursor = i + 1;

        while (cursor < expression.length) {
          const next = expression[cursor];
          if (!/[A-Za-z0-9_.\[\]-]/.test(next)) {
            break;
          }
          token += next;
          cursor += 1;
        }

        if (!token) {
          literalBuffer += '$';
          continue;
        }

        segments.push({ type: 'path', value: token });
        i = cursor - 1;
      }

      flushLiteral();
      return segments.filter(segment => segment.value !== '');
    };

    const escapeHtml = (value) => {
      return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    };

    const readSegmentsFromRow = (row) => {
      const expression = row.querySelector('.mapping-expression').value;
      return expressionToSegments(expression);
    };

    const hideAutocomplete = (row) => {
      const menu = row.querySelector('.mapping-autocomplete');
      menu.classList.add('hidden');
      menu.innerHTML = '';
      menu.dataset.start = '';
      menu.dataset.end = '';
      menu.dataset.activeIndex = '';
    };

    const getTokenContext = (expression, cursorPos) => {
      const isTokenChar = (ch) => /[A-Za-z0-9_.\[\]-]/.test(ch);
      const dollarIndex = expression.lastIndexOf('$', cursorPos - 1);
      if (dollarIndex < 0) return null;
      if (expression[dollarIndex + 1] === '$') return null;

      for (let i = dollarIndex + 1; i < cursorPos; i += 1) {
        if (!isTokenChar(expression[i])) {
          return null;
        }
      }

      let tokenEnd = dollarIndex + 1;
      while (tokenEnd < expression.length && isTokenChar(expression[tokenEnd])) {
        tokenEnd += 1;
      }

      const prefix = expression.slice(dollarIndex + 1, cursorPos);
      return {
        start: dollarIndex,
        end: tokenEnd,
        prefix
      };
    };

    const applyAutocompleteSelection = (row, selectedPath) => {
      const input = row.querySelector('.mapping-expression');
      const menu = row.querySelector('.mapping-autocomplete');
      const start = Number(menu.dataset.start);
      const end = Number(menu.dataset.end);

      if (Number.isNaN(start) || Number.isNaN(end)) {
        return;
      }

      const expression = input.value;
      input.value = `${expression.slice(0, start)}$${selectedPath}${expression.slice(end)}`;
      const caret = start + selectedPath.length + 1;
      input.setSelectionRange(caret, caret);
      renderMappingPreview(row);
      hideAutocomplete(row);
      input.focus();
    };

    const renderAutocomplete = (row) => {
      const input = row.querySelector('.mapping-expression');
      const menu = row.querySelector('.mapping-autocomplete');
      const cursorPos = input.selectionStart ?? input.value.length;
      const ctx = getTokenContext(input.value, cursorPos);

      if (!ctx || !state.ingressPaths.length) {
        hideAutocomplete(row);
        return;
      }

      const suggestions = state.ingressPaths
        .filter(path => path.toLowerCase().startsWith(ctx.prefix.toLowerCase()))
        .slice(0, 12);

      if (!suggestions.length) {
        hideAutocomplete(row);
        return;
      }

      menu.dataset.start = String(ctx.start);
      menu.dataset.end = String(ctx.end);
      menu.dataset.activeIndex = '0';
      menu.innerHTML = suggestions
        .map((path, index) => `<button type="button" class="autocomplete-option ${index === 0 ? 'active' : ''}" data-path="${escapeHtml(path)}" data-index="${index}">$${escapeHtml(path)}</button>`)
        .join('');

      menu.classList.remove('hidden');

      menu.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          applyAutocompleteSelection(row, btn.dataset.path);
        });
      });
    };

    const moveAutocompleteSelection = (row, step) => {
      const menu = row.querySelector('.mapping-autocomplete');
      const options = Array.from(menu.querySelectorAll('button'));
      if (!options.length) return;

      let currentIndex = Number(menu.dataset.activeIndex || 0);
      if (Number.isNaN(currentIndex)) currentIndex = 0;
      currentIndex = (currentIndex + step + options.length) % options.length;
      menu.dataset.activeIndex = String(currentIndex);

      options.forEach((btn, index) => {
        btn.classList.toggle('active', index === currentIndex);
        btn.classList.toggle('bg-teal-50', index === currentIndex);
        btn.classList.toggle('text-teal-800', index === currentIndex);
      });

      options[currentIndex].scrollIntoView({ block: 'nearest' });
    };

    const acceptAutocompleteSelection = (row) => {
      const menu = row.querySelector('.mapping-autocomplete');
      if (menu.classList.contains('hidden')) return false;

      const options = Array.from(menu.querySelectorAll('button'));
      if (!options.length) return false;

      let currentIndex = Number(menu.dataset.activeIndex || 0);
      if (Number.isNaN(currentIndex)) currentIndex = 0;
      const selected = options[currentIndex];
      applyAutocompleteSelection(row, selected.dataset.path);
      return true;
    };

    const renderMappingPreview = (row) => {
      const previewEl = row.querySelector('.mapping-preview');
      if (!previewEl) return;

      const segments = readSegmentsFromRow(row);
      if (!segments.length) {
        previewEl.innerHTML = '<span class="mapping-preview-empty">No mapping configured</span>';
        return;
      }

      const parts = segments.map((segment) => {
        const safeValue = escapeHtml(segment.value);
        if (segment.type === 'path') {
          return `<span class="path-chip">{${safeValue}}</span>`;
        }

        return `<span class="text-chip">${safeValue}</span>`;
      });

      previewEl.innerHTML = parts.join('');
    };

    const renderMappingRows = (existingMap = {}) => {
      const template = getSelectedTemplate();
      if (!template) {
        els.mappingRows.innerHTML = '';
        return;
      }

      const editableFields = template.editableFields || [];

      const rows = editableFields.map((targetField) => {
        const expression = segmentsToExpression(existingMap[targetField]);
        const safeTargetField = escapeHtml(targetField);
        return `
          <div class="mapping-row" data-target="${safeTargetField}">
            <div class="field-token">${safeTargetField}</div>
            <div class="mapping-builder">
              <input class="mapping-expression input-base" placeholder="$event.title and $service.name" value="${escapeHtml(expression)}" />
              <div class="mapping-help">Use $field.path for ingress values. Everything else is literal text. Use $$ for a literal dollar sign.</div>
              <div class="mapping-autocomplete hidden"></div>
              <div class="mapping-preview"></div>
            </div>
            <button type="button" class="clear-map btn btn-secondary btn-inline">Clear</button>
          </div>
        `;
      });

      els.mappingRows.innerHTML = rows.join('');
      els.mappingRows.querySelectorAll('.mapping-row').forEach((row) => {
        const expressionInput = row.querySelector('.mapping-expression');

        expressionInput.addEventListener('input', () => {
          renderMappingPreview(row);
          renderAutocomplete(row);
        });

        expressionInput.addEventListener('click', () => {
          renderAutocomplete(row);
        });

        expressionInput.addEventListener('keydown', (ev) => {
          const menu = row.querySelector('.mapping-autocomplete');
          const isOpen = !menu.classList.contains('hidden');

          if (ev.key === 'ArrowDown' && isOpen) {
            ev.preventDefault();
            moveAutocompleteSelection(row, 1);
            return;
          }

          if (ev.key === 'ArrowUp' && isOpen) {
            ev.preventDefault();
            moveAutocompleteSelection(row, -1);
            return;
          }

          if ((ev.key === 'Enter' || ev.key === 'Tab') && isOpen) {
            const accepted = acceptAutocompleteSelection(row);
            if (accepted) {
              ev.preventDefault();
            }
            return;
          }

          if (ev.key === 'Escape' && isOpen) {
            hideAutocomplete(row);
            return;
          }
        });

        expressionInput.addEventListener('blur', () => {
          setTimeout(() => hideAutocomplete(row), 100);
        });

        row.querySelector('.clear-map').addEventListener('click', () => {
          expressionInput.value = '';
          renderMappingPreview(row);
          hideAutocomplete(row);
        });

        renderMappingPreview(row);
      });
    };

    const readFieldMap = () => {
      const result = {};
      els.mappingRows.querySelectorAll('.mapping-row').forEach(row => {
        const target = row.getAttribute('data-target');
        const segments = readSegmentsFromRow(row);

        if (!segments.length) return;

        if (segments.length === 1 && segments[0].type === 'path') {
          result[target] = segments[0].value;
          return;
        }

        result[target] = segments;
      });
      return result;
    };

    const getDocumentationWatchFields = () => {
      const template = getSelectedTemplate();
      if (!template) return [];

      const excludedField = template.documentationTargetField || '';
      return (template.editableFields || []).filter((field) => field !== excludedField);
    };

    const populateDocumentationFieldSelect = (select, selectedField = '') => {
      select.replaceChildren();
      appendSelectOption(select, { label: 'Select field to match', value: '' });
      getDocumentationWatchFields().forEach((field) => {
        appendSelectOption(select, {
          label: field,
          value: field,
          selected: field === selectedField
        });
      });
    };

    const addDocRuleRow = (watchField = '', keywordMatch = '', targetUrl = '') => {
      const container = document.createElement('div');
      container.className = 'doc-row';
      const watchFieldSelect = document.createElement('select');
      watchFieldSelect.className = 'doc-watch-field input-base';
      populateDocumentationFieldSelect(watchFieldSelect, watchField);

      const keywordInput = document.createElement('input');
      keywordInput.className = 'doc-key input-base';
      keywordInput.placeholder = "Match value (e.g., 'Server Down')";
      keywordInput.value = keywordMatch;

      const targetUrlInput = document.createElement('input');
      targetUrlInput.className = 'doc-url input-base';
      targetUrlInput.placeholder = 'Documentation URL';
      targetUrlInput.value = targetUrl;

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'remove-doc-rule btn btn-secondary btn-inline';
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => container.remove());

      container.append(watchFieldSelect, keywordInput, targetUrlInput, removeButton);
      els.docRows.appendChild(container);
    };

    const readDocumentationRules = () => {
      const rules = [];
      els.docRows.querySelectorAll('.doc-row').forEach(row => {
        const watchField = row.querySelector('.doc-watch-field').value.trim();
        const keywordMatch = row.querySelector('.doc-key').value.trim();
        const targetUrl = row.querySelector('.doc-url').value.trim();
        if (watchField && keywordMatch && targetUrl) {
          rules.push({ field: watchField, match: keywordMatch, url: targetUrl });
        }
      });
      return rules;
    };

    const renderDocumentationRules = (rules = []) => {
      els.docRows.innerHTML = '';
      rules.forEach((rule) => addDocRuleRow(rule.field, rule.match, rule.url));
    };

    const renderDocumentationSection = () => {
      const template = getSelectedTemplate();
      const needsDocs = Boolean(template && template.needsDocumentationRules === true);
      const targetField = template?.documentationTargetField;
      els.docsPanel.classList.toggle('hidden', !needsDocs);
      setStatus(
        els.docsNote,
        needsDocs
          ? `Rules map source field matches to a URL and write it into '${targetField}'.`
          : 'Selected template does not support documentation rules.'
      );
    };

    const renderTemplateSelectionSections = () => {
      const hasTemplate = Boolean(getSelectedTemplate());
      els.ingressDiscoveryPanel.classList.toggle('hidden', !hasTemplate);
      els.fieldMappingPanel.classList.toggle('hidden', !hasTemplate);
      els.previewConfigPanel.classList.toggle('hidden', !hasTemplate);
    };

    const refreshTemplateUI = () => {
      const template = getSelectedTemplate();
      const existingRules = readDocumentationRules();
      const editableFields = template?.editableFields || [];

      if (!template) {
        if (!state.templates.length) {
          els.templateTag.classList.remove('hidden');
          els.templateTag.textContent = 'No Templates';
          setStatus(els.templateFields, 'No templates available.');
        } else {
          els.templateTag.classList.add('hidden');
          els.templateTag.textContent = '';
          setStatus(els.templateFields, '');
        }
      } else {
        els.templateTag.classList.add('hidden');
        els.templateTag.textContent = '';
        setStatus(els.templateFields, `Editable fields (${editableFields.length}): ${editableFields.join(', ')}`);
      }

      renderMappingRows(readFieldMap());
      renderTemplateSelectionSections();
      renderDocumentationSection();
      renderDocumentationRules(existingRules);
    };

    const generateConfig = () => {
      const routeName = els.routeName.value.trim();
      const routePath = els.routePath.value.trim();
      const method = document.getElementById('method').value;
      const enabled = document.getElementById('enabled').checked;
      const headers = readHeaders();
      const templateName = els.templateName.value;
      const targetUrls = readTargetUrls();
      const template = getSelectedTemplate();

      if (!templateName || !template) {
        throw new Error('Template is required');
      }

      if (!routeName) {
        throw new Error('Route name is required');
      }

      if (!routePath) {
        throw new Error('Route path is required');
      }

      if (!routePath.startsWith('/webhook/')) {
        throw new Error('Route path must start with /webhook/');
      }

      if (routePath.length <= '/webhook/'.length) {
        throw new Error('Route path must include a ULID after /webhook/');
      }

      if (!targetUrls.length) {
        throw new Error('At least one target URL is required');
      }

      const fieldMap = readFieldMap();
      const documentationRules = readDocumentationRules();
      const samplePayload = els.samplePayload.value.trim();

      const moduleOptions = {
        templateName,
        fieldMap
      };

      if (samplePayload || state.ingressPaths.length) {
        moduleOptions.ingressDiscovery = {
          samplePayload,
          ingressPaths: [...state.ingressPaths]
        };
      }

      if (template.needsDocumentationRules && documentationRules.length) {
        moduleOptions.documentationRules = documentationRules;
      }

      return {
        path: routePath,
        method,
        enabled,
        moduleOptions,
        ...(headers.length && { headers }),
        targets: targetUrls.map(url => ({ url }))
      };
    };

    const loadTemplates = async () => {
      const currentTemplate = els.templateName.value;
      const response = await fetch(apiUrl('/api/ui/templates'));
      if (!response.ok) throw new Error('Failed to load templates');
      const payload = await response.json();
      state.templates = payload.templates || [];
      els.templateName.replaceChildren();
      appendSelectOption(els.templateName, { label: 'Select a template', value: '' });
      state.templates.forEach((template) => {
        appendSelectOption(els.templateName, { label: template.name, value: template.name });
      });

      if (currentTemplate && state.templates.some((template) => template.name === currentTemplate)) {
        els.templateName.value = currentTemplate;
      } else {
        els.templateName.value = '';
      }

      refreshTemplateUI();
      state.lastTemplateName = els.templateName.value;
    };

    const initialize = async () => {
      initializeAutoResizeTextareas();

      try {
        await loadTemplates();
        await loadConfigRecords();
        newConfigRecord();
      } catch (err) {
        setStatus(els.outputStatus, err.message, true);
      }

      els.templateName.addEventListener('change', () => {
        if (hasUnsavedConfigChangesForTemplateSwitch() && !window.confirm('You have unsaved config changes. Discard them and switch templates?')) {
          els.templateName.value = state.lastTemplateName;
          return;
        }

        state.lastTemplateName = els.templateName.value;
        refreshTemplateUI();
      });

      els.loadConfigRecordBtn.addEventListener('click', () => {
        try {
          loadConfigRecordIntoBuilder();
        } catch (err) {
          setStatus(els.configRecordStatus, err.message, true);
        }
      });
      els.configRecordSelect.addEventListener('change', syncLoadConfigButtonState);
      els.newConfigRecordBtn.addEventListener('click', () => newConfigRecord(false));
      els.saveConfigRecordBtn.addEventListener('click', async () => {
        try {
          await saveConfigRecord();
        } catch (err) {
          setStatus(els.configRecordStatus, err.message, true);
        }
      });
      els.deleteConfigRecordBtn.addEventListener('click', async () => {
        try {
          await deleteConfigRecord();
        } catch (err) {
          setStatus(els.configRecordStatus, err.message, true);
        }
      });

      els.regenerateRouteBtn.addEventListener('click', setGeneratedRoutePath);
      els.routeName.addEventListener('input', setGeneratedRoutePath);
      els.addTargetBtn.addEventListener('click', () => addTargetRow(''));
      els.addHeaderBtn.addEventListener('click', () => addHeaderRow());

      if (!els.routePath.value) setGeneratedRoutePath();
      if (!els.targetRows.children.length) addTargetRow('');

      document.querySelectorAll('.app-nav a').forEach((link) => {
        link.addEventListener('click', (ev) => {
          if (!confirmDiscardConfigChanges('navigate away')) {
            ev.preventDefault();
          }
        });
      });

      window.addEventListener('beforeunload', (ev) => {
        if (!hasUnsavedConfigChanges()) return;
        ev.preventDefault();
        ev.returnValue = '';
      });

      els.extractFieldsBtn.addEventListener('click', () => {
        try {
          const raw = els.samplePayload.value.trim();
          if (!raw) throw new Error('Enter sample payload JSON first');
          const fields = extractIngressPathsFromRawPayload(raw);
          applyIngressDiscoveryState({ samplePayload: raw, ingressPaths: fields });
          if (!fields.length) {
            setStatus(els.ingressStatus, 'No leaf fields found in payload.');
          }
          renderMappingRows(readFieldMap());
        } catch (err) {
          setStatus(els.ingressStatus, err.message, true);
        }
      });

      els.clearFieldsBtn.addEventListener('click', () => {
        applyIngressDiscoveryState();
        setStatus(els.ingressStatus, 'Ingress fields cleared.');
        renderMappingRows(readFieldMap());
      });

      els.addDocRuleBtn.addEventListener('click', () => addDocRuleRow());
      renderDocumentationRules();

      document.getElementById('generateBtn').addEventListener('click', () => {
        try {
          const configEntry = generateConfig();
          const jsOutput = JSON.stringify(configEntry, null, 2)
            .replace(/"(process\.env\.[A-Za-z_][A-Za-z0-9_]*)"/g, '$1');
          els.output.value = jsOutput;
          autoResizeTextarea(els.output);
          setStatus(els.outputStatus, 'Config generated.');
        } catch (err) {
          setStatus(els.outputStatus, err.message, true);
        }
      });

      document.getElementById('copyBtn').addEventListener('click', async () => {
        try {
          if (!els.output.value.trim()) throw new Error('Generate config before copying');
          await navigator.clipboard.writeText(els.output.value);
          setStatus(els.outputStatus, 'Copied to clipboard.');
        } catch (err) {
          setStatus(els.outputStatus, err.message, true);
        }
      });
    };

    initialize();
  