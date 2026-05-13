import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { config } from '../config';
import { DMSSign } from './DMSSignPlayground';

export default function DMSMessagingPanel({ selectedEvent, onClose }) {
  const [activeTab, setActiveTab] = useState('compose');
  const [templates, setTemplates] = useState([]);
  const [activations, setActivations] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVariables, setTemplateVariables] = useState([]);
  const [variableValues, setVariableValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [previewMessage, setPreviewMessage] = useState('');
  // editedMessage is the live, line-broken (\n) working copy the operator
  // sees on the board and can tweak in the textarea before activating.
  // isMessageDirty flips true once the operator types — that gates whether
  // variable-resolution overwrites their edits.
  const [editedMessage, setEditedMessage] = useState('');
  const [isMessageDirty, setIsMessageDirty] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const categories = [
    'all',
    'incident',
    'weather',
    'construction',
    'parking',
    'amber_alert',
    'queue_warning',
    'detour',
    'special_event',
    'speed_limit',
    'lane_closure'
  ];

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
    if (selectedEvent) {
      fetchActivations();
    }
  }, [selectedEvent]);

  // Update preview when template or variables change. Templates store lines
  // separated by '/' — convert to '\n' for the board and the textarea.
  useEffect(() => {
    let resolved = '';
    if (selectedTemplate && templateVariables.length > 0) {
      let message = selectedTemplate.message_text;
      Object.entries(variableValues).forEach(([varName, varValue]) => {
        message = message.replace(`{{${varName}}}`, varValue || `{{${varName}}}`);
      });
      resolved = message;
    } else if (selectedTemplate) {
      resolved = selectedTemplate.message_text;
    }
    setPreviewMessage(resolved);
    // Don't clobber the operator's manual edits when variables change.
    if (!isMessageDirty) {
      setEditedMessage(resolved.split('/').map(l => l.trim()).join('\n'));
    }
  }, [selectedTemplate, variableValues, templateVariables, isMessageDirty]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== 'all') {
        params.append('category', filterCategory);
      }
      params.append('approval_status', 'approved');

      const response = await fetch(`${config.apiUrl}/api/dms/templates?${params}`);
      const data = await response.json();

      if (data.success) {
        setTemplates(data.templates);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch DMS templates');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivations = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedEvent) {
        params.append('event_id', selectedEvent.id);
      }
      params.append('limit', '50');

      const response = await fetch(`${config.apiUrl}/api/dms/activations?${params}`);
      const data = await response.json();

      if (data.success) {
        setActivations(data.activations);
      }
    } catch (err) {
      console.error('Failed to fetch activations:', err);
    }
  };

  const selectTemplate = async (template) => {
    setSelectedTemplate(template);
    setVariableValues({});
    setIsMessageDirty(false);
    setNewTemplateName('');

    // Fetch template variables
    try {
      const response = await fetch(`${config.apiUrl}/api/dms/templates/${template.id}`);
      const data = await response.json();

      if (data.success) {
        setTemplateVariables(data.variables);

        // Initialize variable values with example values
        const initialValues = {};
        data.variables.forEach(variable => {
          initialValues[variable.variable_name] = variable.example_value || '';
        });
        setVariableValues(initialValues);
      }
    } catch (err) {
      console.error('Failed to fetch template variables:', err);
    }
  };

  // Persist the operator's edited message as a new draft template. Uses
  // the currently-selected template's category as a sensible default, or
  // 'incident' when starting from scratch. Saves message_text in the
  // '/' line-separator format the backend expects.
  const saveAsNewTemplate = async () => {
    const name = newTemplateName.trim();
    if (!name) {
      setError('Give the new template a name first');
      return;
    }
    const messageText = editedMessage
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .join(' / ');
    if (!messageText) {
      setError('Message is empty');
      return;
    }
    setSavingTemplate(true);
    setError(null);
    try {
      const response = await fetch(`${config.apiUrl}/api/dms/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_name: name,
          template_category: selectedTemplate?.template_category || (filterCategory !== 'all' ? filterCategory : 'incident'),
          message_text: messageText,
          char_limit: selectedTemplate?.char_limit || 3,
          mutcd_compliant: true
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(`Saved as draft template "${name}". It will appear in the list once approved.`);
        setNewTemplateName('');
        setIsMessageDirty(false);
        fetchTemplates();
      } else {
        setError(data.error || 'Failed to save template');
      }
    } catch (err) {
      setError('Failed to save template');
      console.error(err);
    } finally {
      setSavingTemplate(false);
    }
  };

  const activateMessage = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    setError(null);

    try {
      // If the operator edited the message text, send it as custom_message so
      // the backend skips variable substitution and uses their version verbatim.
      const customMessage = isMessageDirty
        ? editedMessage.split('\n').map(l => l.trim()).filter(Boolean).join(' / ')
        : undefined;

      const response = await fetch(`${config.apiUrl}/api/dms/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          event_id: selectedEvent?.id,
          variable_values: variableValues,
          custom_message: customMessage,
          states_to_notify: selectedEvent?.nearbyStates || []
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`DMS message activated:\n\n${data.final_message}`);
        setSelectedTemplate(null);
        setVariableValues({});
        setIsMessageDirty(false);
        setEditedMessage('');
        setActiveTab('history');
        fetchActivations();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to activate DMS message');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      incident: '#ef4444',
      weather: '#FF8F35',
      construction: '#f59e0b',
      parking: '#8b5cf6',
      amber_alert: '#dc2626',
      queue_warning: '#f97316',
      detour: '#06b6d4',
      special_event: '#10b981',
      speed_limit: '#6366f1',
      lane_closure: '#f59e0b'
    };
    return colors[category] || '#6b7280';
  };

  return (
    <div style={{ padding: '24px', minHeight: '100%', backgroundColor: '#f9fafb' }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxWidth: '1152px',
        margin: '0 auto',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(to right, #F08230, #C66A1F)',
          color: 'white',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: 0
              }}>
                <svg style={{ width: '28px', height: '28px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                DMS Messaging System
              </h2>
              <p style={{ color: '#bfdbfe', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>
                CCAI-Aligned Dynamic Message Sign Coordination
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                color: 'white',
                background: 'none',
                border: 'none',
                borderRadius: '50%',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 143, 53,0.5)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {selectedEvent && (
            <div style={{
              marginTop: '16px',
              backgroundColor: 'rgba(255, 143, 53,0.3)',
              borderRadius: '4px',
              padding: '12px',
              fontSize: '14px'
            }}>
              <strong>Active Event:</strong> {selectedEvent.title || selectedEvent.description?.substring(0, 60)}
              {' '} - {selectedEvent.state}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
          <button
            onClick={() => setActiveTab('compose')}
            style={{
              padding: '12px 24px',
              fontWeight: '500',
              transition: 'color 0.2s',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              ...(activeTab === 'compose'
                ? { borderBottom: '2px solid #F08230', color: '#F08230', backgroundColor: 'white' }
                : { color: '#4b5563' })
            }}
          >
            Compose & Preview ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '12px 24px',
              fontWeight: '500',
              transition: 'color 0.2s',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              ...(activeTab === 'history'
                ? { borderBottom: '2px solid #F08230', color: '#F08230', backgroundColor: 'white' }
                : { color: '#4b5563' })
            }}
          >
            Activation History ({activations.length})
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {error && (
            <div style={{
              marginBottom: '16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '12px 16px',
              borderRadius: '4px'
            }}>
              {error}
            </div>
          )}

          {activeTab === 'compose' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '24px'
            }}>
              {/* Template List */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Templates {filterCategory !== 'all' && `(${filterCategory.replace(/_/g, ' ').toUpperCase()})`}
                </label>
                <div style={{ maxHeight: '560px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {loading && (
                    <div style={{ textAlign: 'center', padding: '16px', color: '#6b7280' }}>
                      Loading templates...
                    </div>
                  )}

                  {!loading && templates.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
                      No templates found for this category
                    </div>
                  )}

                  {templates.map(template => {
                    // Show the template's message rendered on a mini DMS board
                    // so the operator can recognize it visually, not just by
                    // name. Variables like {{delay}} stay as placeholders here
                    // — the right-side composer is where they get filled in.
                    const boardText = (template.message_text || '')
                      .split('/')
                      .map(l => l.trim())
                      .join('\n');
                    return (
                      <button
                        key={template.id}
                        onClick={() => selectTemplate(template)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px',
                          borderRadius: '8px',
                          border: selectedTemplate?.id === template.id
                            ? '1px solid #FF8F35'
                            : '1px solid #e5e7eb',
                          backgroundColor: selectedTemplate?.id === template.id ? '#eff6ff' : 'white',
                          boxShadow: selectedTemplate?.id === template.id
                            ? '0 4px 6px -1px rgba(0,0,0,0.1)'
                            : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '500',
                              color: 'white',
                              backgroundColor: getCategoryColor(template.template_category)
                            }}
                          >
                            {template.template_category.toUpperCase()}
                          </span>
                          {template.mutcd_compliant && (
                            <span style={{
                              padding: '4px 8px',
                              backgroundColor: '#dcfce7',
                              color: '#166534',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}>
                              MUTCD
                            </span>
                          )}
                          <h4 style={{ fontWeight: '600', color: '#111827', margin: 0, fontSize: '14px' }}>
                            {template.template_name}
                          </h4>
                        </div>
                        <DMSSign message={boardText} compact />
                        {template.usage_count > 0 && (
                          <div style={{ marginTop: '6px', fontSize: '11px', color: '#6b7280' }}>
                            Used {template.usage_count} times
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Template Preview & Activation */}
              <div>
                <div style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  padding: '24px',
                  border: '1px solid #e5e7eb'
                }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px', marginTop: 0 }}>
                    Message Composer
                  </h3>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Filter by Category
                    </label>
                    <select
                      value={filterCategory}
                      onChange={(e) => {
                        setFilterCategory(e.target.value);
                        setTimeout(() => fetchTemplates(), 0);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        fontSize: '14px',
                        color: '#111827',
                        backgroundColor: 'white'
                      }}
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>
                          {cat === 'all' ? 'All Categories' : cat.replace(/_/g, ' ').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Template
                    </label>
                    <select
                      value={selectedTemplate?.id || ''}
                      onChange={(e) => {
                        const tpl = templates.find(t => String(t.id) === e.target.value);
                        if (tpl) selectTemplate(tpl);
                      }}
                      disabled={templates.length === 0}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        fontSize: '14px',
                        color: '#111827',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="" disabled>
                        {templates.length === 0 ? 'No templates available' : 'Select a template…'}
                      </option>
                      {templates.map(tpl => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.template_category.toUpperCase()} — {tpl.template_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTemplate ? (
                    <>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '8px'
                      }}>
                        Selected
                      </label>
                      <div style={{
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        padding: '12px',
                        fontSize: '14px'
                      }}>
                        {selectedTemplate.template_name}
                      </div>
                    </div>

                    {templateVariables.length > 0 && (
                      <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label style={{
                          display: 'block',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#374151'
                        }}>
                          Message Variables
                        </label>
                        {templateVariables.map(variable => (
                          <div key={variable.id}>
                            <label style={{
                              display: 'block',
                              fontSize: '12px',
                              color: '#4b5563',
                              marginBottom: '4px'
                            }}>
                              {variable.variable_name}
                              {variable.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                              <span style={{ color: '#9ca3af', marginLeft: '8px' }}>({variable.variable_type})</span>
                            </label>
                            <input
                              type="text"
                              value={variableValues[variable.variable_name] || ''}
                              onChange={(e) => setVariableValues({
                                ...variableValues,
                                [variable.variable_name]: e.target.value
                              })}
                              placeholder={variable.example_value}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '8px'
                      }}>
                        Message Preview {isMessageDirty && <span style={{ fontSize: '11px', color: '#a55e10', marginLeft: '6px' }}>(edited)</span>}
                      </label>
                      {/* Live board — renders whatever's currently in the
                          textarea so the operator sees their edits land on
                          the sign in real time. */}
                      <DMSSign message={editedMessage} />
                      <textarea
                        value={editedMessage}
                        onChange={(e) => {
                          setEditedMessage(e.target.value.toUpperCase());
                          setIsMessageDirty(true);
                        }}
                        spellCheck={false}
                        rows={4}
                        style={{
                          width: '100%',
                          marginTop: '8px',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                          fontSize: '13px',
                          lineHeight: 1.5,
                          letterSpacing: '0.02em',
                          resize: 'vertical',
                          boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                          Character limit: {selectedTemplate.char_limit} lines · one line per row
                        </p>
                        {isMessageDirty && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsMessageDirty(false);
                              setEditedMessage(previewMessage.split('/').map(l => l.trim()).join('\n'));
                            }}
                            style={{
                              fontSize: '12px',
                              color: '#4b5563',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: 'underline'
                            }}
                          >
                            Reset to template
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Save-as-new-template — lets the operator persist their
                        edited version as a draft for later approval/reuse. */}
                    {isMessageDirty && (
                      <div style={{
                        marginBottom: '16px',
                        padding: '12px',
                        backgroundColor: '#fff7ed',
                        border: '1px solid #fed7aa',
                        borderRadius: '6px'
                      }}>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: '500',
                          color: '#9a3412',
                          marginBottom: '6px'
                        }}>
                          Save this version as a new template
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            placeholder="Template name"
                            style={{
                              flex: 1,
                              padding: '8px 10px',
                              border: '1px solid #fed7aa',
                              borderRadius: '4px',
                              fontSize: '13px',
                              boxSizing: 'border-box'
                            }}
                          />
                          <button
                            type="button"
                            onClick={saveAsNewTemplate}
                            disabled={savingTemplate || !newTemplateName.trim()}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#F08230',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontWeight: '500',
                              cursor: (savingTemplate || !newTemplateName.trim()) ? 'not-allowed' : 'pointer',
                              opacity: (savingTemplate || !newTemplateName.trim()) ? 0.5 : 1,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {savingTemplate ? 'Saving…' : 'Save draft'}
                          </button>
                        </div>
                        <p style={{ fontSize: '11px', color: '#9a3412', margin: '6px 0 0' }}>
                          New templates are saved as drafts and appear after approval.
                        </p>
                      </div>
                    )}

                    <button
                      onClick={activateMessage}
                      disabled={loading}
                      style={{
                        width: '100%',
                        backgroundColor: '#F08230',
                        color: 'white',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        fontWeight: '500',
                        border: 'none',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.5 : 1,
                        transition: 'background-color 0.2s',
                        fontSize: '16px'
                      }}
                      onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#C66A1F'; }}
                      onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#F08230'; }}
                    >
                      {loading ? 'Activating...' : 'Activate DMS Message'}
                    </button>

                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '12px' }}>
                      This will send the message to the selected DMS devices and notify adjacent states.
                    </p>
                    </>
                  ) : (
                    <div style={{
                      borderRadius: '8px',
                      padding: '32px',
                      textAlign: 'center',
                      border: '2px dashed #d1d5db',
                      backgroundColor: 'white'
                    }}>
                      <svg style={{ width: '48px', height: '48px', margin: '0 auto 12px', color: '#9ca3af', display: 'block' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      <p style={{ color: '#4b5563', margin: 0 }}>
                        Pick a category and template above to see it on the board
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                  <svg style={{ width: '64px', height: '64px', margin: '0 auto 16px', color: '#d1d5db', display: 'block' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>No DMS messages have been activated yet</p>
                </div>
              ) : (
                activations.map(activation => (
                  <div key={activation.id} style={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontWeight: '600', color: '#111827', margin: 0 }}>
                          {activation.template_name || 'Custom Message'}
                        </h4>
                        {activation.template_category && (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '500',
                              color: 'white',
                              marginTop: '4px',
                              backgroundColor: getCategoryColor(activation.template_category)
                            }}
                          >
                            {activation.template_category.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '14px', color: '#6b7280' }}>
                        {formatDistanceToNow(new Date(activation.activated_at), { addSuffix: true })}
                      </div>
                    </div>

                    <div style={{
                      backgroundColor: '#111827',
                      color: '#facc15',
                      fontFamily: 'monospace',
                      textAlign: 'center',
                      padding: '16px',
                      borderRadius: '4px',
                      margin: '12px 0',
                      fontSize: '14px'
                    }}>
                      {activation.final_message}
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '16px',
                      fontSize: '14px'
                    }}>
                      <div>
                        <span style={{ color: '#4b5563' }}>Activated by:</span>
                        <span style={{ marginLeft: '8px', fontWeight: '500' }}>{activation.activated_by}</span>
                      </div>
                      {activation.dms_device_id && (
                        <div>
                          <span style={{ color: '#4b5563' }}>Device:</span>
                          <span style={{ marginLeft: '8px', fontWeight: '500' }}>{activation.dms_device_id}</span>
                        </div>
                      )}
                      {activation.states_notified && activation.states_notified.length > 0 && (
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ color: '#4b5563' }}>States notified:</span>
                          <span style={{ marginLeft: '8px', fontWeight: '500' }}>{activation.states_notified.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    {!activation.deactivated_at && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 8px',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            backgroundColor: '#22c55e',
                            borderRadius: '50%',
                            marginRight: '8px',
                            display: 'inline-block'
                          }}></span>
                          Active
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '14px',
            color: '#4b5563'
          }}>
            <div>
              <strong>CCAI UC #2:</strong> Coordinated DMS Messaging
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#d1d5db'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#e5e7eb'}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
