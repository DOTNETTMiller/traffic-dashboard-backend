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
          color: theme.colors.gray[300],
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
        <div style={{ padding: theme.spacing.lg }}>
          <h3 style={{
            color: theme.colors.gray[100],
            marginBottom: theme.spacing.md,
            fontSize: '18px'
          }}>
            Event Does Not Qualify for IPAWS Alert
          </h3>
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: theme.colors.gray[800],
            borderRadius: '8px',
            borderLeft: `4px solid ${theme.colors.gray[600]}`
          }}>
            <p style={{ color: theme.colors.gray[300], margin: 0 }}>
              <strong>Reason:</strong> {alert.reason}
            </p>
          </div>

          <div style={{ marginTop: theme.spacing.lg }}>
            <h4 style={{
              color: theme.colors.gray[200],
              marginBottom: theme.spacing.sm,
              fontSize: '16px'
            }}>
              Qualification Requirements:
            </h4>
            <ul style={{
              color: theme.colors.gray[400],
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
      <div style={{ padding: theme.spacing.lg }}>
        <h3 style={{
          color: theme.colors.gray[100],
          marginBottom: theme.spacing.md,
          fontSize: '18px'
        }}>
          Qualification Summary
        </h3>

        <div style={{
          padding: theme.spacing.md,
          backgroundColor: theme.colors.success.dark,
          borderRadius: '8px',
          borderLeft: `4px solid ${theme.colors.success.main}`,
          marginBottom: theme.spacing.lg
        }}>
          <p style={{ color: 'white', margin: 0, fontWeight: '600' }}>
            ✅ Event qualifies for IPAWS/WEA alert
          </p>
        </div>

        <div style={{ marginBottom: theme.spacing.lg }}>
          <h4 style={{
            color: theme.colors.gray[200],
            marginBottom: theme.spacing.sm,
            fontSize: '16px'
          }}>
            Criteria Met:
          </h4>
          <ul style={{
            color: theme.colors.gray[300],
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
            backgroundColor: theme.colors.gray[800],
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: theme.colors.gray[400],
              marginBottom: theme.spacing.xs
            }}>
              Priority
            </div>
            <div style={{
              fontSize: '20px',
              color: theme.colors.gray[100],
              fontWeight: '700'
            }}>
              {alert.metadata?.priority}
            </div>
          </div>

          <div style={{
            padding: theme.spacing.md,
            backgroundColor: theme.colors.gray[800],
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: theme.colors.gray[400],
              marginBottom: theme.spacing.xs
            }}>
              Status
            </div>
            <div style={{
              fontSize: '20px',
              color: theme.colors.warning.main,
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

    return (
      <div style={{ padding: theme.spacing.lg }}>
        <h3 style={{
          color: theme.colors.gray[100],
          marginBottom: theme.spacing.md,
          fontSize: '18px'
        }}>
          Geofence & Population Analysis
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.lg
        }}>
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: theme.colors.gray[800],
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: theme.colors.gray[400],
              marginBottom: theme.spacing.xs
            }}>
              Area
            </div>
            <div style={{
              fontSize: '20px',
              color: theme.colors.gray[100],
              fontWeight: '700'
            }}>
              {alert.geofence?.areaSquareMiles.toFixed(1)} mi²
            </div>
          </div>

          <div style={{
            padding: theme.spacing.md,
            backgroundColor: theme.colors.gray[800],
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: theme.colors.gray[400],
              marginBottom: theme.spacing.xs
            }}>
              Population
            </div>
            <div style={{
              fontSize: '20px',
              color: theme.colors.gray[100],
              fontWeight: '700'
            }}>
              {alert.geofence?.estimatedPopulation.toLocaleString()}
            </div>
          </div>

          <div style={{
            padding: theme.spacing.md,
            backgroundColor: theme.colors.gray[800],
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: theme.colors.gray[400],
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
          backgroundColor: theme.colors.info.dark,
          borderRadius: '8px',
          borderLeft: `4px solid ${theme.colors.info.main}`
        }}>
          <p style={{ color: 'white', margin: 0, fontSize: '14px' }}>
            <strong>Policy Compliance:</strong> Population {alert.geofence?.estimatedPopulation} is{' '}
            {alert.geofence?.estimatedPopulation < 5000 ? 'below' : 'above'} the 5,000 threshold.
            {alert.geofence?.estimatedPopulation < 5000
              ? ' Alert can proceed.'
              : ' Geofence must be adjusted to reduce population.'}
          </p>
        </div>

        <div style={{ marginTop: theme.spacing.lg }}>
          <h4 style={{
            color: theme.colors.gray[200],
            marginBottom: theme.spacing.sm,
            fontSize: '16px'
          }}>
            Geofence Details:
          </h4>
          <ul style={{
            color: theme.colors.gray[400],
            paddingLeft: theme.spacing.lg,
            margin: 0,
            fontSize: '14px'
          }}>
            <li>1-mile buffer on corridor centerline</li>
            <li>Population masking applied (LandScan data)</li>
            <li>Urban areas subtracted per FCC 47 CFR §10.450</li>
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
          color: theme.colors.gray[100],
          marginBottom: theme.spacing.md,
          fontSize: '18px'
        }}>
          Alert Messages
        </h3>

        {/* English Message */}
        <div style={{ marginBottom: theme.spacing.lg }}>
          <h4 style={{
            color: theme.colors.gray[200],
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
            backgroundColor: theme.colors.gray[800],
            borderRadius: '8px',
            marginBottom: theme.spacing.sm
          }}>
            <div style={{
              fontSize: '12px',
              color: theme.colors.gray[400],
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Headline
            </div>
            <div style={{
              fontSize: '16px',
              color: theme.colors.gray[100],
              fontWeight: '700',
              marginBottom: theme.spacing.sm
            }}>
              {alert.messages?.english.headline}
            </div>

            <div style={{
              fontSize: '12px',
              color: theme.colors.gray[400],
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Instruction
            </div>
            <div style={{
              fontSize: '14px',
              color: theme.colors.gray[200]
            }}>
              {alert.messages?.english.instruction}
            </div>
          </div>
        </div>

        {/* Spanish Message */}
        <div style={{ marginBottom: theme.spacing.lg }}>
          <h4 style={{
            color: theme.colors.gray[200],
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
            backgroundColor: theme.colors.gray[800],
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: theme.colors.gray[400],
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Headline
            </div>
            <div style={{
              fontSize: '16px',
              color: theme.colors.gray[100],
              fontWeight: '700',
              marginBottom: theme.spacing.sm
            }}>
              {alert.messages?.spanish.headline}
            </div>

            <div style={{
              fontSize: '12px',
              color: theme.colors.gray[400],
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Instruction
            </div>
            <div style={{
              fontSize: '14px',
              color: theme.colors.gray[200]
            }}>
              {alert.messages?.spanish.instruction}
            </div>
          </div>
        </div>

        <div style={{
          padding: theme.spacing.md,
          backgroundColor: theme.colors.gray[800],
          borderRadius: '8px',
          fontSize: '12px',
          color: theme.colors.gray[400]
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
          color: theme.colors.gray[100],
          marginBottom: theme.spacing.md,
          fontSize: '18px'
        }}>
          CAP-XML Message
        </h3>

        <div style={{
          padding: theme.spacing.md,
          backgroundColor: theme.colors.gray[900],
          borderRadius: '8px',
          border: `1px solid ${theme.colors.gray[700]}`,
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          <pre style={{
            margin: 0,
            fontSize: '12px',
            color: theme.colors.gray[300],
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
            backgroundColor: theme.colors.gray[800],
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: theme.colors.gray[400],
              marginBottom: theme.spacing.xs
            }}>
              Alert ID
            </div>
            <div style={{
              fontSize: '14px',
              color: theme.colors.gray[100],
              fontFamily: 'monospace'
            }}>
              {alert.capMessage?.identifier}
            </div>
          </div>

          <div style={{
            padding: theme.spacing.md,
            backgroundColor: theme.colors.gray[800],
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '12px',
              color: theme.colors.gray[400],
              marginBottom: theme.spacing.xs
            }}>
              Expires
            </div>
            <div style={{
              fontSize: '14px',
              color: theme.colors.gray[100]
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
          color: theme.colors.gray[100],
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
        maxWidth: '900px',
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
              IPAWS Alert Generator
            </h2>
            <div style={{
              fontSize: '14px',
              color: theme.colors.gray[400]
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

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: `1px solid ${theme.colors.border}`,
          padding: `0 ${theme.spacing.lg}`
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
                color: activeTab === tab.id ? theme.colors.primary.main : theme.colors.gray[400],
                fontSize: '14px',
                fontWeight: '600',
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
                borderBottom: activeTab === tab.id ? `2px solid ${theme.colors.primary.main}` : '2px solid transparent',
                transition: `all ${theme.transitions.fast}`,
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
