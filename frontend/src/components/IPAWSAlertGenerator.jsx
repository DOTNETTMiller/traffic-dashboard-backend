import { useState, useEffect } from 'react';
import { theme } from '../styles/theme';
import { config } from '../config';

/**
 * IPAWS Alert Generator & Review Component
 *
 * Provides TMC operators interface to:
 * - Evaluate event qualification for IPAWS alerts
 * - Review geofence and population estimates
 * - Preview multilingual messages
 * - Generate CAP-XML for supervisor approval
 */
export default function IPAWSAlertGenerator({ event, onClose, onGeofenceUpdate }) {
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('qualification');
  const [overridePopulation, setOverridePopulation] = useState(false);
  const [saving, setSaving] = useState(false);

  // Geofence adjustment parameters
  const [bufferMiles, setBufferMiles] = useState(2.0);
  const [corridorLengthMiles, setCorridorLengthMiles] = useState(null); // null = full length
  const [avoidUrbanAreas, setAvoidUrbanAreas] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (event) {
      generateAlert();
    }
  }, [event]);

  // Update parent with geofence data when alert is loaded
  useEffect(() => {
    if (alert?.success && alert?.geofence && onGeofenceUpdate) {
      console.log('🗺️ Sending geofence to map:', alert.geofence);
      onGeofenceUpdate(alert.geofence);
    }
  }, [alert, onGeofenceUpdate]);

  const generateAlert = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event })
      });

      const data = await response.json();
      setAlert(data);

      // Initialize buffer from generated geofence
      if (data?.geofence?.bufferMiles) {
        setBufferMiles(data.geofence.bufferMiles);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleRegenerateGeofence = async () => {
    setRegenerating(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          bufferMiles,
          corridorLengthMiles,
          avoidUrbanAreas
        })
      });

      const data = await response.json();

      if (data.success) {
        // Update the alert with new geofence
        setAlert(prev => ({
          ...prev,
          geofence: data.geofence
        }));

        // Notify parent component of geofence update
        if (onGeofenceUpdate) {
          onGeofenceUpdate(data.geofence);
        }
      } else {
        setError(data.error || 'Failed to regenerate geofence');
      }
    } catch (err) {
      setError('Failed to regenerate geofence: ' + err.message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveGeofence = async () => {
    if (!alert?.geofence) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/api/events/${event.id}/geofence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geofence: alert.geofence,
          population: alert.geofence.estimatedPopulation,
          overridePopulation: overridePopulation,
          bufferMiles: alert.geofence.bufferMiles
        })
      });

      if (response.ok) {
        const result = await response.json();
        window.alert(`✅ Geofence saved to event!\n\nPopulation: ${alert.geofence.estimatedPopulation.toLocaleString()}\nBuffer: ${alert.geofence.bufferMiles} miles\n\nThe geofence will now appear on the map for this event.`);
        onClose();
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to save geofence');
      }
    } catch (err) {
      setError('Failed to save geofence: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getQualificationBadge = () => {
    if (!alert) return null;

    if (!alert.recommended) {
      return (
        <div style={{
          display: 'inline-block',
          padding: '8px 16px',
          borderRadius: '8px',
          backgroundColor: '#fef3c7',
          color: '#92400e',
          fontSize: '13px',
          fontWeight: '700',
          border: '1px solid #fde68a'
        }}>
          ⚠️ Not Recommended (Override Available)
        </div>
      );
    }

    const isPriority = alert.metadata?.priority === 'IMMEDIATE';
    return (
      <div style={{
        display: 'inline-block',
        padding: '8px 16px',
        borderRadius: '8px',
        backgroundColor: isPriority ? '#fee2e2' : '#dcfce7',
        color: isPriority ? '#991b1b' : '#166534',
        fontSize: '13px',
        fontWeight: '700',
        border: isPriority ? '1px solid #fecaca' : '1px solid #bbf7d0'
      }}>
        ✅ Recommended - {isPriority ? 'IMMEDIATE' : 'STANDARD'}
      </div>
    );
  };

  const renderQualificationTab = () => {
    if (!alert) return null;

    // Show warnings if not recommended
    if (!alert.recommended && alert.warnings && alert.warnings.length > 0) {
      return (
        <div>
          <h3 style={{
            color: '#111827',
            marginTop: 0,
            marginBottom: '16px',
            fontSize: '16px',
            fontWeight: '700'
          }}>
            IPAWS Alert Not Recommended
          </h3>

          <div style={{
            padding: theme.spacing.md,
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            borderLeft: '4px solid #f59e0b',
            marginBottom: theme.spacing.md
          }}>
            <p style={{ color: '#92400e', margin: '0 0 8px 0', fontWeight: '600' }}>
              ⚠️ The following criteria are not met:
            </p>
            {alert.warnings.map((warning, idx) => (
              <div key={idx} style={{
                color: '#78350f',
                marginTop: idx > 0 ? '12px' : '0',
                paddingTop: idx > 0 ? '12px' : '0',
                borderTop: idx > 0 ? '1px solid #fde68a' : 'none'
              }}>
                <strong>{warning.type === 'qualification' ? 'Qualification:' : 'Population:'}</strong> {warning.message}
              </div>
            ))}
          </div>

          <div style={{
            padding: theme.spacing.md,
            backgroundColor: '#eff6ff',
            borderRadius: '8px',
            borderLeft: '4px solid #3b82f6',
            marginBottom: theme.spacing.md
          }}>
            <p style={{ color: '#1e40af', margin: '0 0 8px 0', fontWeight: '600' }}>
              💡 Recommendations:
            </p>
            <ul style={{ color: '#1e3a8a', margin: 0, paddingLeft: '20px' }}>
              {alert.warnings.find(w => w.type === 'population') && (
                <li>Try narrowing the buffer width or shortening the corridor length in the "Geofence Adjustment" section</li>
              )}
              {alert.warnings.find(w => w.type === 'qualification') && (
                <>
                  <li>Verify the event meets tier 1 route requirements (Interstate, NHS, or major state highway)</li>
                  <li>Confirm closure duration ≥4 hours OR event presents imminent danger</li>
                </>
              )}
            </ul>
          </div>

          <div style={{
            padding: theme.spacing.md,
            backgroundColor: '#fff7ed',
            borderRadius: '8px',
            border: '1px solid #fed7aa'
          }}>
            <p style={{ color: '#7c2d12', margin: '0 0 8px 0', fontWeight: '600' }}>
              Override and Proceed Anyway
            </p>
            <p style={{ color: '#9a3412', margin: '0 0 12px 0', fontSize: '12px' }}>
              You can proceed with this alert despite the warnings. An override will be logged for audit purposes.
            </p>
            <div style={{ fontSize: '11px', color: '#92400e', fontStyle: 'italic' }}>
              Note: Override capability allows for situational judgment when policy guidelines may not fully capture event urgency or public safety needs.
            </div>
          </div>

          <div style={{ marginTop: theme.spacing.lg }}>
            <h4 style={{
              color: '#374151',
              marginBottom: theme.spacing.sm,
              fontSize: '14px',
              fontWeight: '600'
            }}>
              Standard Qualification Requirements:
            </h4>
            <ul style={{
              color: '#4b5563',
              paddingLeft: theme.spacing.lg,
              margin: 0,
              fontSize: '13px'
            }}>
              <li>Route must be Tier 1 (Interstate, NHS, or major state highway)</li>
              <li>Closure duration ≥4 hours, OR</li>
              <li>Event presents imminent danger (hazmat, wrong-way, fire, etc.)</li>
              <li>Geofence population &lt; 5,000 people</li>
            </ul>
          </div>
        </div>
      );
    }

    return (
      <div>
        <h3 style={{
          color: '#111827',
          marginTop: 0,
          marginBottom: '16px',
          fontSize: '16px',
          fontWeight: '700'
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
            fontSize: '14px'
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
              fontSize: '11px',
              color: '#6b7280',
              marginBottom: theme.spacing.xs,
              fontWeight: '600'
            }}>
              Priority
            </div>
            <div style={{
              fontSize: '16px',
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
              fontSize: '11px',
              color: '#6b7280',
              marginBottom: theme.spacing.xs,
              fontWeight: '600'
            }}>
              Status
            </div>
            <div style={{
              fontSize: '16px',
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
      <div>
        <h3 style={{
          color: '#111827',
          marginTop: 0,
          marginBottom: '16px',
          fontSize: '16px',
          fontWeight: '700'
        }}>
          Geofence & Population Analysis
        </h3>

        {/* Map Display Notice */}
        {alert.geofence && (
          <div style={{
            padding: theme.spacing.md,
            background: '#dbeafe',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            marginBottom: theme.spacing.lg,
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm
          }}>
            <div style={{ fontSize: '18px' }}>🗺️</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: '700',
                color: '#1e40af',
                marginBottom: '4px'
              }}>
                Geofence Visible on Map
              </div>
              <div style={{
                fontSize: '12px',
                color: '#1e3a8a'
              }}>
                The {alert.geofence.bufferMiles?.toFixed(2) || '1.00'} mile buffer zone (orange polygon) is displayed on the map. <strong>Close this modal to see it clearly.</strong>
              </div>
            </div>
          </div>
        )}

        {/* Recommendation Banner */}
        {hasRecommendation && (
          <div style={{
            padding: theme.spacing.md,
            background: `${theme.colors.primary.main}15`,
            border: `1px solid ${theme.colors.primary.main}`,
            borderRadius: '12px',
            marginBottom: theme.spacing.lg
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'start',
              gap: theme.spacing.sm
            }}>
              <div style={{ fontSize: '18px' }}>💡</div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: "#111827",
                  marginBottom: theme.spacing.xs
                }}>
                  Intelligent Geofence Recommendation
                </div>
                <div style={{
                  fontSize: '12px',
                  color: "#4b5563",
                  marginBottom: theme.spacing.sm
                }}>
                  Based on event type "{alert.geofence.recommendation.eventType}":
                  <strong> {alert.geofence.recommendation.adjustedBufferMiles} mile buffer</strong>
                </div>
                <div style={{
                  fontSize: '11px',
                  color: "#6b7280",
                  fontStyle: 'italic'
                }}>
                  {alert.geofence.reasoning}
                </div>
                {alert.geofence.recommendation.adjustments.severityAdjusted && (
                  <div style={{
                    fontSize: '10px',
                    color: "#9ca3af",
                    marginTop: theme.spacing.xs
                  }}>
                    ℹ️ Adjusted for {event.severity} severity
                  </div>
                )}
                {alert.geofence.recommendation.adjustments.lanesAdjusted && (
                  <div style={{
                    fontSize: '10px',
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
            background: `${theme.colors.primary.main}15`,
            border: `1px solid ${theme.colors.primary.main}40`,
            borderRadius: '12px',
            marginBottom: theme.spacing.lg
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
              marginBottom: theme.spacing.sm
            }}>
              <div style={{ fontSize: '16px' }}>👥</div>
              <div style={{
                fontSize: '13px',
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
                <div style={{ fontSize: '10px', color: "#9ca3af" }}>🌾 Rural</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: theme.colors.success.main }}>
                  {alert.geofence.populationBreakdown.rural.toLocaleString()}
                </div>
              </div>
              <div style={{
                padding: theme.spacing.sm,
                background: "#f3f4f6",
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '10px', color: "#9ca3af" }}>🏙️ Urban</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: theme.colors.warning.main }}>
                  {alert.geofence.populationBreakdown.urban.toLocaleString()}
                </div>
              </div>
            </div>

            {alert.geofence.populationBreakdown.affectedCities?.length > 0 && (
              <div style={{
                fontSize: '11px',
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
              fontSize: '11px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs
            }}>
              Area ({alert.geofence?.bufferMiles?.toFixed(2) || '1.00'} mi buffer)
            </div>
            <div style={{
              fontSize: '16px',
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
              fontSize: '11px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs
            }}>
              Total Population
            </div>
            <div style={{
              fontSize: '16px',
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
              fontSize: '11px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs
            }}>
              Est. Reach (85%)
            </div>
            <div style={{
              fontSize: '16px',
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
          <p style={{ color: 'white', margin: 0, fontSize: '13px', marginBottom: theme.spacing.sm }}>
            <strong>Policy Compliance:</strong> Population {alert.geofence?.estimatedPopulation?.toLocaleString()} is{' '}
            {alert.geofence?.estimatedPopulation < 5000 ? 'below' : 'above'} the 5,000 threshold.
            {alert.geofence?.estimatedPopulation < 5000
              ? ' ✅ Alert can proceed.'
              : ' ⚠️ Adjustment recommended.'}
          </p>

          {/* Geofence Adjustment Controls */}
          <div style={{
            marginTop: theme.spacing.md,
            padding: theme.spacing.sm,
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '6px'
          }}>
            <div style={{ color: 'white', fontWeight: '600', fontSize: '12px', marginBottom: theme.spacing.sm }}>
              🎯 Adjust Geofence Coverage
            </div>

            {/* Buffer Width Slider */}
            <div style={{ marginBottom: theme.spacing.sm }}>
              <label style={{ color: 'white', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                Buffer Width: {bufferMiles} miles
              </label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={bufferMiles}
                onChange={(e) => setBufferMiles(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'rgba(255,255,255,0.7)' }}>
                <span>0.5 mi (narrower)</span>
                <span>5 mi (wider)</span>
              </div>
            </div>

            {/* Corridor Length Input */}
            <div style={{ marginBottom: theme.spacing.sm }}>
              <label style={{ color: 'white', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                Corridor Length (optional, miles ahead/behind event)
              </label>
              <input
                type="number"
                min="1"
                max="50"
                step="1"
                value={corridorLengthMiles || ''}
                onChange={(e) => setCorridorLengthMiles(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Leave empty for full length"
                style={{
                  width: '100%',
                  padding: '6px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '11px'
                }}
              />
            </div>

            {/* Regenerate Button */}
            <button
              onClick={handleRegenerateGeofence}
              disabled={regenerating}
              style={{
                width: '100%',
                padding: '8px',
                background: 'white',
                border: 'none',
                borderRadius: '6px',
                color: theme.colors.primary.main,
                fontSize: '11px',
                fontWeight: '700',
                cursor: regenerating ? 'wait' : 'pointer',
                opacity: regenerating ? 0.6 : 1
              }}
            >
              {regenerating ? '⏳ Regenerating...' : '🔄 Regenerate Geofence with New Settings'}
            </button>
          </div>

          {alert.geofence?.estimatedPopulation >= 5000 && alert.geofence?.populationBreakdown?.urban > 0 && (
            <button
              onClick={async () => {
                // Trigger urban exclusion
                const response = await fetch(`${config.apiUrl}/api/population/exclude-urban`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    geofence: alert.geofence,
                    maxPopulation: 5000
                  })
                });
                const result = await response.json();
                if (result.success) {
                  window.alert(`✅ Excluded ${result.excluded.join(', ')}\n\nNew population: ${result.population.total.toLocaleString()}\nReduction: ${100 - result.reductionPercent}%`);
                }
              }}
              style={{
                padding: '8px 16px',
                background: 'white',
                border: 'none',
                borderRadius: '6px',
                color: theme.colors.warning.main,
                fontSize: '11px',
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

          {/* Population Override Option */}
          {alert.geofence?.estimatedPopulation >= 5000 && (
            <div style={{
              marginTop: theme.spacing.md,
              padding: theme.spacing.sm,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <input
                type="checkbox"
                id="override-population"
                checked={overridePopulation}
                onChange={(e) => setOverridePopulation(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="override-population" style={{
                color: 'white',
                fontSize: '12px',
                cursor: 'pointer',
                margin: 0
              }}>
                Override population threshold - adequate warning coverage required
              </label>
            </div>
          )}
        </div>

        {/* Geofence Action Buttons */}
        <div style={{
          marginTop: theme.spacing.md,
          padding: theme.spacing.md,
          backgroundColor: theme.colors.background.paper,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border.light}`,
          display: 'flex',
          gap: theme.spacing.md,
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleSaveGeofence}
            disabled={!alert?.geofence || saving || (!overridePopulation && alert.geofence?.estimatedPopulation >= 5000)}
            style={{
              padding: '10px 20px',
              background: theme.colors.primary.main,
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '13px',
              fontWeight: '600',
              cursor: !alert?.geofence || saving || (!overridePopulation && alert.geofence?.estimatedPopulation >= 5000) ? 'not-allowed' : 'pointer',
              opacity: !alert?.geofence || saving || (!overridePopulation && alert.geofence?.estimatedPopulation >= 5000) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {saving ? '⏳ Saving...' : '💾 Save Geofence to Event'}
          </button>
        </div>

        <div style={{ marginTop: theme.spacing.lg }}>
          <h4 style={{
            color: "#374151",
            marginBottom: theme.spacing.sm,
            fontSize: '14px'
          }}>
            Geofence Details:
          </h4>
          <ul style={{
            color: "#6b7280",
            paddingLeft: theme.spacing.lg,
            margin: 0,
            fontSize: '13px',
            lineHeight: '1.8'
          }}>
            <li>
              <strong>{alert.geofence?.bufferMiles?.toFixed(2) || '1.00'}-mile buffer</strong> on corridor centerline
              {alert.geofence?.isCustomBuffer === false && hasRecommendation && (
                <span style={{ color: theme.colors.primary.main, fontWeight: '600' }}>
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
      <div>
        <h3 style={{
          color: "#111827",
          marginTop: 0,
          marginBottom: '16px',
          fontSize: '16px',
          fontWeight: '700'
        }}>
          Alert Messages
        </h3>

        {/* English Message */}
        <div style={{ marginBottom: theme.spacing.lg }}>
          <h4 style={{
            color: "#374151",
            marginBottom: theme.spacing.sm,
            fontSize: '14px',
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
              fontSize: '11px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Headline
            </div>
            <div style={{
              fontSize: '14px',
              color: "#111827",
              fontWeight: '700',
              marginBottom: theme.spacing.sm
            }}>
              {alert.messages?.english.headline}
            </div>

            <div style={{
              fontSize: '11px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Instruction
            </div>
            <div style={{
              fontSize: '13px',
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
            fontSize: '14px',
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
              fontSize: '11px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Headline
            </div>
            <div style={{
              fontSize: '14px',
              color: "#111827",
              fontWeight: '700',
              marginBottom: theme.spacing.sm
            }}>
              {alert.messages?.spanish.headline}
            </div>

            <div style={{
              fontSize: '11px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Instruction
            </div>
            <div style={{
              fontSize: '13px',
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
          fontSize: '11px',
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
      <div>
        <h3 style={{
          color: "#111827",
          marginTop: 0,
          marginBottom: '16px',
          fontSize: '16px',
          fontWeight: '700'
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
            fontSize: '11px',
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
              fontSize: '11px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs
            }}>
              Alert ID
            </div>
            <div style={{
              fontSize: '13px',
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
              fontSize: '11px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs
            }}>
              Expires
            </div>
            <div style={{
              fontSize: '13px',
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
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #d1d5db',
        width: '100%',
        minWidth: '900px',
        maxWidth: '1600px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '2px solid #e5e7eb',
          backgroundColor: '#f3f4f6',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              color: '#111827',
              fontSize: '18px',
              marginBottom: theme.spacing.xs,
              fontWeight: 'bold'
            }}>
              🚨 IPAWS Alert Generator
            </h2>
            <div style={{
              fontSize: '13px',
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
              fontSize: '18px',
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
          gap: '2px',
          borderBottom: '2px solid #e5e7eb',
          padding: `0 ${theme.spacing.md}`,
          backgroundColor: '#f9fafb'
        }}>
          {[
            { id: 'qualification', label: '✓ Qualify' },
            { id: 'geofence', label: '📍 Area', disabled: !alert?.success },
            { id: 'messages', label: '💬 Message', disabled: !alert?.success },
            { id: 'cap', label: '📄 CAP', disabled: !alert?.success }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              style={{
                background: activeTab === tab.id ? 'white' : 'transparent',
                border: 'none',
                padding: '10px 12px',
                color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                fontSize: '13px',
                fontWeight: '600',
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
                borderBottom: activeTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent',
                borderTop: activeTab === tab.id ? '2px solid #e5e7eb' : '2px solid transparent',
                borderLeft: activeTab === tab.id ? '1px solid #e5e7eb' : 'none',
                borderRight: activeTab === tab.id ? '1px solid #e5e7eb' : 'none',
                borderRadius: '8px 8px 0 0',
                marginBottom: '-2px',
                transition: 'all 0.2s',
                opacity: tab.disabled ? 0.4 : 1,
                whiteSpace: 'nowrap',
                flex: '1'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: 'white',
          padding: '24px'
        }}>
          {error && (
            <div style={{
              margin: theme.spacing.lg,
              padding: theme.spacing.md,
              backgroundColor: '#fee2e2',
              borderRadius: '8px',
              borderLeft: '4px solid #ef4444',
              color: '#991b1b'
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
            padding: '20px 24px',
            borderTop: "2px solid #e5e7eb",
            backgroundColor: '#f9fafb',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 20px',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#d1d5db';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
