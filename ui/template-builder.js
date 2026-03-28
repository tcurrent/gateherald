    const configuredApiBaseUrl = (
      window.GATEHERALD_API_BASE_URL
      || document.documentElement?.dataset?.apiBaseUrl
      || ''
    ).trim();
    const API_BASE_URL = configuredApiBaseUrl.replace(/\/+$/, '');
    const apiUrl = (apiPath) => `${API_BASE_URL}${apiPath}`;

    const state = {
      templateRecords: [],
      selectedTemplateRecordId: null,
      templateBaselineSnapshot: null
    };

    const els = {
      templateRecordSelect: document.getElementById('templateRecordSelect'),
      loadTemplateRecordBtn: document.getElementById('loadTemplateRecordBtn'),
      newTemplateRecordBtn: document.getElementById('newTemplateRecordBtn'),
      templateRecordName: document.getElementById('templateRecordName'),
      templateNeedsDocs: document.getElementById('templateNeedsDocs'),
      templateDocTargetFieldBlock: document.getElementById('templateDocTargetFieldBlock'),
      templateDocTargetField: document.getElementById('templateDocTargetField'),
      templateFieldsJson: document.getElementById('templateFieldsJson'),
      saveTemplateRecordBtn: document.getElementById('saveTemplateRecordBtn'),
      deleteTemplateRecordBtn: document.getElementById('deleteTemplateRecordBtn'),
      templateRecordStatus: document.getElementById('templateRecordStatus')
    };

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

    const initializeAutoResizeTextareas = () => {
      document.querySelectorAll('textarea').forEach((textarea) => {
        textarea.addEventListener('input', () => autoResizeTextarea(textarea));
        autoResizeTextarea(textarea);
      });
    };

    const captureTemplateFormSnapshot = () => {
      return JSON.stringify({
        name: els.templateRecordName.value || '',
        needsDocumentationRules: els.templateNeedsDocs.value || 'false',
        documentationTargetField: els.templateDocTargetField.value || '',
        fieldsJson: els.templateFieldsJson.value || ''
      });
    };

    const markTemplateClean = () => {
      state.templateBaselineSnapshot = captureTemplateFormSnapshot();
    };

    const hasUnsavedTemplateChanges = () => {
      if (state.templateBaselineSnapshot === null) return false;
      return captureTemplateFormSnapshot() !== state.templateBaselineSnapshot;
    };

    const confirmDiscardTemplateChanges = (actionLabel = 'continue') => {
      if (!hasUnsavedTemplateChanges()) return true;
      return window.confirm(`You have unsaved template changes. Discard them and ${actionLabel}?`);
    };

    const syncDocumentationTargetFieldVisibility = () => {
      const needsDocumentationRules = els.templateNeedsDocs.value === 'true';
      els.templateDocTargetFieldBlock.classList.toggle('hidden', !needsDocumentationRules);
    };

    const syncLoadTemplateButtonState = () => {
      els.loadTemplateRecordBtn.disabled = !els.templateRecordSelect.value;
    };

    const renderTemplateRecordSelect = () => {
      els.templateRecordSelect.replaceChildren();
      els.templateRecordSelect.appendChild(new Option('Select a template', ''));
      state.templateRecords.forEach((record) => {
        els.templateRecordSelect.appendChild(new Option(record.name, String(record.id)));
      });
      if (state.selectedTemplateRecordId) {
        els.templateRecordSelect.value = String(state.selectedTemplateRecordId);
      }
      syncLoadTemplateButtonState();
    };

    const loadTemplateRecords = async () => {
      const response = await fetch(apiUrl('/api/templates'));
      if (!response.ok) throw new Error('Failed to load template records');
      const payload = await response.json();
      state.templateRecords = payload.templates || [];
      renderTemplateRecordSelect();
    };

    const clearTemplateRecordForm = (skipUnsavedPrompt = false) => {
      if (!skipUnsavedPrompt && !confirmDiscardTemplateChanges('start a new template')) {
        return;
      }

      state.selectedTemplateRecordId = null;
      els.templateRecordSelect.value = '';
      syncLoadTemplateButtonState();
      els.templateRecordName.value = '';
      els.templateNeedsDocs.value = 'false';
      els.templateDocTargetField.value = '';
      syncDocumentationTargetFieldVisibility();
      els.templateFieldsJson.value = '{}';
      autoResizeTextarea(els.templateFieldsJson);
      setStatus(els.templateRecordStatus, 'Template form reset.');
      markTemplateClean();
    };

    const loadTemplateRecordIntoForm = () => {
      const id = Number(els.templateRecordSelect.value);
      if (!id) return;
      if (!confirmDiscardTemplateChanges('load another template')) {
        return;
      }

      const record = state.templateRecords.find((item) => item.id === id);
      if (!record) return;

      state.selectedTemplateRecordId = id;
      els.templateRecordName.value = record.name;
      els.templateNeedsDocs.value = record.needsDocumentationRules ? 'true' : 'false';
      els.templateDocTargetField.value = record.documentationTargetField || '';
      syncDocumentationTargetFieldVisibility();
      els.templateFieldsJson.value = JSON.stringify(record.fields || {}, null, 2);
      autoResizeTextarea(els.templateFieldsJson);
      setStatus(els.templateRecordStatus, `Loaded template '${record.name}'.`);
      markTemplateClean();
    };

    const saveTemplateRecord = async () => {
      const needsDocumentationRules = els.templateNeedsDocs.value === 'true';
      const fields = JSON.parse(els.templateFieldsJson.value || '{}');
      const payload = {
        name: els.templateRecordName.value.trim(),
        needsDocumentationRules,
        documentationTargetField: els.templateDocTargetField.value.trim() || null,
        fields
      };

      const isUpdate = Boolean(state.selectedTemplateRecordId);
      const url = isUpdate
        ? apiUrl(`/api/templates/${state.selectedTemplateRecordId}`)
        : apiUrl('/api/templates');
      const method = isUpdate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Failed to save template record');
      }

      const responsePayload = await response.json();
      state.selectedTemplateRecordId = responsePayload.template?.id || state.selectedTemplateRecordId;
      await loadTemplateRecords();
      setStatus(els.templateRecordStatus, isUpdate ? 'Template updated.' : 'Template created.');
      markTemplateClean();
    };

    const deleteTemplateRecord = async () => {
      if (!state.selectedTemplateRecordId) throw new Error('Select a template record first');
      if (!window.confirm('Delete this template record? This action cannot be undone.')) return;

      const response = await fetch(apiUrl(`/api/templates/${state.selectedTemplateRecordId}`), {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Failed to delete template record');
      }

      clearTemplateRecordForm(true);
      await loadTemplateRecords();
      setStatus(els.templateRecordStatus, 'Template deleted.');
    };

    const initialize = async () => {
      initializeAutoResizeTextareas();

      try {
        await loadTemplateRecords();
        clearTemplateRecordForm(true);
      } catch (err) {
        setStatus(els.templateRecordStatus, err.message, true);
      }

      els.templateRecordSelect.addEventListener('change', () => {
        state.selectedTemplateRecordId = Number(els.templateRecordSelect.value) || null;
        syncLoadTemplateButtonState();
      });
      els.templateNeedsDocs.addEventListener('change', syncDocumentationTargetFieldVisibility);
      els.loadTemplateRecordBtn.addEventListener('click', () => {
        try {
          loadTemplateRecordIntoForm();
        } catch (err) {
          setStatus(els.templateRecordStatus, err.message, true);
        }
      });
      els.newTemplateRecordBtn.addEventListener('click', () => clearTemplateRecordForm(false));
      els.saveTemplateRecordBtn.addEventListener('click', async () => {
        try {
          await saveTemplateRecord();
        } catch (err) {
          setStatus(els.templateRecordStatus, err.message, true);
        }
      });
      els.deleteTemplateRecordBtn.addEventListener('click', async () => {
        try {
          await deleteTemplateRecord();
        } catch (err) {
          setStatus(els.templateRecordStatus, err.message, true);
        }
      });

      document.querySelectorAll('.app-nav a').forEach((link) => {
        link.addEventListener('click', (ev) => {
          if (!confirmDiscardTemplateChanges('navigate away')) {
            ev.preventDefault();
          }
        });
      });

      window.addEventListener('beforeunload', (ev) => {
        if (!hasUnsavedTemplateChanges()) return;
        ev.preventDefault();
        ev.returnValue = '';
      });
    };

    initialize();
  