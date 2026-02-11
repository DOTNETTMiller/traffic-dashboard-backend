import { useState, useEffect } from 'react';
import api from '../services/api';
import { theme } from '../styles/theme';
import SkeletonLoader from './SkeletonLoader';
// GLOBAL_TEXT_VISIBILITY_FIX_APPLIED: Ensures readable text on all backgrounds


export default function ParkingAccuracyMetrics({ authToken, currentUser }) {
  const [accuracy, setAccuracy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [retrainResult, setRetrainResult] = useState(null);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    loadAccuracyMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(loadAccuracyMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAccuracyMetrics = async () => {
    try {
      setLoading(true);
      const data = await api.getGroundTruthAccuracy();
      setAccuracy(data);
    } catch (error) {
      console.error('Error loading accuracy metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrain = async () => {
    if (!isAdmin) {
      alert('Only admins can retrain the model');
      return;
    }

    if (!confirm('Are you sure you want to retrain the model? This will update predictions based on ground truth observations.')) {
      return;
    }

    try {
      setRetraining(true);
      setRetrainResult(null);
      const result = await api.retrainParkingModel(authToken, 3);

      setRetrainResult(result);

      if (result.success) {
        // Reload accuracy metrics after retraining
        setTimeout(() => {
          loadAccuracyMetrics();
        }, 1000);
      }
    } catch (error) {
      console.error('Error retraining model:', error);
      setRetrainResult({
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to retrain model'
      });
    } finally {
      setRetraining(false);
    }
  };

  if (loading && !accuracy) {
    return (
      <div style={{
        backgroundColor: theme.colors.white,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.xl,
        boxShadow: theme.shadows.base,
        marginBottom: theme.spacing.xl
      }}>
        <SkeletonLoader variant="metric" count={3} style={{ marginBottom: theme.spacing.md }} />
      </div>
    );
  }

  if (!accuracy || accuracy.totalObservations === 0) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '24px'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600', color: '#111827' }}>
          📊 Model Accuracy Metrics
        </h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          No ground truth observations with predictions yet. Submit observations with predicted counts to see accuracy metrics.
        </p>
      </div>
    );
  }

  const getAccuracyColor = (mape) => {
    if (mape < 10) return '#22c55e'; // Green - excellent
    if (mape < 20) return '#fbbf24'; // Yellow - good
    if (mape < 30) return '#f59e0b'; // Orange - fair
    return '#ef4444'; // Red - needs improvement
  };

  const getAccuracyLabel = (mape) => {
    if (mape < 10) return 'Excellent';
    if (mape < 20) return 'Good';
    if (mape < 30) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div style={{
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.xl,
      boxShadow: theme.shadows.md,
      marginBottom: theme.spacing.xl,
      transition: theme.transitions.all
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '600', color: '#111827' }}>
            📊 Model Accuracy Metrics
          </h2>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            Based on {accuracy.validPredictions} ground truth observations
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleRetrain}
            disabled={retraining}
            style={{
              padding: '8px 16px',
              backgroundColor: retraining ? '#9ca3af' : '#3b82f6',
              color: '#111827',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: retraining ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => !retraining && (e.target.style.backgroundColor = '#2563eb')}
            onMouseOut={(e) => !retraining && (e.target.style.backgroundColor = '#3b82f6')}
          >
            {retraining ? '⏳ Retraining...' : '🔄 Retrain Model'}
          </button>
        )}
      </div>

      {/* Retrain Result */}
      {retrainResult && (
        <div style={{
          marginBottom: '20px',
          padding: '12px 16px',
          backgroundColor: retrainResult.success ? '#d1fae5' : '#fee2e2',
          borderRadius: '6px',
          borderLeft: `4px solid ${retrainResult.success ? '#22c55e' : '#ef4444'}`
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: retrainResult.success ? '#065f46' : '#991b1b',
            marginBottom: retrainResult.success ? '4px' : 0
          }}>
            {retrainResult.success ? '✅ ' + retrainResult.message : '❌ ' + (retrainResult.error || 'Retraining failed')}
          </div>
          {retrainResult.success && retrainResult.stats && (
            <div style={{ fontSize: '13px', color: '#059669' }}>
              Updated {retrainResult.stats.patternsUpdated} patterns, created {retrainResult.stats.patternsCreated} new patterns
              {' '}across {retrainResult.stats.facilitiesAffected} facilities
            </div>
          )}
        </div>
      )}

      {/* Overall Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          padding: '16px',
          backgroundcolor: '#6b7280',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
            Mean Absolute Error (MAE)
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
            {accuracy.metrics.mae}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            trucks per prediction
          </div>
        </div>

        <div style={{
          padding: '16px',
          backgroundcolor: '#6b7280',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
            Root Mean Squared Error (RMSE)
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
            {accuracy.metrics.rmse}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            trucks per prediction
          </div>
        </div>

        <div style={{
          padding: '16px',
          backgroundcolor: '#6b7280',
          borderRadius: '6px',
          border: `2px solid ${getAccuracyColor(accuracy.metrics.mape)}`
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
            Mean Absolute % Error
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: getAccuracyColor(accuracy.metrics.mape)
          }}>
            {accuracy.metrics.mape}%
          </div>
          <div style={{
            fontSize: '11px',
            color: getAccuracyColor(accuracy.metrics.mape),
            marginTop: '4px',
            fontWeight: '600'
          }}>
            {getAccuracyLabel(accuracy.metrics.mape)}
          </div>
        </div>
      </div>

      {/* Recent Observations */}
      {accuracy.recentObservations && accuracy.recentObservations.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#111827' }}>
            Recent Observations
          </h3>
          <div style={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: '6px'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ backgroundcolor: '#6b7280', position: 'sticky', top: 0 , color: '#111827'}}>
                <tr>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    Facility
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    Observed
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    Predicted
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    Error
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {accuracy.recentObservations.map((obs, index) => (
                  <tr key={obs.id} style={{
                    backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb'
                  }}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
                      <div style={{ fontSize: '12px', fontWeight: '500' }}>
                        {obs.facilityId.split('-').pop()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                        {obs.cameraView}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', fontWeight: '600', color: '#111827' }}>
                      {obs.observed}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>
                      {obs.predicted}
                    </td>
                    <td style={{
                      padding: '10px 12px',
                      textAlign: 'center',
                      borderBottom: '1px solid #f3f4f6',
                      fontWeight: '600',
                      color: obs.error > 5 ? '#ef4444' : obs.error > 2 ? '#f59e0b' : '#22c55e'
                    }}>
                      {obs.error}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', color: '#6b7280', fontSize: '12px' }}>
                      {new Date(obs.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
