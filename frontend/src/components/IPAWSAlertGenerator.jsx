import { useState, useEffect } from 'react';
import { theme } from '../styles/theme';

/**
 * IPAWS Alert Generator & Review Component
 *
 * Provides TMC operators interface to:
 * - Evaluate event qualification for IPAWS alerts
 * - Review geofence and population estimates
 * - Preview multilingual messages
 * - Generate CAP-XML for supervisor approval
 */
export default function IPAWSAlertGenerator({ event, onClose }) {
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('qualification');

  useEffect(() => {
    if (event) {
      generateAlert();
    }
  }, [event]);

  const generateAlert = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ipaws/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event })
      });

      const data = await response.json();
      setAlert(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getQualificationBadge = () => {
    if (!alert) return null;

    if (!alert.success) {
      return (
        <div style={{
          display: 'inline-block',
          padding: '6px 12px',
          borderRadius: '6px',
          backgroundColor: theme.colors.gray[700],
          color: "#4b5563",
          fontSize: '14px',
          fontWeight: '600'
        }}>
          ❌ Not Qualified
        </div>
      );
    }

    const isPriority = alert.metadata?.priority === 'IMMEDIATE';
    return (
      <div style={{
        display: 'inline-block',
        padding: '6px 12px',
        borderRadius: '6px',
        backgroundColor: isPriority ? theme.colors.error.main : theme.colors.warning.main,
        color: 'white',
        fontSize: '14px',
        fontWeight: '600'
      }}>
        ✅ Qualified - {isPriority ? 'IMMEDIATE' : 'STANDARD'}
      </div>
    );
  };

  const renderQualificationTab = () => {
    if (!alert) return null;

    if (!alert.success) {
      return (
        <div style={{ padding: theme.spacing.lg, backgroundColor: 'white' }}>
          <h3 style={{
            color: '#111827',
            marginBottom: theme.spacing.md,
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            Event Does Not Qualify for IPAWS Alert
          </h3>
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: '#fee2e2',
            borderRadius: '8px',
            borderLeft: '4px solid #ef4444'
          }}>
            <p style={{ color: '#991b1b', margin: 0 }}>
              <strong>Reason:</strong> {alert.reason}
            </p>
          </div>

          <div style={{ marginTop: theme.spacing.lg }}>
            <h4 style={{
              color: '#374151',
              marginBottom: theme.spacing.sm,
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Qualification Requirements:
            </h4>
            <ul style={{
              color: '#4b5563',
              paddingLeft: theme.spacing.lg,
              margin: 0
            }}>
              <li>Route must be Tier 1 (Interstate, NHS, or major state highway)</li>
              <li>Closure duration ≥4 hours, OR</li>
              <li>Event presents imminent danger (hazmat, wrong-way, fire, etc.)</li>
            </ul>
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: theme.spacing.lg, backgroundColor: 'white' }}>
        <h3 style={{
          color: '#111827',
          marginBottom: theme.spacing.md,
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          Qualification Summary
        </h3>

        <div style={{
          padding: theme.spacing.md,
          backgroundColor: '#d1fae5',
          borderRadius: '8px',
          borderLeft: '4px solid #10b981',
          marginBottom: theme.spacing.lg
        }}>
          <p style={{ color: '#065f46', margin: 0, fontWeight: '600' }}>
            ✅ Event qualifies for IPAWS/WEA alert
          </p>
        </div>

        <div style={{ marginBottom: theme.spacing.lg }}>
          <h4 style={{
            color: '#374151',
            marginBottom: theme.spacing.sm,
            fontSize: '16px'
          }}>
            Criteria Met:
          </h4>
          <ul style={{
            color: '#4b5563',
            paddingLeft: theme.spacing.lg,
            margin: 0
          }}>
            {alert.qualification?.criteria.map((criterion, idx) => (
              <li key={idx} style={{ marginBottom: theme.spacing.xs }}>
                {criterion}
              </li>
            ))}
          </ul>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: theme.spacing.md
        }}>
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginBottom: theme.spacing.xs,
              fontWeight: '600'
            }}>
              Priority
            </div>
            <div style={{
              fontSize: '20px',
              color: '#111827',
              fontWeight: '700'
            }}>
              {alert.metadata?.priority}
            </div>
          </div>

          <div style={{
            padding: theme.spacing.md,
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginBottom: theme.spacing.xs,
              fontWeight: '600'
            }}>
              Status
            </div>
            <div style={{
              fontSize: '20px',
              color: '#f59e0b',
              fontWeight: '700'
            }}>
              Pending Approval
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGeofenceTab = () => {
    if (!alert?.success) return null;

    const hasRecommendation = alert.geofence?.recommendation;

    return (
      <div style={{ padding: theme.spacing.lg, backgroundColor: 'white' }}>
        <h3 style={{
          color: '#111827',
          marginBottom: theme.spacing.md,
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          Geofence & Population Analysis
        </h3>

        {/* Recommendation Banner */}
        {hasRecommendation && (
          <div style={{
            padding: theme.spacing.md,
            background: `${theme.colors.info.main}15`,
            border: `1px solid ${theme.colors.info.main}`,
            borderRadius: '12px',
            marginBottom: theme.spacing.lg
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'start',
              gap: theme.spacing.sm
            }}>
              <div style={{ fontSize: '24px' }}>💡</div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: "#111827",
                  marginBottom: theme.spacing.xs
                }}>
                  Intelligent Geofence Recommendation
                </div>
                <div style={{
                  fontSize: '13px',
                  color: "#4b5563",
                  marginBottom: theme.spacing.sm
                }}>
                  Based on event type "{alert.geofence.recommendation.eventType}":
                  <strong> {alert.geofence.recommendation.adjustedBufferMiles} mile buffer</strong>
                </div>
                <div style={{
                  fontSize: '12px',
                  color: "#6b7280",
                  fontStyle: 'italic'
                }}>
                  {alert.geofence.reasoning}
                </div>
                {alert.geofence.recommendation.adjustments.severityAdjusted && (
                  <div style={{
                    fontSize: '11px',
                    color: "#9ca3af",
                    marginTop: theme.spacing.xs
                  }}>
                    ℹ️ Adjusted for {event.severity} severity
                  </div>
                )}
                {alert.geofence.recommendation.adjustments.lanesAdjusted && (
                  <div style={{
                    fontSize: '11px',
                    color: "#9ca3af",
                    marginTop: '2px'
                  }}>
                    ℹ️ Adjusted for {event.lanesAffected} lane(s) affected
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Population Breakdown */}
        {alert.geofence?.populationBreakdown && (
          <div style={{
            padding: theme.spacing.md,
            background: `${theme.colors.info.main}15`,
            border: `1px solid ${theme.colors.info.main}40`,
            borderRadius: '12px',
            marginBottom: theme.spacing.lg
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
              marginBottom: theme.spacing.sm
            }}>
              <div style={{ fontSize: '20px' }}>👥</div>
              <div style={{
                fontSize: '14px',
                fontWeight: '700',
                color: "#111827"
              }}>
                Population Impact Analysis
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: theme.spacing.sm,
              marginBottom: theme.spacing.sm
            }}>
              <div style={{
                padding: theme.spacing.sm,
                background: "#f3f4f6",
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '11px', color: "#9ca3af" }}>🌾 Rural</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: theme.colors.success.main }}>
                  {alert.geofence.populationBreakdown.rural.toLocaleString()}
                </div>
              </div>
              <div style={{
                padding: theme.spacing.sm,
                background: "#f3f4f6",
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '11px', color: "#9ca3af" }}>🏙️ Urban</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: theme.colors.warning.main }}>
                  {alert.geofence.populationBreakdown.urban.toLocaleString()}
                </div>
              </div>
            </div>

            {alert.geofence.populationBreakdown.affectedCities?.length > 0 && (
              <div style={{
                fontSize: '12px',
                color: "#6b7280",
                borderTop: "1px solid #e5e7eb",
                paddingTop: theme.spacing.sm
              }}>
                <strong>Affected Cities:</strong>{' '}
                {alert.geofence.populationBreakdown.affectedCities.map(c => c.name).join(', ')}
              </div>
            )}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.lg
        }}>
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: "#f3f4f6",
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs
            }}>
              Area ({alert.geofence?.bufferMiles?.toFixed(2) || '1.00'} mi buffer)
            </div>
            <div style={{
              fontSize: '20px',
              color: "#111827",
              fontWeight: '700'
            }}>
              {alert.geofence?.areaSquareMiles.toFixed(1)} mi²
            </div>
          </div>

          <div style={{
            padding: theme.spacing.md,
            backgroundColor: "#f3f4f6",
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs
            }}>
              Total Population
            </div>
            <div style={{
              fontSize: '20px',
              color: "#111827",
              fontWeight: '700'
            }}>
              {alert.geofence?.estimatedPopulation.toLocaleString()}
            </div>
            {alert.geofence?.populationBreakdown?.classification && (
              <div style={{
                fontSize: '10px',
                color: "#9ca3af",
                marginTop: '4px',
                textTransform: 'capitalize'
              }}>
                {alert.geofence.populationBreakdown.classification.replace('_', ' ')}
              </div>
            )}
          </div>

          <div style={{
            padding: theme.spacing.md,
            backgroundColor: "#f3f4f6",
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs
            }}>
              Est. Reach (85%)
            </div>
            <div style={{
              fontSize: '20px',
              color: theme.colors.success.main,
              fontWeight: '700'
            }}>
              {Math.round(alert.metadata?.estimatedReach || 0).toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{
          padding: theme.spacing.md,
          backgroundColor: alert.geofence?.estimatedPopulation < 5000 ? theme.colors.success.dark : theme.colors.warning.dark,
          borderRadius: '8px',
          borderLeft: `4px solid ${alert.geofence?.estimatedPopulation < 5000 ? theme.colors.success.main : theme.colors.warning.main}`
        }}>
          <p style={{ color: 'white', margin: 0, fontSize: '14px', marginBottom: theme.spacing.sm }}>
            <strong>Policy Compliance:</strong> Population {alert.geofence?.estimatedPopulation?.toLocaleString()} is{' '}
            {alert.geofence?.estimatedPopulation < 5000 ? 'below' : 'above'} the 5,000 threshold.
            {alert.geofence?.estimatedPopulation < 5000
              ? ' ✅ Alert can proceed.'
              : ' ⚠️ Adjustment recommended.'}
          </p>

          {alert.geofence?.estimatedPopulation >= 5000 && alert.geofence?.populationBreakdown?.urban > 0 && (
            <button
              onClick={async () => {
                // Trigger urban exclusion
                const response = await fetch('/api/population/exclude-urban', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    geofence: alert.geofence,
                    maxPopulation: 5000
                  })
                });
                const result = await response.json();
                if (result.success) {
                  alert(`✅ Excluded ${result.excluded.join(', ')}\n\nNew population: ${result.population.total.toLocaleString()}\nReduction: ${100 - result.reductionPercent}%`);
                }
              }}
              style={{
                padding: '8px 16px',
                background: 'white',
                border: 'none',
                borderRadius: '6px',
                color: theme.colors.warning.main,
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🌾 Exclude Urban Areas ({alert.geofence.populationBreakdown.urban.toLocaleString()} people)
            </button>
          )}
        </div>

        <div style={{ marginTop: theme.spacing.lg }}>
          <h4 style={{
            color: "#374151",
            marginBottom: theme.spacing.sm,
            fontSize: '16px'
          }}>
            Geofence Details:
          </h4>
          <ul style={{
            color: "#6b7280",
            paddingLeft: theme.spacing.lg,
            margin: 0,
            fontSize: '14px',
            lineHeight: '1.8'
          }}>
            <li>
              <strong>{alert.geofence?.bufferMiles?.toFixed(2) || '1.00'}-mile buffer</strong> on corridor centerline
              {alert.geofence?.isCustomBuffer === false && hasRecommendation && (
                <span style={{ color: theme.colors.info.main, fontWeight: '600' }}>
                  {' '}(intelligent recommendation)
                </span>
              )}
            </li>
            <li>Population masking applied (LandScan data)</li>
            <li>Urban areas subtracted per FCC 47 CFR §10.450</li>
            {hasRecommendation && alert.geofence.recommendation.recommended.leadTime && (
              <li style={{ color: "#4b5563" }}>
                {alert.geofence.recommendation.recommended.leadTime}
              </li>
            )}
          </ul>
        </div>
      </div>
    );
  };

  const renderMessagesTab = () => {
    if (!alert?.success) return null;

    return (
      <div style={{ padding: theme.spacing.lg }}>
        <h3 style={{
          color: "#111827",
          marginBottom: theme.spacing.md,
          fontSize: '18px'
        }}>
          Alert Messages
        </h3>

        {/* English Message */}
        <div style={{ marginBottom: theme.spacing.lg }}>
          <h4 style={{
            color: "#374151",
            marginBottom: theme.spacing.sm,
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.xs
          }}>
            🇺🇸 English (Primary - 90 characters)
          </h4>
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: "#f3f4f6",
            borderRadius: '8px',
            marginBottom: theme.spacing.sm
          }}>
            <div style={{
              fontSize: '12px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Headline
            </div>
            <div style={{
              fontSize: '16px',
              color: "#111827",
              fontWeight: '700',
              marginBottom: theme.spacing.sm
            }}>
              {alert.messages?.english.headline}
            </div>

            <div style={{
              fontSize: '12px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Instruction
            </div>
            <div style={{
              fontSize: '14px',
              color: "#374151"
            }}>
              {alert.messages?.english.instruction}
            </div>
          </div>
        </div>

        {/* Spanish Message */}
        <div style={{ marginBottom: theme.spacing.lg }}>
          <h4 style={{
            color: "#374151",
            marginBottom: theme.spacing.sm,
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.xs
          }}>
            🇲🇽 Spanish (Extended - 360 characters)
          </h4>
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: "#f3f4f6",
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Headline
            </div>
            <div style={{
              fontSize: '16px',
              color: "#111827",
              fontWeight: '700',
              marginBottom: theme.spacing.sm
            }}>
              {alert.messages?.spanish.headline}
            </div>

            <div style={{
              fontSize: '12px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Instruction
            </div>
            <div style={{
              fontSize: '14px',
              color: "#374151"
            }}>
              {alert.messages?.spanish.instruction}
            </div>
          </div>
        </div>

        <div style={{
          padding: theme.spacing.md,
          backgroundColor: "#f3f4f6",
          borderRadius: '8px',
          fontSize: '12px',
          color: "#6b7280"
        }}>
          <strong>Note:</strong> Lao and Somali translations will be added when PSAPs indicate need per Iowa DOT policy.
        </div>
      </div>
    );
  };

  const renderCAPTab = () => {
    if (!alert?.success) return null;

    return (
      <div style={{ padding: theme.spacing.lg }}>
        <h3 style={{
          color: "#111827",
          marginBottom: theme.spacing.md,
          fontSize: '18px'
        }}>
          CAP-XML Message
        </h3>

        <div style={{
          padding: theme.spacing.md,
          backgroundColor: "white",
          borderRadius: '8px',
          border: "1px solid #e5e7eb",
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          <pre style={{
            margin: 0,
            fontSize: '12px',
            color: "#4b5563",
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}>
            {JSON.stringify(alert.capMessage, null, 2)}
          </pre>
        </div>

        <div style={{
          marginTop: theme.spacing.md,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: theme.spacing.md
        }}>
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: "#f3f4f6",
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs
            }}>
              Alert ID
            </div>
            <div style={{
              fontSize: '14px',
              color: "#111827",
              fontFamily: 'monospace'
            }}>
              {alert.capMessage?.identifier}
            </div>
          </div>

          <div style={{
            padding: theme.spacing.md,
            backgroundColor: "#f3f4f6",
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs
            }}>
              Expires
            </div>
            <div style={{
              fontSize: '14px',
              color: "#111827"
            }}>
              {alert.capMessage?.info?.expires ? new Date(alert.capMessage.info.expires).toLocaleString() : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
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
        zIndex: 10000
      }}>
        <div style={{
          color: "#111827",
          fontSize: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.md
        }}>
          <div className="spinner" />
          Generating IPAWS Alert...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: theme.spacing.lg
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '2px solid #3b82f6',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          padding: theme.spacing.lg,
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#6b7280',
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              color: '#111827',
              fontSize: '24px',
              marginBottom: theme.spacing.xs,
              fontWeight: 'bold'
            }}>
              🚨 IPAWS Alert Generator
            </h2>
            <div style={{
              fontSize: '14px',
              color: '#374151'
            }}>
              {event.corridor} • {event.location || event.county}
            </div>
            <div style={{ marginTop: theme.spacing.sm }}>
              {getQualificationBadge()}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#ef4444',
              border: 'none',
              color: '#111827',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '8px',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb',
          padding: `0 ${theme.spacing.lg}`,
          backgroundColor: 'white'
        }}>
          {[
            { id: 'qualification', label: 'Qualification' },
            { id: 'geofence', label: 'Geofence', disabled: !alert?.success },
            { id: 'messages', label: 'Messages', disabled: !alert?.success },
            { id: 'cap', label: 'CAP-XML', disabled: !alert?.success }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              style={{
                background: 'none',
                border: 'none',
                padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                fontSize: '14px',
                fontWeight: '600',
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                transition: 'all 0.2s',
                opacity: tab.disabled ? 0.5 : 1
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto'
        }}>
          {error && (
            <div style={{
              margin: theme.spacing.lg,
              padding: theme.spacing.md,
              backgroundColor: theme.colors.error.dark,
              borderRadius: '8px',
              borderLeft: `4px solid ${theme.colors.error.main}`,
              color: 'white'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {activeTab === 'qualification' && renderQualificationTab()}
          {activeTab === 'geofence' && renderGeofenceTab()}
          {activeTab === 'messages' && renderMessagesTab()}
          {activeTab === 'cap' && renderCAPTab()}
        </div>

        {/* Footer */}
        {alert?.success && (
          <div style={{
            padding: theme.spacing.lg,
            borderTop: "1px solid #e5e7eb",
            display: 'flex',
            justifyContent: 'flex-end',
            gap: theme.spacing.md
          }}>
            <button
              onClick={onClose}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                backgroundColor: theme.colors.gray[700],
                color: "#374151",
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: `all ${theme.transitions.fast}`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray[600];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray[700];
              }}
            >
              Cancel
            </button>
            <button
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
                background: theme.colors.gradients.warning,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: `all ${theme.transitions.fast}`,
                boxShadow: theme.shadows.md
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = theme.shadows.lg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.shadows.md;
              }}
            >
              Submit for Supervisor Approval
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
