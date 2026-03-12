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
  const [trainingMode, setTrainingMode] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [recommendedTemplate, setRecommendedTemplate] = useState(null);

  // Editable message fields
  const [editableMessages, setEditableMessages] = useState({
    english: {
      headline: '',
      instruction: ''
    },
    spanish: {
      headline: '',
      instruction: ''
    }
  });
  const [messagesEdited, setMessagesEdited] = useState(false);

  // Geofence adjustment parameters
  const [bufferFeet, setBufferFeet] = useState(100); // Default 100 feet
  const [corridorLengthMiles, setCorridorLengthMiles] = useState(null); // null = full length
  const [advanceWarningMode, setAdvanceWarningMode] = useState(true); // Toggle for asymmetric corridor (default enabled)
  const [corridorAheadMiles, setCorridorAheadMiles] = useState(2.0); // Distance ahead of event
  const [corridorBehindMiles, setCorridorBehindMiles] = useState(0.5); // Distance behind event
  const [avoidUrbanAreas, setAvoidUrbanAreas] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (event) {
      generateAlert();
      fetchTemplateRecommendation();
    }
  }, [event]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/templates`);
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const fetchTemplateRecommendation = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/templates/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event })
      });
      const data = await response.json();
      if (data.success) {
        setRecommendedTemplate(data);
      }
    } catch (err) {
      console.error('Failed to fetch template recommendation:', err);
    }
  };

  // Update parent with geofence data when alert is loaded
  useEffect(() => {
    if (alert?.success && alert?.geofence && onGeofenceUpdate) {
      console.log('🗺️ Sending geofence to map:', alert.geofence);
      onGeofenceUpdate(alert.geofence);
    }
  }, [alert, onGeofenceUpdate]);

  // Initialize editable messages when alert is loaded
  useEffect(() => {
    if (alert?.success && alert?.messages) {
      setEditableMessages({
        english: {
          headline: alert.messages.english.headline || '',
          instruction: alert.messages.english.instruction || ''
        },
        spanish: {
          headline: alert.messages.spanish.headline || '',
          instruction: alert.messages.spanish.instruction || ''
        }
      });
      setMessagesEdited(false);
    }
  }, [alert]);

  // Handle message edits
  const handleMessageEdit = (language, field, value) => {
    setEditableMessages(prev => ({
      ...prev,
      [language]: {
        ...prev[language],
        [field]: value
      }
    }));
    setMessagesEdited(true);

    // Update alert object with new character counts
    if (alert?.success) {
      const updatedAlert = { ...alert };
      updatedAlert.messages[language][field] = value;

      // Recalculate character count
      const fullMessage = `${language === 'english' ? updatedAlert.messages.english.headline : updatedAlert.messages.spanish.headline} ${language === 'english' ? updatedAlert.messages.english.instruction : updatedAlert.messages.spanish.instruction}`;
      updatedAlert.messages[language].characterCount = fullMessage.length;
      updatedAlert.messages[language].exceedsWEALimit = fullMessage.length > 360;

      setAlert(updatedAlert);
    }
  };

  // Reset messages to system-generated values
  const resetMessages = () => {
    if (alert?.success && alert?.messages) {
      generateAlert(); // Regenerate the whole alert
      setMessagesEdited(false);
    }
  };

  const generateAlert = async () => {
    setLoading(true);
    setError(null);

    try {
      // Pass default SOP-compliant parameters: 100ft buffer, 2mi ahead, 0.5mi behind
      const response = await fetch(`${config.apiUrl}/api/ipaws/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          trainingMode,
          bufferFeet: bufferFeet,  // Default 100 feet
          corridorAheadMiles: corridorAheadMiles,  // Default 2.0 miles
          corridorBehindMiles: corridorBehindMiles  // Default 0.5 miles
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to generate IPAWS alert');
        setAlert(null);
        return;
      }

      setAlert(data);

      // Initialize buffer from generated geofence (convert miles to feet)
      if (data?.geofence?.bufferMiles) {
        setBufferFeet(Math.round(data.geofence.bufferMiles * 5280));
      }
    } catch (err) {
      setError(err.message);
      setAlert(null);
    } finally {
      setLoading(false);
    }
  };


  const handleRegenerateGeofence = async () => {
    setRegenerating(true);
    setError(null);

    try {
      const requestBody = {
        event,
        bufferFeet,
        avoidUrbanAreas,
        trainingMode
      };

      // Add corridor parameters based on mode
      if (advanceWarningMode) {
        requestBody.corridorAheadMiles = corridorAheadMiles;
        requestBody.corridorBehindMiles = corridorBehindMiles;
      } else if (corridorLengthMiles) {
        requestBody.corridorLengthMiles = corridorLengthMiles;
      }

      const response = await fetch(`${config.apiUrl}/api/ipaws/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

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

  // Helper function to format buffer display
  const formatBufferDisplay = (bufferMiles) => {
    if (!bufferMiles) return '0 feet';
    if (bufferMiles < 0.5) {
      return `${Math.round(bufferMiles * 5280)} feet`;
    }
    return `${bufferMiles.toFixed(2)} miles`;
  };

  const handleSaveGeofence = async () => {
    if (!alert?.geofence) return;

    setSaving(true);
    setError(null);

    try {
      // Update alert with edited messages before saving
      const updatedAlert = { ...alert };
      updatedAlert.messages.english.headline = editableMessages.english.headline;
      updatedAlert.messages.english.instruction = editableMessages.english.instruction;
      updatedAlert.messages.spanish.headline = editableMessages.spanish.headline;
      updatedAlert.messages.spanish.instruction = editableMessages.spanish.instruction;

      const response = await fetch(`${config.apiUrl}/api/events/${event.id}/geofence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geofence: alert.geofence,
          population: alert.geofence.estimatedPopulation,
          overridePopulation: overridePopulation,
          bufferMiles: alert.geofence.bufferMiles,
          messages: updatedAlert.messages, // Include edited messages
          trainingMode
        })
      });

      if (response.ok) {
        const result = await response.json();
        const bufferDisplay = alert.geofence.bufferMiles < 0.5
          ? `${Math.round(alert.geofence.bufferMiles * 5280)} feet`
          : `${alert.geofence.bufferMiles.toFixed(2)} miles`;

        const messageStatus = messagesEdited ? '\n\n✏️ Custom messages saved' : '';
        window.alert(`✅ Geofence saved to event!\n\nPopulation: ${alert.geofence.estimatedPopulation.toLocaleString()}\nBuffer: ${bufferDisplay}${messageStatus}\n\nThe geofence will now appear on the map for this event.`);
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
    if (!alert.recommended) {
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

          {alert.warnings && alert.warnings.length > 0 ? (
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
          ) : (
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              borderLeft: '4px solid #f59e0b',
              marginBottom: theme.spacing.md
            }}>
              <p style={{ color: '#92400e', margin: 0, fontWeight: '600' }}>
                ⚠️ This event does not meet all IPAWS alert criteria. Review the requirements below and use the Area tab to adjust the geofence parameters.
              </p>
            </div>
          )}

          {alert.warnings && alert.warnings.length > 0 && (
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
          )}

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

        {/* SOP Appendix B: Decision Matrix Helper */}
        <div style={{
          padding: theme.spacing.md,
          backgroundColor: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: '8px',
          marginBottom: theme.spacing.lg
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.sm
          }}>
            <div style={{ fontSize: '18px' }}>🎯</div>
            <h4 style={{
              margin: 0,
              color: '#92400e',
              fontSize: '14px',
              fontWeight: '700'
            }}>
              SOP Appendix B: Decision Matrix for Stranded Motorists
            </h4>
          </div>

          <div style={{
            display: 'grid',
            gap: theme.spacing.sm
          }}>
            <div style={{
              padding: theme.spacing.sm,
              backgroundColor: 'white',
              borderRadius: '6px',
              border: '1px solid #fde68a'
            }}>
              <div style={{ fontSize: '12px', color: '#78350f', fontWeight: '600', marginBottom: '4px' }}>
                ℹ️ Stopped {'<'}30 min, no severe weather
              </div>
              <div style={{ fontSize: '11px', color: '#92400e' }}>
                → Use DMS / 511 only
              </div>
            </div>

            <div style={{
              padding: theme.spacing.sm,
              backgroundColor: 'white',
              borderRadius: '6px',
              border: '1px solid #fde68a'
            }}>
              <div style={{ fontSize: '12px', color: '#78350f', fontWeight: '600', marginBottom: '4px' }}>
                ⚠️ Stopped 30-60 min, normal weather
              </div>
              <div style={{ fontSize: '11px', color: '#92400e' }}>
                → Consider IPAWS if no diversion available
              </div>
            </div>

            <div style={{
              padding: theme.spacing.sm,
              backgroundColor: '#fee2e2',
              borderRadius: '6px',
              border: '2px solid #ef4444'
            }}>
              <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: '700', marginBottom: '4px' }}>
                🚨 Stopped 30+ min in blizzard/extreme cold
              </div>
              <div style={{ fontSize: '11px', color: '#7f1d1d', fontWeight: '600' }}>
                → ACTIVATE WEA IMMEDIATELY
              </div>
            </div>

            <div style={{
              padding: theme.spacing.sm,
              backgroundColor: '#fee2e2',
              borderRadius: '6px',
              border: '2px solid #ef4444'
            }}>
              <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: '700', marginBottom: '4px' }}>
                🚨 Stopped 60+ min in extreme heat
              </div>
              <div style={{ fontSize: '11px', color: '#7f1d1d', fontWeight: '600' }}>
                → ACTIVATE WEA with heat safety guidance
              </div>
            </div>

            <div style={{
              padding: theme.spacing.sm,
              backgroundColor: '#fee2e2',
              borderRadius: '6px',
              border: '2px solid #ef4444'
            }}>
              <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: '700', marginBottom: '4px' }}>
                🚨 Flooding or rising water near vehicles
              </div>
              <div style={{ fontSize: '11px', color: '#7f1d1d', fontWeight: '600' }}>
                → IMMEDIATE WEA
              </div>
            </div>

            <div style={{
              padding: theme.spacing.sm,
              backgroundColor: '#fee2e2',
              borderRadius: '6px',
              border: '2px solid #ef4444'
            }}>
              <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: '700', marginBottom: '4px' }}>
                🚨 Hazmat with shelter-in-place required
              </div>
              <div style={{ fontSize: '11px', color: '#7f1d1d', fontWeight: '600' }}>
                → IMMEDIATE WEA
              </div>
            </div>
          </div>

          <div style={{
            marginTop: theme.spacing.sm,
            padding: theme.spacing.sm,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#78350f',
            fontStyle: 'italic'
          }}>
            <strong>Reminders:</strong> Renew alerts every 60-90 min if hazard persists (max 4 hrs). Cancel once traffic moving. Always geofence to smallest segment with audience qualifier.
          </div>
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
    if (!alert?.success || !alert?.geofence) return null;

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
                The {formatBufferDisplay(alert.geofence.bufferMiles)} buffer zone (orange polygon) is displayed on the map. <strong>Close this modal to see it clearly.</strong>
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
        {alert.geofence?.populationBreakdown && (alert.geofence.populationBreakdown.rural !== undefined || alert.geofence.populationBreakdown.urban !== undefined) && (
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
                  {(alert.geofence.populationBreakdown.rural || 0).toLocaleString()}
                </div>
              </div>
              <div style={{
                padding: theme.spacing.sm,
                background: "#f3f4f6",
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '10px', color: "#9ca3af" }}>🏙️ Urban</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: theme.colors.warning.main }}>
                  {(alert.geofence.populationBreakdown.urban || 0).toLocaleString()}
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
              Area ({formatBufferDisplay(alert.geofence?.bufferMiles)} buffer)
              {alert.geofence?.isAsymmetric && (
                <span style={{ color: theme.colors.primary.main, fontWeight: '600', marginLeft: '4px' }}>
                  🚨 Advance Warning
                </span>
              )}
            </div>
            <div style={{
              fontSize: '16px',
              color: "#111827",
              fontWeight: '700'
            }}>
              {alert.geofence?.areaSquareMiles?.toFixed(1) || 'N/A'} mi²
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
                Buffer Width: {bufferFeet} feet {bufferFeet >= 5280 ? `(${(bufferFeet / 5280).toFixed(2)} mi)` : ''}
              </label>
              <input
                type="range"
                min="50"
                max="10000"
                step="50"
                value={bufferFeet}
                onChange={(e) => setBufferFeet(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'rgba(255,255,255,0.7)' }}>
                <span>50 ft (very narrow)</span>
                <span>10,000 ft / 1.9 mi (wider)</span>
              </div>
            </div>

            {/* Advance Warning Mode Toggle */}
            <div style={{
              marginBottom: theme.spacing.sm,
              padding: theme.spacing.sm,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <input
                type="checkbox"
                id="advance-warning-mode"
                checked={advanceWarningMode}
                onChange={(e) => setAdvanceWarningMode(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="advance-warning-mode" style={{
                color: 'white',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                margin: 0,
                flex: 1
              }}>
                🚨 Advance Warning Mode (extend ahead of event)
              </label>
            </div>

            {/* Asymmetric Corridor Controls (Advance Warning Mode) */}
            {advanceWarningMode ? (
              <>
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <label style={{ color: 'white', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                    Distance Ahead of Event: {corridorAheadMiles} miles
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={corridorAheadMiles}
                    onChange={(e) => setCorridorAheadMiles(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'rgba(255,255,255,0.7)' }}>
                    <span>1 mi</span>
                    <span>10 mi (more advance warning)</span>
                  </div>
                </div>

                <div style={{ marginBottom: theme.spacing.sm }}>
                  <label style={{ color: 'white', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                    Distance Behind Event: {corridorBehindMiles} miles
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.25"
                    value={corridorBehindMiles}
                    onChange={(e) => setCorridorBehindMiles(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'rgba(255,255,255,0.7)' }}>
                    <span>0 mi</span>
                    <span>3 mi</span>
                  </div>
                </div>
              </>
            ) : (
              /* Symmetric Corridor Length (Legacy Mode) */
              <div style={{ marginBottom: theme.spacing.sm }}>
                <label style={{ color: 'white', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                  Corridor Length (optional, miles centered on event)
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
            )}

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
              🌾 Exclude Urban Areas ({(alert.geofence?.populationBreakdown?.urban || 0).toLocaleString()} people)
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
              <strong>{formatBufferDisplay(alert.geofence?.bufferMiles)} buffer</strong> on corridor centerline
              {alert.geofence?.isCustomBuffer === false && hasRecommendation && (
                <span style={{ color: theme.colors.primary.main, fontWeight: '600' }}>
                  {' '}(intelligent recommendation)
                </span>
              )}
            </li>
            {alert.geofence?.isAsymmetric && (
              <li style={{ color: theme.colors.primary.main, fontWeight: '600' }}>
                🚨 Advance Warning Mode: {alert.geofence.corridorAheadMiles} mi ahead, {alert.geofence.corridorBehindMiles} mi behind event
              </li>
            )}
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

        {/* SOP Template Recommendation */}
        {recommendedTemplate && (
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: '#dbeafe',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            marginBottom: theme.spacing.lg
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
              marginBottom: theme.spacing.sm
            }}>
              <div style={{ fontSize: '16px' }}>📋</div>
              <div style={{
                fontSize: '13px',
                fontWeight: '700',
                color: '#1e40af'
              }}>
                SOP Appendix A Template: {recommendedTemplate.templateLabel}
              </div>
            </div>
            <div style={{
              padding: theme.spacing.sm,
              backgroundColor: 'white',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#1e3a8a',
              fontFamily: 'monospace',
              border: '1px solid #93c5fd'
            }}>
              {recommendedTemplate.filledMessage}
            </div>
            <div style={{
              fontSize: '11px',
              color: '#1e3a8a',
              marginTop: theme.spacing.xs,
              fontStyle: 'italic'
            }}>
              💡 This template is recommended based on the event type. The system-generated message below follows SOP requirements including audience qualifiers, direction, and mile markers.
            </div>
          </div>
        )}

        {/* English Message */}
        <div style={{ marginBottom: theme.spacing.lg }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.sm
          }}>
            <h4 style={{
              color: "#374151",
              margin: 0,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.xs
            }}>
              🇺🇸 English (Primary - 90 characters)
            </h4>
            {messagesEdited && (
              <button
                onClick={resetMessages}
                style={{
                  padding: '4px 12px',
                  fontSize: '11px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#374151',
                  fontWeight: '600'
                }}
              >
                ↻ Reset to Auto-Generated
              </button>
            )}
          </div>
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
            <input
              type="text"
              value={editableMessages.english.headline}
              onChange={(e) => handleMessageEdit('english', 'headline', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                color: "#111827",
                fontWeight: '700',
                border: '2px solid #d1d5db',
                borderRadius: '6px',
                marginBottom: theme.spacing.sm,
                fontFamily: 'inherit',
                backgroundColor: 'white'
              }}
              placeholder="Enter headline..."
            />

            <div style={{
              fontSize: '11px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Instruction
            </div>
            <textarea
              value={editableMessages.english.instruction}
              onChange={(e) => handleMessageEdit('english', 'instruction', e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                color: "#374151",
                border: '2px solid #d1d5db',
                borderRadius: '6px',
                marginBottom: theme.spacing.sm,
                fontFamily: 'inherit',
                resize: 'vertical',
                backgroundColor: 'white'
              }}
              placeholder="Enter instruction..."
            />

            {/* WEA Character Counter */}
            <div style={{
              marginTop: theme.spacing.sm,
              padding: theme.spacing.sm,
              backgroundColor: alert.messages?.english.exceedsWEALimit ? '#fee2e2' : '#dcfce7',
              border: `2px solid ${alert.messages?.english.exceedsWEALimit ? '#ef4444' : '#22c55e'}`,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '700',
                color: alert.messages?.english.exceedsWEALimit ? '#991b1b' : '#166534'
              }}>
                WEA Character Count: {alert.messages?.english.characterCount}/360
              </div>
              {alert.messages?.english.exceedsWEALimit ? (
                <div style={{
                  fontSize: '11px',
                  color: '#991b1b',
                  fontWeight: '600'
                }}>
                  ⚠️ Exceeds limit by {alert.messages.english.characterCount - 360} chars
                </div>
              ) : (
                <div style={{
                  fontSize: '11px',
                  color: '#166534',
                  fontWeight: '600'
                }}>
                  ✅ Within WEA limit
                </div>
              )}
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
            <input
              type="text"
              value={editableMessages.spanish.headline}
              onChange={(e) => handleMessageEdit('spanish', 'headline', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                color: "#111827",
                fontWeight: '700',
                border: '2px solid #d1d5db',
                borderRadius: '6px',
                marginBottom: theme.spacing.sm,
                fontFamily: 'inherit',
                backgroundColor: 'white'
              }}
              placeholder="Ingrese el título..."
            />

            <div style={{
              fontSize: '11px',
              color: "#6b7280",
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Instruction
            </div>
            <textarea
              value={editableMessages.spanish.instruction}
              onChange={(e) => handleMessageEdit('spanish', 'instruction', e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                color: "#374151",
                border: '2px solid #d1d5db',
                borderRadius: '6px',
                marginBottom: theme.spacing.sm,
                fontFamily: 'inherit',
                resize: 'vertical',
                backgroundColor: 'white'
              }}
              placeholder="Ingrese las instrucciones..."
            />

            {/* WEA Character Counter for Spanish */}
            <div style={{
              marginTop: theme.spacing.sm,
              padding: theme.spacing.sm,
              backgroundColor: (alert.messages?.spanish.characterCount > 360) ? '#fee2e2' : '#dcfce7',
              border: `2px solid ${(alert.messages?.spanish.characterCount > 360) ? '#ef4444' : '#22c55e'}`,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '700',
                color: (alert.messages?.spanish.characterCount > 360) ? '#991b1b' : '#166534'
              }}>
                WEA Character Count: {alert.messages?.spanish.characterCount}/360
              </div>
              {(alert.messages?.spanish.characterCount > 360) ? (
                <div style={{
                  fontSize: '11px',
                  color: '#991b1b',
                  fontWeight: '600'
                }}>
                  ⚠️ Exceeds limit by {alert.messages.spanish.characterCount - 360} chars
                </div>
              ) : (
                <div style={{
                  fontSize: '11px',
                  color: '#166534',
                  fontWeight: '600'
                }}>
                  ✅ Within WEA limit
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editing Notes */}
        <div style={{
          padding: theme.spacing.md,
          backgroundColor: "#eff6ff",
          borderRadius: '8px',
          fontSize: '11px',
          color: "#1e40af",
          border: '1px solid #3b82f6',
          marginBottom: theme.spacing.md
        }}>
          <div style={{ fontWeight: '700', marginBottom: '6px', fontSize: '12px' }}>
            ✏️ Message Editing Tips
          </div>
          <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
            <li>Keep messages clear and concise - drivers have seconds to read</li>
            <li>Always include direction (EB/WB/NB/SB) and mile markers per SOP Section 7.3</li>
            <li>Include audience qualifier ("For drivers on I-80 EB only") per SOP</li>
            <li>Stay under 360 characters for WEA compatibility</li>
            <li>End with "511ia.org" for more information</li>
            <li>For stranded motorists: Include safety guidance and reassurance per SOP 6.4.3</li>
          </ul>
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
            <div style={{
              marginTop: theme.spacing.sm,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: trainingMode ? '#fed7aa' : '#e5e7eb',
              borderRadius: '6px',
              border: trainingMode ? '2px solid #f97316' : '1px solid #d1d5db'
            }}>
              <input
                type="checkbox"
                id="training-mode"
                checked={trainingMode}
                onChange={(e) => setTrainingMode(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="training-mode" style={{
                color: trainingMode ? '#7c2d12' : '#374151',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                margin: 0
              }}>
                🎓 Training Mode {trainingMode ? '(Active)' : ''}
              </label>
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
          {/* Training Mode Banner */}
          {trainingMode && (
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: '#fed7aa',
              borderRadius: '8px',
              border: '2px solid #f97316',
              marginBottom: theme.spacing.lg,
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm
            }}>
              <div style={{ fontSize: '20px' }}>🎓</div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#7c2d12',
                  marginBottom: '4px'
                }}>
                  Training Mode Active
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#9a3412'
                }}>
                  Alerts created in training mode will be logged but <strong>will not be transmitted to IPAWS</strong>. This is a safe environment for practice and learning.
                </div>
              </div>
            </div>
          )}
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
