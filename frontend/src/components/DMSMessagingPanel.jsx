import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import config from '../config';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                DMS Messaging System
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                CCAI-Aligned Dynamic Message Sign Coordination
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-blue-500 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {selectedEvent && (
            <div className="mt-4 bg-blue-500 bg-opacity-30 rounded p-3 text-sm">
              <strong>Active Event:</strong> {selectedEvent.title || selectedEvent.description?.substring(0, 60)}
              {' '} - {selectedEvent.state}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'templates'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Message Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'history'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Activation History ({activations.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Template List */}
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Category
                  </label>
                  <select
                    value={filterCategory}
                    onChange={(e) => {
                      setFilterCategory(e.target.value);
                      setTimeout(() => fetchTemplates(), 0);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat === 'all' ? 'All Categories' : cat.replace(/_/g, ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {loading && <div className="text-center py-4 text-gray-500">Loading templates...</div>}

                  {!loading && templates.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No templates found for this category
                    </div>
                  )}

                  {templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => selectTemplate(template)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        selectedTemplate?.id === template.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="px-2 py-1 rounded text-xs font-medium text-white"
                              style={{ backgroundColor: getCategoryColor(template.template_category) }}
                            >
                              {template.template_category.toUpperCase()}
                            </span>
                            {template.mutcd_compliant && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                MUTCD
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-gray-900 mb-1">
                            {template.template_name}
                          </h4>
                          <p className="text-sm text-gray-600 font-mono">
                            {template.message_text}
                          </p>
                          <div className="mt-2 text-xs text-gray-500">
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
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Message Composer
                    </h3>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Template
                      </label>
                      <div className="bg-white border border-gray-300 rounded p-3 text-sm">
                        {selectedTemplate.template_name}
                      </div>
                    </div>

                    {templateVariables.length > 0 && (
                      <div className="mb-4 space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Message Variables
                        </label>
                        {templateVariables.map(variable => (
                          <div key={variable.id}>
                            <label className="block text-xs text-gray-600 mb-1">
                              {variable.variable_name}
                              {variable.required && <span className="text-red-500 ml-1">*</span>}
                              <span className="text-gray-400 ml-2">({variable.variable_type})</span>
                            </label>
                            <input
                              type="text"
                              value={variableValues[variable.variable_name] || ''}
                              onChange={(e) => setVariableValues({
                                ...variableValues,
                                [variable.variable_name]: e.target.value
                              })}
                              placeholder={variable.example_value}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Message Preview
                      </label>
                      <div className="bg-gray-900 text-yellow-400 font-mono text-center p-6 rounded border-4 border-gray-700">
                        <div className="text-xl font-bold leading-tight">
                          {previewMessage.split('/').map((line, i) => (
                            <div key={i}>{line.trim()}</div>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Character limit: {selectedTemplate.char_limit} lines
                      </p>
                    </div>

                    <button
                      onClick={activateMessage}
                      disabled={loading}
                      className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Activating...' : 'Activate DMS Message'}
                    </button>

                    <p className="text-xs text-gray-500 mt-3">
                      This will send the message to the selected DMS devices and notify adjacent states.
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-12 text-center border-2 border-dashed border-gray-300">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <p className="text-gray-600">
                      Select a template to preview and activate
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {activations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>No DMS messages have been activated yet</p>
                </div>
              ) : (
                activations.map(activation => (
                  <div key={activation.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {activation.template_name || 'Custom Message'}
                        </h4>
                        {activation.template_category && (
                          <span
                            className="inline-block px-2 py-1 rounded text-xs font-medium text-white mt-1"
                            style={{ backgroundColor: getCategoryColor(activation.template_category) }}
                          >
                            {activation.template_category.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        {formatDistanceToNow(new Date(activation.activated_at), { addSuffix: true })}
                      </div>
                    </div>

                    <div className="bg-gray-900 text-yellow-400 font-mono text-center p-4 rounded my-3 text-sm">
                      {activation.final_message}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Activated by:</span>
                        <span className="ml-2 font-medium">{activation.activated_by}</span>
                      </div>
                      {activation.dms_device_id && (
                        <div>
                          <span className="text-gray-600">Device:</span>
                          <span className="ml-2 font-medium">{activation.dms_device_id}</span>
                        </div>
                      )}
                      {activation.states_notified && activation.states_notified.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-gray-600">States notified:</span>
                          <span className="ml-2 font-medium">{activation.states_notified.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    {!activation.deactivated_at && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
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
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <strong>CCAI UC #2:</strong> Coordinated DMS Messaging
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
