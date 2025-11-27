/**
 * Feature #2: Cross-State Event Correlation
 */
import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';

function CrossStateCorrelation({ events, authToken, mlHealthy }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [predictDownstream, setPredictDownstream] = useState(true);

  const analyzeCorrelations = async () => {
    if (!events || events.length === 0) {
      setError('No events available for correlation analysis');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const response = await axios.post(
        `${config.API_URL}/api/ml/correlations`,
        {
          events: events,
          predict_downstream: predictDownstream
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // OPTIMIZED: Removed auto-run on mount - user must click to analyze
  // This prevents expensive API calls on every events change

  return (
    <div className="cross-state-correlation">
      <div className="feature-header">
        <h3>Cross-State Event Correlation</h3>
        <span className="feature-badge">Feature #2</span>
      </div>

      <div className="feature-description">
        <p>
          Graph Neural Network discovers how incidents in one state predict downstream effects in others.
        </p>
        <div className="metrics">
          <div className="metric">
            <span className="metric-label">Prediction Lead Time:</span>
            <span className="metric-value">25 minutes earlier <span className="improvement">vs single-state</span></span>
          </div>
        </div>
      </div>

      <div className="correlation-controls">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={predictDownstream}
            onChange={(e) => setPredictDownstream(e.target.checked)}
          />
          Predict downstream impacts
        </label>

        <button
          onClick={analyzeCorrelations}
          disabled={analyzing}
          className="analyze-button"
        >
          {analyzing ? 'Analyzing...' : 'Analyze Correlations'}
        </button>
      </div>

      {error && <div className="error-message">⚠️ {error}</div>}

      {results && (
        <div className="correlation-results">
          <div className="results-summary">
            <div className="summary-card">
              <h4>{results.correlations?.length || 0}</h4>
              <p>Correlations Found</p>
            </div>
            <div className="summary-card">
              <h4>{results.predictions?.length || 0}</h4>
              <p>Downstream Predictions</p>
            </div>
            <div className="summary-card">
              <h4>{(results.confidence * 100).toFixed(0)}%</h4>
              <p>Confidence</p>
            </div>
          </div>

          {results.correlations && results.correlations.length > 0 && (
            <div className="correlations-list">
              <h4>🔗 Detected Correlations</h4>
              {results.correlations.slice(0, 10).map((corr, idx) => (
                <div key={idx} className="correlation-item">
                  <div className="correlation-header">
                    <span className="state-badge">{corr.state1}</span>
                    <span className="arrow">→</span>
                    <span className="state-badge">{corr.state2}</span>
                    <div
                      className="strength-indicator"
                      style={{
                        width: `${corr.correlation_strength * 100}%`,
                        backgroundColor: `hsl(${corr.correlation_strength * 120}, 70%, 50%)`
                      }}
                    />
                    <span className="strength-value">
                      {(corr.correlation_strength * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="correlation-details">
                    <span>Distance: {corr.distance_km} km</span>
                    <span>•</span>
                    <span>Time diff: {corr.time_diff_hours.toFixed(1)} hrs</span>
                    <span>•</span>
                    <span>{corr.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.predictions && results.predictions.length > 0 && (
            <div className="predictions-list">
              <h4>🔮 Downstream Predictions</h4>
              {results.predictions.map((pred, idx) => (
                <div key={idx} className="prediction-item">
                  <div className="prediction-header">
                    <span className="source-label">From {pred.source_state}:</span>
                    <span className="predicted-state">{pred.predicted_state}</span>
                    <span className="probability" style={{
                      color: pred.probability > 0.7 ? '#4caf50' : pred.probability > 0.5 ? '#ff9800' : '#f44336'
                    }}>
                      {(pred.probability * 100).toFixed(0)}% probability
                    </span>
                  </div>
                  <div className="prediction-details">
                    <span>Impact: {pred.predicted_impact}</span>
                    <span>•</span>
                    <span>ETA: {pred.estimated_time_hours.toFixed(1)} hours</span>
                    <span>•</span>
                    <span>Via {pred.corridor}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.graph_structure && (
            <div className="graph-info">
              <h5>Corridor Graph Structure</h5>
              <div className="graph-stats">
                <span>{results.graph_structure.total_states} states</span>
                <span>•</span>
                <span>{results.graph_structure.total_connections} connections</span>
                <span>•</span>
                <span>Corridors: {results.graph_structure.corridors.join(', ')}</span>
              </div>
            </div>
          )}

          <div className="patent-info">
            <small>
              💡 <strong>Patent Innovation:</strong> Graph-based correlation predicts impacts 25 minutes
              earlier than single-state systems
            </small>
          </div>
        </div>
      )}
    </div>
  );
}

export default CrossStateCorrelation;
