import { useState, useEffect } from 'react';
import { theme } from '../styles/theme';

/**
 * Buffer recommendations by event type
 */
const BUFFER_RECOMMENDATIONS = {
  construction: { buffer: 2.0, reason: 'affects larger area' },
  incident: { buffer: 0.75, reason: 'immediate localized impact' },
  crash: { buffer: 0.75, reason: 'immediate localized impact' },
  closure: { buffer: 1.5, reason: 'requires detour planning' },
  'road closure': { buffer: 1.5, reason: 'requires detour planning' },
  weather: { buffer: 3.0, reason: 'broad geographic impact' },
  hazmat: { buffer: 2.5, reason: 'safety perimeter needed' },
  restriction: { buffer: 1.0, reason: 'moderate traffic impact' },
  maintenance: { buffer: 1.25, reason: 'planned moderate impact' },
  'bridge closure': { buffer: 2.0, reason: 'significant detour needed' },
  default: { buffer: 1.0, reason: 'standard buffer' }
};

/**
 * Get buffer recommendation for event type
 */
function getBufferRecommendation(eventType) {
  const type = eventType.toLowerCase().trim();

  // Direct match
  if (BUFFER_RECOMMENDATIONS[type]) {
    return BUFFER_RECOMMENDATIONS[type];
  }

  // Partial match
  for (const [key, value] of Object.entries(BUFFER_RECOMMENDATIONS)) {
    if (key !== 'default' && (type.includes(key) || key.includes(type))) {
      return value;
    }
  }

  return BUFFER_RECOMMENDATIONS.default;
}

/**
 * IPAWS Rules Configuration Component
 *
 * Allows TMC operators to configure automated IPAWS alert rules
 *
 * Features:
 * - Trigger conditions (corridor, event type, lanes affected, severity)
 * - Custom geofence configuration
 * - Population density filtering
 * - Auto-approval settings
 */
export default function IPAWSRulesConfig({ onClose }) {
  const [rules, setRules] = useState([]);
  const [editingRule, setEditingRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddRule, setShowAddRule] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ipaws/rules');
      const data = await response.json();
      setRules(data.rules || []);
    } catch (error) {
      console.error('Error loading IPAWS rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async (rule) => {
    try {
      const method = rule.id ? 'PUT' : 'POST';
      const url = rule.id ? `/api/ipaws/rules/${rule.id}` : '/api/ipaws/rules';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });

      if (response.ok) {
        await loadRules();
        setShowAddRule(false);
        setEditingRule(null);
      }
    } catch (error) {
      console.error('Error saving rule:', error);
    }
  };

  const deleteRule = async (ruleId) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await fetch(`/api/ipaws/rules/${ruleId}`, { method: 'DELETE' });
      await loadRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const toggleRuleEnabled = async (rule) => {
    await saveRule({ ...rule, enabled: !rule.enabled });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: theme.spacing.lg
    }}>
      <div style={{
        backgroundColor: theme.colors.gray[900],
        borderRadius: '16px',
        border: `1px solid ${theme.colors.border}`,
        width: '100%',
        maxWidth: '1200px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: theme.shadows.xl
      }}>
        {/* Header */}
        <div style={{
          padding: theme.spacing.lg,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              color: theme.colors.gray[100],
              fontSize: '24px',
              marginBottom: theme.spacing.xs
            }}>
              IPAWS Alert Rules
            </h2>
            <div style={{
              fontSize: '14px',
              color: theme.colors.gray[400]
            }}>
              Configure automated alert triggers based on event conditions
            </div>
          </div>
          <div style={{ display: 'flex', gap: theme.spacing.sm }}>
            <button
              onClick={() => setShowAddRule(true)}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                background: theme.colors.gradients.primary,
                border: 'none',
                borderRadius: '8px',
                color: '#111827',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: `all ${theme.transitions.fast}`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = theme.shadows.lg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              ➕ Add Rule
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: theme.colors.gray[400],
                fontSize: '24px',
                cursor: 'pointer',
                padding: theme.spacing.sm,
                borderRadius: '8px',
                transition: `all ${theme.transitions.fast}`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray[800];
                e.currentTarget.style.color = theme.colors.gray[100];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.gray[400];
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Rules List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: theme.spacing.lg
        }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              color: theme.colors.gray[400],
              padding: theme.spacing.xl
            }}>
              Loading rules...
            </div>
          ) : rules.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: theme.colors.gray[400],
              padding: theme.spacing.xl
            }}>
              <div style={{ fontSize: '48px', marginBottom: theme.spacing.md }}>📋</div>
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: theme.spacing.sm }}>
                No rules configured
              </div>
              <div style={{ fontSize: '14px' }}>
                Click "Add Rule" to create your first automated IPAWS alert rule
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: theme.spacing.md }}>
              {rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onEdit={() => {
                    setEditingRule(rule);
                    setShowAddRule(true);
                  }}
                  onDelete={() => deleteRule(rule.id)}
                  onToggle={() => toggleRuleEnabled(rule)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Rule Modal */}
      {showAddRule && (
        <RuleEditor
          rule={editingRule}
          onSave={(rule) => saveRule(rule)}
          onClose={() => {
            setShowAddRule(false);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
}

function RuleCard({ rule, onEdit, onDelete, onToggle }) {
  return (
    <div style={{
      background: theme.colors.gray[800],
      border: `1px solid ${theme.colors.border}`,
      borderLeft: `4px solid ${rule.enabled ? theme.colors.success.main : theme.colors.gray[600]}`,
      borderRadius: '12px',
      padding: theme.spacing.lg,
      transition: `all ${theme.transitions.fast}`
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'start',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.md
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.xs
          }}>
            <h3 style={{
              margin: 0,
              color: theme.colors.gray[100],
              fontSize: '18px',
              fontWeight: '700'
            }}>
              {rule.name}
            </h3>
            <span style={{
              padding: '4px 10px',
              borderRadius: '12px',
              background: rule.enabled ? `${theme.colors.success.main}20` : `${theme.colors.gray[600]}20`,
              border: `1px solid ${rule.enabled ? theme.colors.success.main : theme.colors.gray[600]}`,
              fontSize: '11px',
              fontWeight: '700',
              color: rule.enabled ? theme.colors.success.main : theme.colors.gray[400],
              textTransform: 'uppercase'
            }}>
              {rule.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <p style={{
            margin: 0,
            color: theme.colors.gray[400],
            fontSize: '14px'
          }}>
            {rule.description}
          </p>
        </div>

        <div style={{ display: 'flex', gap: theme.spacing.xs }}>
          <button
            onClick={onToggle}
            style={{
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              background: theme.colors.gray[700],
              border: 'none',
              borderRadius: '6px',
              color: theme.colors.gray[300],
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: `all ${theme.transitions.fast}`
            }}
            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
          >
            {rule.enabled ? '⏸️' : '▶️'}
          </button>
          <button
            onClick={onEdit}
            style={{
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              background: theme.colors.gray[700],
              border: 'none',
              borderRadius: '6px',
              color: theme.colors.gray[300],
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: `all ${theme.transitions.fast}`
            }}
          >
            ✏️ Edit
          </button>
          <button
            onClick={onDelete}
            style={{
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              background: `${theme.colors.error.main}20`,
              border: `1px solid ${theme.colors.error.main}`,
              borderRadius: '6px',
              color: theme.colors.error.main,
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: `all ${theme.transitions.fast}`
            }}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Rule Conditions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.md
      }}>
        {rule.conditions.corridors && rule.conditions.corridors.length > 0 && (
          <ConditionBadge
            label="Corridors"
            value={rule.conditions.corridors.join(', ')}
            icon="🛣️"
          />
        )}
        {rule.conditions.eventTypes && rule.conditions.eventTypes.length > 0 && (
          <ConditionBadge
            label="Event Types"
            value={rule.conditions.eventTypes.join(', ')}
            icon="⚠️"
          />
        )}
        {rule.conditions.minLanesAffected && (
          <ConditionBadge
            label="Lanes Affected"
            value={`≥ ${rule.conditions.minLanesAffected}`}
            icon="🚗"
          />
        )}
        {rule.conditions.severity && rule.conditions.severity.length > 0 && (
          <ConditionBadge
            label="Severity"
            value={rule.conditions.severity.join(', ')}
            icon="📊"
          />
        )}
      </div>

      {/* Geofence & Population Settings */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: theme.spacing.sm
      }}>
        <div style={{
          padding: theme.spacing.sm,
          background: theme.colors.gray[900],
          borderRadius: '8px'
        }}>
          <div style={{
            fontSize: '11px',
            color: theme.colors.gray[500],
            marginBottom: '2px'
          }}>
            Geofence Type
          </div>
          <div style={{
            fontSize: '13px',
            color: theme.colors.gray[200],
            fontWeight: '600'
          }}>
            {rule.geofenceConfig.type === 'auto' ? '🤖 Auto-generate' : '📍 Custom'}
          </div>
        </div>
        <div style={{
          padding: theme.spacing.sm,
          background: theme.colors.gray[900],
          borderRadius: '8px'
        }}>
          <div style={{
            fontSize: '11px',
            color: theme.colors.gray[500],
            marginBottom: '2px'
          }}>
            Max Population
          </div>
          <div style={{
            fontSize: '13px',
            color: theme.colors.gray[200],
            fontWeight: '600'
          }}>
            {rule.populationConfig.maxPopulation.toLocaleString()}
          </div>
        </div>
        <div style={{
          padding: theme.spacing.sm,
          background: theme.colors.gray[900],
          borderRadius: '8px'
        }}>
          <div style={{
            fontSize: '11px',
            color: theme.colors.gray[500],
            marginBottom: '2px'
          }}>
            Approval
          </div>
          <div style={{
            fontSize: '13px',
            color: theme.colors.gray[200],
            fontWeight: '600'
          }}>
            {rule.requiresApproval ? '👤 Manual' : '⚡ Auto'}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConditionBadge({ label, value, icon }) {
  return (
    <div style={{
      padding: theme.spacing.sm,
      background: theme.colors.gray[900],
      borderRadius: '8px',
      border: `1px solid ${theme.colors.gray[700]}`
    }}>
      <div style={{
        fontSize: '11px',
        color: theme.colors.gray[500],
        marginBottom: '2px'
      }}>
        {icon} {label}
      </div>
      <div style={{
        fontSize: '13px',
        color: theme.colors.gray[200],
        fontWeight: '600'
      }}>
        {value}
      </div>
    </div>
  );
}

function RuleEditor({ rule, onSave, onClose }) {
  const [formData, setFormData] = useState(rule || {
    name: '',
    description: '',
    enabled: true,
    conditions: {
      corridors: [],
      eventTypes: [],
      severity: [],
      minLanesAffected: null,
      maxLanesAffected: null
    },
    geofenceConfig: {
      type: 'auto',
      bufferMiles: 1,
      customPolygon: null
    },
    populationConfig: {
      maxPopulation: 5000,
      excludeUrbanAreas: true,
      minPopulationDensity: 0
    },
    requiresApproval: false
  });

  const [corridorInput, setCorridorInput] = useState('');
  const [eventTypeInput, setEventTypeInput] = useState('');

  const updateField = (path, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const addCorridor = () => {
    if (!corridorInput.trim()) return;
    updateField('conditions.corridors', [...formData.conditions.corridors, corridorInput.trim()]);
    setCorridorInput('');
  };

  const removeCorridor = (index) => {
    const newCorridors = formData.conditions.corridors.filter((_, i) => i !== index);
    updateField('conditions.corridors', newCorridors);
  };

  const addEventType = () => {
    if (!eventTypeInput.trim()) return;
    updateField('conditions.eventTypes', [...formData.conditions.eventTypes, eventTypeInput.trim()]);
    setEventTypeInput('');
  };

  const removeEventType = (index) => {
    const newTypes = formData.conditions.eventTypes.filter((_, i) => i !== index);
    updateField('conditions.eventTypes', newTypes);
  };

  const toggleSeverity = (sev) => {
    const current = formData.conditions.severity || [];
    const newSeverity = current.includes(sev)
      ? current.filter(s => s !== sev)
      : [...current, sev];
    updateField('conditions.severity', newSeverity);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10001,
      padding: theme.spacing.lg
    }}>
      <div style={{
        backgroundColor: theme.colors.gray[900],
        borderRadius: '16px',
        border: `1px solid ${theme.colors.border}`,
        width: '100%',
        maxWidth: '800px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: theme.shadows.xl
      }}>
        {/* Header */}
        <div style={{
          padding: theme.spacing.lg,
          borderBottom: `1px solid ${theme.colors.border}`
        }}>
          <h3 style={{
            margin: 0,
            color: theme.colors.gray[100],
            fontSize: '20px',
            fontWeight: '700'
          }}>
            {rule ? 'Edit Rule' : 'Add New Rule'}
          </h3>
        </div>

        {/* Form */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: theme.spacing.lg
        }}>
          {/* Basic Info */}
          <div style={{ marginBottom: theme.spacing.lg }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: theme.colors.gray[300],
              marginBottom: theme.spacing.xs
            }}>
              Rule Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g., I-80 Lane Closure Alert"
              style={{
                width: '100%',
                padding: theme.spacing.sm,
                background: theme.colors.gray[800],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                color: theme.colors.gray[100],
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: theme.spacing.lg }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: theme.colors.gray[300],
              marginBottom: theme.spacing.xs
            }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Describe when this rule should trigger..."
              rows={3}
              style={{
                width: '100%',
                padding: theme.spacing.sm,
                background: theme.colors.gray[800],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                color: theme.colors.gray[100],
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Trigger Conditions */}
          <div style={{ marginBottom: theme.spacing.lg }}>
            <h4 style={{
              color: theme.colors.gray[200],
              fontSize: '16px',
              fontWeight: '700',
              marginBottom: theme.spacing.md
            }}>
              🎯 Trigger Conditions
            </h4>

            {/* Corridors */}
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: theme.colors.gray[300],
                marginBottom: theme.spacing.xs
              }}>
                Corridors
              </label>
              <div style={{ display: 'flex', gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
                <input
                  type="text"
                  value={corridorInput}
                  onChange={(e) => setCorridorInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCorridor()}
                  placeholder="e.g., I-80, US-30"
                  style={{
                    flex: 1,
                    padding: theme.spacing.sm,
                    background: theme.colors.gray[800],
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '8px',
                    color: theme.colors.gray[100],
                    fontSize: '14px'
                  }}
                />
                <button
                  onClick={addCorridor}
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                    background: theme.colors.primary.main,
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                {formData.conditions.corridors.map((corridor, index) => (
                  <span
                    key={index}
                    style={{
                      padding: '4px 10px',
                      background: `${theme.colors.primary.main}20`,
                      border: `1px solid ${theme.colors.primary.main}`,
                      borderRadius: '12px',
                      color: theme.colors.primary.main,
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {corridor}
                    <button
                      onClick={() => removeCorridor(index)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: theme.colors.primary.main,
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '14px'
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Event Types */}
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: theme.colors.gray[300],
                marginBottom: theme.spacing.xs
              }}>
                Event Types
              </label>
              <div style={{ display: 'flex', gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
                <input
                  type="text"
                  value={eventTypeInput}
                  onChange={(e) => setEventTypeInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addEventType()}
                  placeholder="e.g., construction, incident, closure"
                  style={{
                    flex: 1,
                    padding: theme.spacing.sm,
                    background: theme.colors.gray[800],
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '8px',
                    color: theme.colors.gray[100],
                    fontSize: '14px'
                  }}
                />
                <button
                  onClick={addEventType}
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                    background: theme.colors.primary.main,
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                {formData.conditions.eventTypes.map((type, index) => (
                  <span
                    key={index}
                    style={{
                      padding: '4px 10px',
                      background: `${theme.colors.warning.main}20`,
                      border: `1px solid ${theme.colors.warning.main}`,
                      borderRadius: '12px',
                      color: theme.colors.warning.main,
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {type}
                    <button
                      onClick={() => removeEventType(index)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: theme.colors.warning.main,
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '14px'
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Severity */}
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: theme.colors.gray[300],
                marginBottom: theme.spacing.xs
              }}>
                Severity
              </label>
              <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                {['high', 'medium', 'low'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => toggleSeverity(sev)}
                    style={{
                      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                      background: formData.conditions.severity.includes(sev)
                        ? theme.colors.error.main
                        : theme.colors.gray[800],
                      border: `1px solid ${formData.conditions.severity.includes(sev) ? theme.colors.error.main : theme.colors.border}`,
                      borderRadius: '8px',
                      color: formData.conditions.severity.includes(sev) ? 'white' : theme.colors.gray[400],
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Lanes Affected */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: theme.colors.gray[300],
                  marginBottom: theme.spacing.xs
                }}>
                  Min Lanes Affected
                </label>
                <input
                  type="number"
                  value={formData.conditions.minLanesAffected || ''}
                  onChange={(e) => updateField('conditions.minLanesAffected', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="e.g., 1"
                  min="1"
                  style={{
                    width: '100%',
                    padding: theme.spacing.sm,
                    background: theme.colors.gray[800],
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '8px',
                    color: theme.colors.gray[100],
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: theme.colors.gray[300],
                  marginBottom: theme.spacing.xs
                }}>
                  Max Lanes Affected
                </label>
                <input
                  type="number"
                  value={formData.conditions.maxLanesAffected || ''}
                  onChange={(e) => updateField('conditions.maxLanesAffected', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="e.g., 2"
                  min="1"
                  style={{
                    width: '100%',
                    padding: theme.spacing.sm,
                    background: theme.colors.gray[800],
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '8px',
                    color: theme.colors.gray[100],
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Geofence Configuration */}
          <div style={{ marginBottom: theme.spacing.lg }}>
            <h4 style={{
              color: theme.colors.gray[200],
              fontSize: '16px',
              fontWeight: '700',
              marginBottom: theme.spacing.md
            }}>
              📍 Geofence Configuration
            </h4>

            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: theme.colors.gray[300],
                marginBottom: theme.spacing.xs
              }}>
                Geofence Type
              </label>
              <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                <button
                  onClick={() => updateField('geofenceConfig.type', 'auto')}
                  style={{
                    flex: 1,
                    padding: theme.spacing.sm,
                    background: formData.geofenceConfig.type === 'auto'
                      ? theme.colors.primary.main
                      : theme.colors.gray[800],
                    border: `1px solid ${formData.geofenceConfig.type === 'auto' ? theme.colors.primary.main : theme.colors.border}`,
                    borderRadius: '8px',
                    color: formData.geofenceConfig.type === 'auto' ? 'white' : theme.colors.gray[400],
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  🤖 Auto-generate
                </button>
                <button
                  onClick={() => updateField('geofenceConfig.type', 'custom')}
                  style={{
                    flex: 1,
                    padding: theme.spacing.sm,
                    background: formData.geofenceConfig.type === 'custom'
                      ? theme.colors.primary.main
                      : theme.colors.gray[800],
                    border: `1px solid ${formData.geofenceConfig.type === 'custom' ? theme.colors.primary.main : theme.colors.border}`,
                    borderRadius: '8px',
                    color: formData.geofenceConfig.type === 'custom' ? 'white' : theme.colors.gray[400],
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  📍 Custom Polygon
                </button>
              </div>
            </div>

            {formData.geofenceConfig.type === 'auto' && (
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: theme.colors.gray[300],
                  marginBottom: theme.spacing.xs
                }}>
                  Buffer Distance (miles)
                </label>
                <input
                  type="number"
                  value={formData.geofenceConfig.bufferMiles}
                  onChange={(e) => updateField('geofenceConfig.bufferMiles', parseFloat(e.target.value))}
                  min="0.1"
                  step="0.25"
                  style={{
                    width: '100%',
                    padding: theme.spacing.sm,
                    background: theme.colors.gray[800],
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '8px',
                    color: theme.colors.gray[100],
                    fontSize: '14px'
                  }}
                />

                {/* Show recommendations based on selected event types */}
                {formData.conditions.eventTypes.length > 0 && (
                  <div style={{
                    marginTop: theme.spacing.sm,
                    padding: theme.spacing.sm,
                    background: `${theme.colors.info.main}15`,
                    border: `1px solid ${theme.colors.info.main}40`,
                    borderRadius: '8px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: theme.spacing.xs
                    }}>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: theme.colors.gray[300],
                        textTransform: 'uppercase'
                      }}>
                        💡 Recommended Buffers
                      </div>
                      {formData.conditions.eventTypes.length === 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const rec = getBufferRecommendation(formData.conditions.eventTypes[0]);
                            updateField('geofenceConfig.bufferMiles', rec.buffer);
                          }}
                          style={{
                            padding: '2px 8px',
                            background: theme.colors.info.main,
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            fontSize: '10px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Apply
                        </button>
                      )}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: theme.colors.gray[400],
                      lineHeight: '1.6'
                    }}>
                      {formData.conditions.eventTypes.map((type, idx) => {
                        const rec = getBufferRecommendation(type);
                        return (
                          <div key={idx} style={{ marginBottom: '4px' }}>
                            <strong style={{ color: theme.colors.gray[300] }}>{type}</strong>: {rec.buffer} mi
                            <span style={{ color: theme.colors.gray[500], fontSize: '11px' }}>
                              {' '}({rec.reason})
                            </span>
                          </div>
                        );
                      })}
                      {formData.conditions.eventTypes.length > 1 && (
                        <div style={{
                          marginTop: theme.spacing.xs,
                          fontSize: '11px',
                          color: theme.colors.gray[500],
                          fontStyle: 'italic'
                        }}>
                          Multiple event types selected - choose buffer based on primary use case
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Population Configuration */}
          <div style={{ marginBottom: theme.spacing.lg }}>
            <h4 style={{
              color: theme.colors.gray[200],
              fontSize: '16px',
              fontWeight: '700',
              marginBottom: theme.spacing.md
            }}>
              👥 Population Filtering
            </h4>

            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: theme.colors.gray[300],
                marginBottom: theme.spacing.xs
              }}>
                Maximum Population
              </label>
              <input
                type="number"
                value={formData.populationConfig.maxPopulation}
                onChange={(e) => updateField('populationConfig.maxPopulation', parseInt(e.target.value))}
                min="0"
                step="100"
                style={{
                  width: '100%',
                  padding: theme.spacing.sm,
                  background: theme.colors.gray[800],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '8px',
                  color: theme.colors.gray[100],
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.sm,
                cursor: 'pointer',
                color: theme.colors.gray[300],
                fontSize: '14px'
              }}>
                <input
                  type="checkbox"
                  checked={formData.populationConfig.excludeUrbanAreas}
                  onChange={(e) => updateField('populationConfig.excludeUrbanAreas', e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Exclude urban areas (non-populated focus)
              </label>
            </div>
          </div>

          {/* Approval Settings */}
          <div>
            <h4 style={{
              color: theme.colors.gray[200],
              fontSize: '16px',
              fontWeight: '700',
              marginBottom: theme.spacing.md
            }}>
              ⚙️ Approval Settings
            </h4>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
              cursor: 'pointer',
              color: theme.colors.gray[300],
              fontSize: '14px'
            }}>
              <input
                type="checkbox"
                checked={formData.requiresApproval}
                onChange={(e) => updateField('requiresApproval', e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Require supervisor approval before sending
            </label>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: theme.spacing.lg,
          borderTop: `1px solid ${theme.colors.border}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: theme.spacing.md
        }}>
          <button
            onClick={onClose}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
              backgroundColor: theme.colors.gray[700],
              color: theme.colors.gray[200],
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            disabled={!formData.name}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
              background: formData.name ? theme.colors.gradients.primary : theme.colors.gray[700],
              color: formData.name ? '#111827' : theme.colors.gray[500],
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: formData.name ? 'pointer' : 'not-allowed'
            }}
          >
            Save Rule
          </button>
        </div>
      </div>
    </div>
  );
}
