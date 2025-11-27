/**
 * ML Features Panel - Main dashboard for all ML/AI capabilities
 * OPTIMIZED: Added React.memo and lazy loading to prevent unnecessary re-renders
 */
import { useState, useEffect, useMemo, memo, lazy, Suspense } from 'react';
import axios from 'axios';
import { config } from '../config';
import './styles/MLFeaturesPanel.css';

// OPTIMIZED: Lazy load tab components - only load when needed
const DataQualityMLAssessment = lazy(() => import('./DataQualityMLAssessment'));
const CrossStateCorrelation = lazy(() => import('./CrossStateCorrelation'));
const ProvenanceViewer = lazy(() => import('./ProvenanceViewer'));
const AnomalyDetectionPanel = lazy(() => import('./AnomalyDetectionPanel'));
const RouteOptimizer = lazy(() => import('./RouteOptimizer'));
const IncidentPredictor = lazy(() => import('./IncidentPredictor'));
const CompressionStats = lazy(() => import('./CompressionStats'));
const MLTutorial = lazy(() => import('./MLTutorial'));

function MLFeaturesPanel({ events, authToken, onClose }) {
  const [activeTab, setActiveTab] = useState('quality');
  const [mlHealth, setMLHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    checkMLHealth();
    // OPTIMIZED: Reduced polling from 60s to 5 minutes to reduce load
    const interval = setInterval(checkMLHealth, 300000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, []);

  // OPTIMIZED: Removed auto-show tutorial to improve initial render performance
  // Users can click the Tutorial button if needed

  const checkMLHealth = async () => {
    try {
      const response = await axios.get(`${config.API_URL}/api/ml/health`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      setMLHealth(response.data);
      setLoading(false);
    } catch (error) {
      console.error('ML health check failed:', error);
      setMLHealth({ success: false, error: error.message });
      setLoading(false);
    }
  };

  // OPTIMIZED: Memoize tabs array to prevent re-creating on every render
  const tabs = useMemo(() => [
    { id: 'quality', label: 'Data Quality', icon: '✓', feature: 1 },
    { id: 'correlation', label: 'Correlations', icon: '🔗', feature: 2 },
    { id: 'provenance', label: 'Provenance', icon: '🔒', feature: 4 },
    { id: 'anomaly', label: 'Anomalies', icon: '⚠️', feature: 5 },
    { id: 'route', label: 'Route Optimizer', icon: '🚛', feature: 6 },
    { id: 'prediction', label: 'Predictions', icon: '🔮', feature: 10 },
    { id: 'compression', label: 'Compression', icon: '📦', feature: 9 }
  ], []);

  return (
    <div className="ml-features-panel">
      <div className="ml-panel-header">
        <h2>🤖 ML & Advanced Features</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="tutorial-launch-btn"
            onClick={() => setShowTutorial(true)}
            title="Interactive Tutorial"
          >
            🎓 Tutorial
          </button>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* ML Service Status */}
      <div className={`ml-health-status ${mlHealth?.ml_service?.healthy ? 'healthy' : 'offline'}`}>
        <div className="status-indicator">
          <span className={`status-dot ${mlHealth?.ml_service?.healthy ? 'green' : 'red'}`}></span>
          <span>
            ML Service: {loading ? 'Checking...' : (mlHealth?.ml_service?.healthy ? 'Online' : 'Offline (Fallback Active)')}
          </span>
        </div>

        {mlHealth?.ml_service?.healthy && (
          <div className="models-status">
            <small>
              Models: {Object.entries(mlHealth.ml_service.models || {})
                .filter(([_, loaded]) => loaded)
                .map(([name]) => name)
                .join(', ') || 'None loaded'}
            </small>
          </div>
        )}

        {mlHealth?.provenance_chain && (
          <div className="provenance-status">
            <small>
              Provenance: {mlHealth.provenance_chain.total_records} records
              {mlHealth.provenance_chain.valid ? ' ✓ Valid' : ' ⚠️ Issues detected'}
            </small>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="ml-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`ml-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            <span className="tab-feature">#{tab.feature}</span>
          </button>
        ))}
      </div>

      {/* Tab Content - OPTIMIZED: Wrapped in Suspense for lazy loading */}
      <div className="ml-tab-content">
        <Suspense fallback={<div className="loading-tab">Loading...</div>}>
          {activeTab === 'quality' && (
            <DataQualityMLAssessment
              events={events}
              authToken={authToken}
              mlHealthy={mlHealth?.ml_service?.healthy}
            />
          )}

          {activeTab === 'correlation' && (
            <CrossStateCorrelation
              events={events}
              authToken={authToken}
              mlHealthy={mlHealth?.ml_service?.healthy}
            />
          )}

          {activeTab === 'provenance' && (
            <ProvenanceViewer
              events={events}
              authToken={authToken}
            />
          )}

          {activeTab === 'anomaly' && (
            <AnomalyDetectionPanel
              events={events}
              authToken={authToken}
              mlHealthy={mlHealth?.ml_service?.healthy}
            />
          )}

          {activeTab === 'route' && (
            <RouteOptimizer
              events={events}
              authToken={authToken}
              mlHealthy={mlHealth?.ml_service?.healthy}
            />
          )}

          {activeTab === 'prediction' && (
            <IncidentPredictor
              events={events}
              authToken={authToken}
              mlHealthy={mlHealth?.ml_service?.healthy}
            />
          )}

          {activeTab === 'compression' && (
            <CompressionStats
              events={events}
              authToken={authToken}
            />
          )}
        </Suspense>
      </div>

      {/* Info Footer */}
      <div className="ml-panel-footer">
        <small>
          Patent-worthy features #1-10 |
          {mlHealth?.ml_service?.healthy ?
            ' ML models active' :
            ' Rule-based fallback active'
          }
        </small>
      </div>

      {/* Interactive Tutorial - OPTIMIZED: Only render when open */}
      {showTutorial && (
        <Suspense fallback={null}>
          <MLTutorial
            isOpen={showTutorial}
            onClose={() => setShowTutorial(false)}
            onTabChange={setActiveTab}
          />
        </Suspense>
      )}
    </div>
  );
}

// OPTIMIZED: Memoize component to prevent re-renders when parent updates
export default memo(MLFeaturesPanel);
