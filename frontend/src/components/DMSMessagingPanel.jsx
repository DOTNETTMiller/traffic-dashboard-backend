import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { config } from '../config';

export default function DMSMessagingPanel({ selectedEvent, onClose }) {
  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [activations, setActivations] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVariables, setTemplateVariables] = useState([]);
  const [variableValues, setVariableValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [previewMessage, setPreviewMessage] = useState('');

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

  // Update preview when template or variables change
  useEffect(() => {
    if (selectedTemplate && templateVariables.length > 0) {
      let message = selectedTemplate.message_text;
      Object.entries(variableValues).forEach(([varName, varValue]) => {
        message = message.replace(`{{${varName}}}`, varValue || `{{${varName}}}`);
      });
      setPreviewMessage(message);
    } else if (selectedTemplate) {
      setPreviewMessage(selectedTemplate.message_text);
    }
  }, [selectedTemplate, variableValues, templateVariables]);

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

  const activateMessage = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/api/dms/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          event_id: selectedEvent?.id,
          variable_values: variableValues,
          states_to_notify: selectedEvent?.nearbyStates || []
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`DMS message activated:\n\n${data.final_message}`);
        setSelectedTemplate(null);
        setVariableValues({});
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
      weather: '#3b82f6',
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
          background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
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
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.5)'}
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
              backgroundColor: 'rgba(59,130,246,0.3)',
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
            onClick={() => setActiveTab('templates')}
            style={{
              padding: '12px 24px',
              fontWeight: '500',
              transition: 'color 0.2s',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              ...(activeTab === 'templates'
                ? { borderBottom: '2px solid #2563eb', color: '#2563eb', backgroundColor: 'white' }
                : { color: '#4b5563' })
            }}
          >
            Message Templates ({templates.length})
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
                ? { borderBottom: '2px solid #2563eb', color: '#2563eb', backgroundColor: 'white' }
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

          {activeTab === 'templates' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '24px'
            }}>
              {/* Template List */}
              <div>
                <div style={{ marginBottom: '16px' }}>
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

                <div style={{ maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

                  {templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => selectTemplate(template)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '16px',
                        borderRadius: '8px',
                        border: selectedTemplate?.id === template.id
                          ? '1px solid #3b82f6'
                          : '1px solid #e5e7eb',
                        backgroundColor: selectedTemplate?.id === template.id ? '#eff6ff' : 'white',
                        boxShadow: selectedTemplate?.id === template.id
                          ? '0 4px 6px -1px rgba(0,0,0,0.1)'
                          : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1 }}>
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
                          </div>
                          <h4 style={{ fontWeight: '600', color: '#111827', marginBottom: '4px', margin: '0 0 4px 0' }}>
                            {template.template_name}
                          </h4>
                          <p style={{ fontSize: '14px', color: '#4b5563', fontFamily: 'monospace', margin: 0 }}>
                            {template.message_text}
                          </p>
                          <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                            {template.usage_count > 0 && (
                              <span>Used {template.usage_count} times</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Preview & Activation */}
              <div>
                {selectedTemplate ? (
                  <div style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    padding: '24px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px', marginTop: 0 }}>
                      Message Composer
                    </h3>

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
                        Message Preview
                      </label>
                      <div style={{
                        backgroundColor: '#111827',
                        color: '#facc15',
                        fontFamily: 'monospace',
                        textAlign: 'center',
                        padding: '24px',
                        borderRadius: '4px',
                        border: '4px solid #374151'
                      }}>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', lineHeight: '1.25' }}>
                          {previewMessage.split('/').map((line, i) => (
                            <div key={i}>{line.trim()}</div>
                          ))}
                        </div>
                      </div>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                        Character limit: {selectedTemplate.char_limit} lines
                      </p>
                    </div>

                    <button
                      onClick={activateMessage}
                      disabled={loading}
                      style={{
                        width: '100%',
                        backgroundColor: '#2563eb',
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
                      onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                      onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                    >
                      {loading ? 'Activating...' : 'Activate DMS Message'}
                    </button>

                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '12px' }}>
                      This will send the message to the selected DMS devices and notify adjacent states.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    padding: '48px',
                    textAlign: 'center',
                    border: '2px dashed #d1d5db'
                  }}>
                    <svg style={{ width: '64px', height: '64px', margin: '0 auto 16px', color: '#9ca3af', display: 'block' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <p style={{ color: '#4b5563' }}>
                      Select a template to preview and activate
                    </p>
                  </div>
                )}
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
