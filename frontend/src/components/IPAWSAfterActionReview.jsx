import { useState, useEffect } from 'react';
import { theme } from '../styles/theme';
import { config } from '../config';

/**
 * IPAWS After-Action Review Component
 *
 * SOP Compliance:
 * - Section 11: Documentation & After-Action Review
 * - Section 6.4.5: After-Action Review for Stranded Motorists
 *
 * Features:
 * - Review form for completed alerts (within 7 days)
 * - Evaluate timing, geofence accuracy, messaging effectiveness
 * - Document public feedback and unintended reach
 * - Export logs for HSEMD coordination
 * - Integrate lessons learned into training materials
 */
export default function IPAWSAfterActionReview({ onClose }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [reviewInProgress, setReviewInProgress] = useState(false);
  const [saving, setSaving] = useState(false);

  // Review form fields (SOP Section 11 & 6.4.5)
  const [reviewData, setReviewData] = useState({
    // Timing evaluation
    timingRating: 'appropriate', // appropriate, early, delayed
    timingNotes: '',
    firstAlertDelay: '', // minutes from incident detection

    // Geofence accuracy
    geofenceRating: 'accurate', // accurate, too_wide, too_narrow
    geofenceNotes: '',
    unintendedReach: '', // Description of unintended recipients

    // Message effectiveness
    messageClarity: 'excellent', // excellent, good, fair, poor
    messageNotes: '',
    survivalGuidanceAppropriate: true, // For stranded motorist scenarios

    // Public feedback
    publicFeedback: '', // Comments from public, media, or agencies
    complaintCount: 0,
    positiveCount: 0,

    // Scope and impact
    populationReached: 0,
    actualIncidentDuration: '', // minutes
    hazardType: '',

    // Lessons learned
    lessonsLearned: '',
    recommendedChanges: '',
    trainingTopics: '',

    // Review metadata
    reviewedBy: '',
    reviewDate: new Date().toISOString().split('T')[0],
    reviewedWithin7Days: true
  });

  useEffect(() => {
    fetchCompletedAlerts();
  }, []);

  const fetchCompletedAlerts = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/alerts?status=completed&limit=50`);
      const data = await response.json();

      if (data.success) {
        // Filter alerts that need review or have been reviewed
        const alertsWithReviewStatus = (data.alerts || []).map(alert => {
          const createdDate = new Date(alert.created_at);
          const now = new Date();
          const daysSinceCreated = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));

          return {
            ...alert,
            daysSinceCreated,
            needsReview: daysSinceCreated <= 7 && !alert.review_completed,
            overdue: daysSinceCreated > 7 && !alert.review_completed,
            reviewed: alert.review_completed
          };
        });

        setAlerts(alertsWithReviewStatus);
      } else {
        setError(data.error || 'Failed to fetch completed alerts');
      }
    } catch (err) {
      console.error('Error fetching completed alerts:', err);
      setError('Failed to load completed alerts');
    } finally {
      setLoading(false);
    }
  };

  const startReview = (alert) => {
    setSelectedAlert(alert);
    setReviewInProgress(true);

    // Pre-populate with alert data
    setReviewData(prev => ({
      ...prev,
      populationReached: alert.population || 0,
      hazardType: alert.event_type || '',
      reviewedWithin7Days: alert.daysSinceCreated <= 7
    }));
  };

  const handleSubmitReview = async () => {
    if (!selectedAlert) return;

    setSaving(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/alerts/${selectedAlert.alert_id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: selectedAlert.alert_id,
          review: reviewData
        })
      });

      const data = await response.json();

      if (data.success) {
        window.alert(`✅ After-Action Review Completed!\n\nAlert: ${selectedAlert.event_corridor}\nReviewed by: ${reviewData.reviewedBy}\nDate: ${reviewData.reviewDate}\n\nPer SOP Section 11: Review findings will be integrated into training materials.`);

        // Reset and refresh
        setReviewInProgress(false);
        setSelectedAlert(null);
        setReviewData({
          timingRating: 'appropriate',
          timingNotes: '',
          firstAlertDelay: '',
          geofenceRating: 'accurate',
          geofenceNotes: '',
          unintendedReach: '',
          messageClarity: 'excellent',
          messageNotes: '',
          survivalGuidanceAppropriate: true,
          publicFeedback: '',
          complaintCount: 0,
          positiveCount: 0,
          populationReached: 0,
          actualIncidentDuration: '',
          hazardType: '',
          lessonsLearned: '',
          recommendedChanges: '',
          trainingTopics: '',
          reviewedBy: '',
          reviewDate: new Date().toISOString().split('T')[0],
          reviewedWithin7Days: true
        });
        fetchCompletedAlerts();
      } else {
        setError(data.error || 'Failed to submit review');
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      setError('Failed to submit review: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const exportForHSEMD = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/alerts/export-hsemd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeReviews: true,
          format: 'csv'
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ipaws-alerts-hsemd-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        window.alert('✅ HSEMD Export Complete!\n\nPer SOP Section 11: Share log copy with Iowa HSEMD IPAWS Coordinator.\n\nExport includes:\n- User, time, content, channels\n- Geofence polygons\n- Incident references\n- Review findings');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to export for HSEMD');
      }
    } catch (err) {
      console.error('Error exporting for HSEMD:', err);
      setError('Failed to export: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: theme.spacing.xl,
        textAlign: 'center',
        color: '#6b7280'
      }}>
        Loading completed alerts...
      </div>
    );
  }

  // Review form view
  if (reviewInProgress && selectedAlert) {
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
        padding: '20px',
        overflowY: 'auto'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #d1d5db',
          width: '100%',
          maxWidth: '900px',
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
            backgroundColor: '#f3f4f6'
          }}>
            <h2 style={{
              margin: 0,
              color: '#111827',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              📋 After-Action Review
            </h2>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginTop: '4px'
            }}>
              Alert: {selectedAlert.event_corridor} • Issued: {new Date(selectedAlert.created_at).toLocaleString()}
            </div>
            {!reviewData.reviewedWithin7Days && (
              <div style={{
                marginTop: '8px',
                padding: '6px 12px',
                backgroundColor: '#fee2e2',
                border: '1px solid #ef4444',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#991b1b',
                fontWeight: '600'
              }}>
                ⚠️ OVERDUE: Per SOP Section 11, reviews should be conducted within 7 days
              </div>
            )}
          </div>

          {/* Form Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px'
          }}>
            {error && (
              <div style={{
                padding: theme.spacing.md,
                backgroundColor: '#fee2e2',
                borderRadius: '8px',
                borderLeft: '4px solid #ef4444',
                color: '#991b1b',
                marginBottom: theme.spacing.lg,
                fontSize: '13px'
              }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* SOP Section Reference */}
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: '#dbeafe',
              borderRadius: '8px',
              border: '1px solid #3b82f6',
              marginBottom: theme.spacing.lg,
              fontSize: '12px',
              color: '#1e40af'
            }}>
              <strong>📋 SOP Section 11 & 6.4.5:</strong> Analyze timing, scope, unintended effects. Document public feedback. Integrate lessons into training materials.
            </div>

            {/* Section 1: Timing Evaluation */}
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '700',
                color: '#111827',
                marginBottom: theme.spacing.sm
              }}>
                1. Timing Evaluation
              </h3>

              <div style={{ marginBottom: theme.spacing.sm }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  First Alert Delay (minutes from incident detection):
                </label>
                <input
                  type="number"
                  value={reviewData.firstAlertDelay}
                  onChange={(e) => setReviewData({ ...reviewData, firstAlertDelay: e.target.value })}
                  placeholder="e.g., 15"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px'
                  }}
                />
              </div>

              <div style={{ marginBottom: theme.spacing.sm }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Timing Assessment:
                </label>
                <select
                  value={reviewData.timingRating}
                  onChange={(e) => setReviewData({ ...reviewData, timingRating: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px'
                  }}
                >
                  <option value="appropriate">Appropriate - Alert issued at optimal time</option>
                  <option value="early">Early - Alert could have waited longer</option>
                  <option value="delayed">Delayed - Alert should have been issued sooner</option>
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Timing Notes:
                </label>
                <textarea
                  value={reviewData.timingNotes}
                  onChange={(e) => setReviewData({ ...reviewData, timingNotes: e.target.value })}
                  rows={3}
                  placeholder="Explain timing decision, delays encountered, or improvements for future alerts..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            {/* Section 2: Geofence Accuracy */}
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '700',
                color: '#111827',
                marginBottom: theme.spacing.sm
              }}>
                2. Geofence Accuracy Assessment
              </h3>

              <div style={{ marginBottom: theme.spacing.sm }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Geofence Accuracy:
                </label>
                <select
                  value={reviewData.geofenceRating}
                  onChange={(e) => setReviewData({ ...reviewData, geofenceRating: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px'
                  }}
                >
                  <option value="accurate">Accurate - Targeted appropriate area</option>
                  <option value="too_wide">Too Wide - Included unnecessary areas</option>
                  <option value="too_narrow">Too Narrow - Missed affected areas</option>
                </select>
              </div>

              <div style={{ marginBottom: theme.spacing.sm }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Unintended Reach (who received alerts unnecessarily):
                </label>
                <textarea
                  value={reviewData.unintendedReach}
                  onChange={(e) => setReviewData({ ...reviewData, unintendedReach: e.target.value })}
                  rows={2}
                  placeholder="e.g., Residents of downtown Des Moines, drivers on parallel local roads..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Geofence Notes:
                </label>
                <textarea
                  value={reviewData.geofenceNotes}
                  onChange={(e) => setReviewData({ ...reviewData, geofenceNotes: e.target.value })}
                  rows={3}
                  placeholder="Buffer width appropriate? Corridor length accurate? Urban areas properly excluded?"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            {/* Section 3: Message Effectiveness */}
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '700',
                color: '#111827',
                marginBottom: theme.spacing.sm
              }}>
                3. Message Effectiveness
              </h3>

              <div style={{ marginBottom: theme.spacing.sm }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Message Clarity:
                </label>
                <select
                  value={reviewData.messageClarity}
                  onChange={(e) => setReviewData({ ...reviewData, messageClarity: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px'
                  }}
                >
                  <option value="excellent">Excellent - Clear, actionable, concise</option>
                  <option value="good">Good - Understandable with minor improvements possible</option>
                  <option value="fair">Fair - Confusing or missing key information</option>
                  <option value="poor">Poor - Unclear or misleading</option>
                </select>
              </div>

              {/* Stranded Motorist Scenarios */}
              {(selectedAlert.event_type?.toLowerCase().includes('closure') ||
                selectedAlert.event_description?.toLowerCase().includes('stranded')) && (
                <div style={{
                  marginBottom: theme.spacing.sm,
                  padding: theme.spacing.sm,
                  backgroundColor: '#fef3c7',
                  borderRadius: '6px',
                  border: '1px solid #f59e0b'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#92400e',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={reviewData.survivalGuidanceAppropriate}
                      onChange={(e) => setReviewData({ ...reviewData, survivalGuidanceAppropriate: e.target.checked })}
                    />
                    Survival Guidance Appropriate (SOP 6.4.3)
                  </label>
                  <div style={{
                    fontSize: '11px',
                    color: '#78350f',
                    marginTop: '4px',
                    marginLeft: '24px'
                  }}>
                    For stranded motorist scenarios: stay in vehicle, conserve fuel, safety instructions
                  </div>
                </div>
              )}

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Message Notes:
                </label>
                <textarea
                  value={reviewData.messageNotes}
                  onChange={(e) => setReviewData({ ...reviewData, messageNotes: e.target.value })}
                  rows={3}
                  placeholder="Direction clear? Mile markers included? Audience qualifier present? 511ia.org referenced?"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            {/* Section 4: Public Feedback */}
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '700',
                color: '#111827',
                marginBottom: theme.spacing.sm
              }}>
                4. Public Feedback & Impact
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: theme.spacing.sm,
                marginBottom: theme.spacing.sm
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '6px'
                  }}>
                    Complaint Count:
                  </label>
                  <input
                    type="number"
                    value={reviewData.complaintCount}
                    onChange={(e) => setReviewData({ ...reviewData, complaintCount: parseInt(e.target.value) || 0 })}
                    min="0"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '6px'
                  }}>
                    Positive Feedback Count:
                  </label>
                  <input
                    type="number"
                    value={reviewData.positiveCount}
                    onChange={(e) => setReviewData({ ...reviewData, positiveCount: parseInt(e.target.value) || 0 })}
                    min="0"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: theme.spacing.sm }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Actual Incident Duration (minutes):
                </label>
                <input
                  type="number"
                  value={reviewData.actualIncidentDuration}
                  onChange={(e) => setReviewData({ ...reviewData, actualIncidentDuration: e.target.value })}
                  placeholder="e.g., 240"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Public Feedback Summary:
                </label>
                <textarea
                  value={reviewData.publicFeedback}
                  onChange={(e) => setReviewData({ ...reviewData, publicFeedback: e.target.value })}
                  rows={4}
                  placeholder="Comments from motorists, media coverage, agency partners, social media reactions..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            {/* Section 5: Lessons Learned */}
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '700',
                color: '#111827',
                marginBottom: theme.spacing.sm
              }}>
                5. Lessons Learned & Training Integration
              </h3>

              <div style={{ marginBottom: theme.spacing.sm }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Lessons Learned:
                </label>
                <textarea
                  value={reviewData.lessonsLearned}
                  onChange={(e) => setReviewData({ ...reviewData, lessonsLearned: e.target.value })}
                  rows={4}
                  placeholder="What went well? What could be improved? Unexpected challenges?"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: theme.spacing.sm }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Recommended Policy/Procedure Changes:
                </label>
                <textarea
                  value={reviewData.recommendedChanges}
                  onChange={(e) => setReviewData({ ...reviewData, recommendedChanges: e.target.value })}
                  rows={3}
                  placeholder="SOP updates, workflow improvements, system enhancements..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Topics for Annual Training Refresher:
                </label>
                <textarea
                  value={reviewData.trainingTopics}
                  onChange={(e) => setReviewData({ ...reviewData, trainingTopics: e.target.value })}
                  rows={3}
                  placeholder="Geofence drawing, message crafting, timing decisions, specific scenario types..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            {/* Section 6: Review Metadata */}
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '700',
                color: '#111827',
                marginBottom: theme.spacing.sm
              }}>
                6. Review Information
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: theme.spacing.sm
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '6px'
                  }}>
                    Reviewed By:
                  </label>
                  <input
                    type="text"
                    value={reviewData.reviewedBy}
                    onChange={(e) => setReviewData({ ...reviewData, reviewedBy: e.target.value })}
                    placeholder="Your name"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '6px'
                  }}>
                    Review Date:
                  </label>
                  <input
                    type="date"
                    value={reviewData.reviewDate}
                    onChange={(e) => setReviewData({ ...reviewData, reviewDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '20px 24px',
            borderTop: '2px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <button
              onClick={() => {
                setReviewInProgress(false);
                setSelectedAlert(null);
              }}
              disabled={saving}
              style={{
                padding: '10px 20px',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: saving ? 'wait' : 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleSubmitReview}
              disabled={saving || !reviewData.reviewedBy}
              style={{
                padding: '10px 20px',
                backgroundColor: !reviewData.reviewedBy ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: saving || !reviewData.reviewedBy ? 'not-allowed' : 'pointer',
                opacity: saving || !reviewData.reviewedBy ? 0.6 : 1
              }}
            >
              {saving ? '⏳ Submitting...' : '✓ Submit Review'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main list view
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
        maxWidth: '1000px',
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              color: '#111827',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              📋 After-Action Reviews
            </h2>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginTop: '4px'
            }}>
              SOP Section 11: Conduct review within 7 days • Integrate lessons into training
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#ef4444',
              border: 'none',
              color: 'white',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '8px',
              fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white',
          display: 'flex',
          gap: '12px'
        }}>
          <button
            onClick={exportForHSEMD}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📤 Export for HSEMD
          </button>

          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            padding: '8px',
            fontStyle: 'italic'
          }}>
            Per SOP: Share log copy with Iowa HSEMD IPAWS Coordinator
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px'
        }}>
          {error && (
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: '#fee2e2',
              borderRadius: '8px',
              borderLeft: '4px solid #ef4444',
              color: '#991b1b',
              marginBottom: theme.spacing.lg
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {alerts.length === 0 ? (
            <div style={{
              padding: theme.spacing.xl,
              textAlign: 'center',
              color: '#9ca3af'
            }}>
              <div style={{ fontSize: '48px', marginBottom: theme.spacing.md }}>📋</div>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                No Completed Alerts
              </div>
              <div style={{ fontSize: '13px' }}>
                After-action reviews will appear here for alerts that have been completed.
              </div>
            </div>
          ) : (
            <>
              {/* Alert Cards */}
              {alerts.map(alert => (
                <div
                  key={alert.alert_id}
                  style={{
                    padding: theme.spacing.md,
                    backgroundColor: alert.overdue ? '#fee2e2' : (alert.needsReview ? '#fef3c7' : (alert.reviewed ? '#dcfce7' : 'white')),
                    borderRadius: '8px',
                    border: alert.overdue ? '2px solid #ef4444' : (alert.needsReview ? '2px solid #f59e0b' : (alert.reviewed ? '1px solid #22c55e' : '1px solid #e5e7eb')),
                    marginBottom: theme.spacing.md
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    marginBottom: theme.spacing.sm
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '700',
                        color: '#111827',
                        marginBottom: '4px'
                      }}>
                        {alert.event_corridor || 'Highway Closure'}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        lineHeight: '1.6'
                      }}>
                        <div>Issued: {new Date(alert.created_at).toLocaleString()}</div>
                        <div>Duration: {alert.duration_minutes || 'N/A'} minutes</div>
                        {alert.daysSinceCreated !== undefined && (
                          <div>Days since alert: {alert.daysSinceCreated}</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {alert.reviewed ? (
                        <div style={{
                          padding: '6px 12px',
                          backgroundColor: '#22c55e',
                          color: 'white',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          ✓ Reviewed
                        </div>
                      ) : alert.overdue ? (
                        <div style={{
                          padding: '6px 12px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          ⚠️ OVERDUE
                        </div>
                      ) : alert.needsReview ? (
                        <div style={{
                          padding: '6px 12px',
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          📋 Needs Review
                        </div>
                      ) : null}

                      {!alert.reviewed && (
                        <button
                          onClick={() => startReview(alert)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Start Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
