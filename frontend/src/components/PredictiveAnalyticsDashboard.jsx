import { useState, useEffect } from 'react';
import api from '../services/api';

const PredictiveAnalyticsDashboard = () => {
  const [activeTab, setActiveTab] = useState('congestion'); // 'congestion', 'incident', 'safety', 'routing'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [congestionData, setCongestionData] = useState(null);
  const [incidentData, setIncidentData] = useState(null);
  const [safetyData, setSafetyData] = useState(null);
  const [routingData, setRoutingData] = useState(null);

  useEffect(() => {
    fetchAllPredictions();
  }, []);

  const fetchAllPredictions = async () => {
    try {
      setLoading(true);
      const [congestion, incident, safety, routing] = await Promise.all([
        api.get('/predictive/congestion-forecast'),
        api.get('/predictive/incident-impact'),
        api.get('/predictive/safety-risk'),
        api.get('/predictive/dynamic-routing?originLat=41.6&originLon=-93.6&destLat=41.8&destLon=-80.2')
      ]);

      setCongestionData(congestion.data);
      setIncidentData(incident.data);
      setSafetyData(safety.data);
      setRoutingData(routing.data);
    } catch (err) {
      console.error('Error fetching predictions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCongestionColor = (level) => {
    const colors = {
      'FREE_FLOW': '#10b981',
      'MODERATE': '#f59e0b',
      'HEAVY': '#ef4444',
      'SEVERE': '#dc2626'
    };
    return colors[level] || '#6b7280';
  };

  const getRiskColor = (level) => {
    const colors = {
      'LOW': '#10b981',
      'MODERATE': '#f59e0b',
      'HIGH': '#ef4444',
      'CRITICAL': '#dc2626'
    };
    return colors[level] || '#6b7280';
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontSize: '16px', color: '#6b7280' }}>
        Loading predictive analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>
          AI-Powered Predictive Analytics
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          Phase 6: Predict incidents before they cascade - powered by machine learning
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '8px', borderBottom: '2px solid #e5e7eb', flexWrap: 'wrap' }}>
        {[
          { id: 'congestion', label: '📊 Congestion Forecast', icon: '🚦' },
          { id: 'incident', label: '⚠️ Incident Impact', icon: '🚨' },
          { id: 'safety', label: '🛡️ Safety Risk', icon: '⚡' },
          { id: 'routing', label: '🗺️ Dynamic Routing', icon: '🧭' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '600',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
              cursor: 'pointer',
              marginBottom: '-2px',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Congestion Forecast Tab */}
      {activeTab === 'congestion' && congestionData && (
        <div>
          <div style={{ marginBottom: '24px', padding: '20px', background: '#f9fafb', borderRadius: '8px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold' }}>
              4-Hour Traffic Forecast
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Forecasts</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
                  {congestionData?.forecasts?.length || 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Corridors Monitored</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
                  {new Set(congestionData?.forecasts?.map(f => f.corridor_id) || []).size}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Max Horizon</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
                  {Math.max(...(congestionData?.forecasts?.map(f => f.forecast_horizon_minutes) || [0]))} min
                </div>
              </div>
            </div>
          </div>

          {/* Forecast Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {(congestionData?.forecasts || []).slice(0, 12).map((forecast, idx) => (
              <div
                key={idx}
                style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px',
                  transition: 'box-shadow 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                      {forecast.corridor_id}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      +{forecast.forecast_horizon_minutes} min
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '4px 8px',
                      background: getCongestionColor(forecast.congestion_level),
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                  >
                    {forecast.congestion_level}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>Speed</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: getCongestionColor(forecast.congestion_level) }}>
                      {forecast.predicted_speed_mph} mph
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>Volume</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                      {forecast.predicted_volume_vph}
                    </div>
                  </div>
                </div>

                {forecast.recommended_departure_window && (
                  <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                    💡 {forecast.recommended_departure_window}
                  </div>
                )}

                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
                  Confidence: {forecast.confidence_score}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incident Impact Tab */}
      {activeTab === 'incident' && incidentData && (
        <div>
          <div style={{ marginBottom: '24px', padding: '20px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold', color: '#dc2626' }}>
              ⚠️ Active Incident Predictions
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '4px' }}>Total Predictions</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                  {incidentData?.predictions?.length || 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '4px' }}>Avg Economic Impact</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                  ${incidentData?.predictions?.length > 0
                    ? ((incidentData.predictions.reduce((sum, p) => sum + (p.economic_impact_usd || 0), 0) / incidentData.predictions.length) / 1000).toFixed(0)
                    : 0}K
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '4px' }}>Avg Clearance Time</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                  {incidentData?.predictions?.length > 0
                    ? Math.round(incidentData.predictions.reduce((sum, p) => sum + (p.predicted_clearance_minutes || 0), 0) / incidentData.predictions.length)
                    : 0} min
                </div>
              </div>
            </div>
          </div>

          {(incidentData?.predictions || []).map((prediction, idx) => (
            <div
              key={idx}
              style={{
                background: 'white',
                border: '2px solid #fecaca',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 'bold', color: '#dc2626' }}>
                    {prediction.event_type} on {prediction.corridor_id}
                  </h3>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    Event ID: {prediction.event_id}
                  </div>
                </div>
                <div
                  style={{
                    padding: '8px 16px',
                    background: prediction.confidence_level === 'HIGH' ? '#10b981' : '#f59e0b',
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold'
                  }}
                >
                  {prediction.confidence_level} CONFIDENCE
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Queue Length</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                    {prediction.predicted_queue_length_miles} mi
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Max Delay</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                    {prediction.predicted_max_delay_minutes} min
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Clearance Time</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                    {prediction.predicted_duration_minutes} min
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Economic Cost</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                    ${(prediction.estimated_economic_cost_usd / 1000).toFixed(0)}K
                  </div>
                </div>
              </div>

              {prediction.dms_message_recommendations && prediction.dms_message_recommendations.length > 0 && (
                <div style={{ marginTop: '16px', padding: '16px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#92400e', marginBottom: '8px' }}>
                    💡 Recommended DMS Messages:
                  </div>
                  {prediction.dms_message_recommendations.map((msg, i) => (
                    <div key={i} style={{ fontSize: '13px', color: '#92400e', marginLeft: '16px', marginBottom: '4px' }}>
                      • {msg}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Safety Risk Tab */}
      {activeTab === 'safety' && safetyData && (
        <div>
          <div style={{ marginBottom: '24px', padding: '20px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold', color: '#92400e' }}>
              🛡️ Work Zone Safety Analysis
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#78350f', marginBottom: '4px' }}>Total Assessed</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#92400e' }}>
                  {safetyData.summary.total_work_zones_assessed}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#78350f', marginBottom: '4px' }}>High Risk</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                  {safetyData.summary.high_risk_count}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#78350f', marginBottom: '4px' }}>Critical</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7f1d1d' }}>
                  {safetyData.summary.critical_risk_count}
                </div>
              </div>
            </div>
          </div>

          {safetyData.safety_scores.map((score, idx) => (
            <div
              key={idx}
              style={{
                background: 'white',
                border: `3px solid ${getRiskColor(score.risk_level)}`,
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                    {score.corridor_id}: {score.description}
                  </h3>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                    Event ID: {score.event_id}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Risk Score</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: getRiskColor(score.risk_level) }}>
                      {score.risk_score}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '8px 16px',
                      background: getRiskColor(score.risk_level),
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}
                  >
                    {score.risk_level}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Crash Rate</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ef4444' }}>
                    {score.historical_crash_rate}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Percentile</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ef4444' }}>
                    {score.crash_rate_percentile}th
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Crash Probability</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ef4444' }}>
                    {(score.predicted_crash_probability * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Estimated ROI</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>
                    {score.estimated_roi_ratio}x
                  </div>
                </div>
              </div>

              {score.recommended_countermeasures && score.recommended_countermeasures.length > 0 && (
                <div style={{ marginTop: '16px', padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#166534', marginBottom: '12px' }}>
                    ✅ Recommended Safety Countermeasures:
                  </div>
                  {score.recommended_countermeasures.map((measure, i) => (
                    <div key={i} style={{ fontSize: '13px', color: '#166534', marginLeft: '16px', marginBottom: '6px', display: 'flex', alignItems: 'flex-start' }}>
                      <span style={{ marginRight: '8px' }}>•</span>
                      <span style={{ flex: 1 }}>{measure}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: '12px', fontSize: '12px', color: '#166534', fontWeight: 'bold' }}>
                    Estimated crash reduction: {score.estimated_crash_reduction_pct}%
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dynamic Routing Tab */}
      {activeTab === 'routing' && routingData && (
        <div>
          <div style={{ marginBottom: '24px', padding: '20px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold', color: '#1e40af' }}>
              🗺️ Optimal Route Recommendations
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#1e3a8a', marginBottom: '4px' }}>Origin</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e40af' }}>
                  {routingData.routing.origin.lat.toFixed(2)}, {routingData.routing.origin.lon.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#1e3a8a', marginBottom: '4px' }}>Destination</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e40af' }}>
                  {routingData.routing.destination.lat.toFixed(2)}, {routingData.routing.destination.lon.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {routingData.routing.routes.map((route, idx) => (
            <div
              key={idx}
              style={{
                background: route.recommended ? '#f0fdf4' : 'white',
                border: route.recommended ? '3px solid #10b981' : '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '16px',
                position: 'relative'
              }}
            >
              {route.recommended && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '24px',
                    padding: '6px 16px',
                    background: '#10b981',
                    color: 'white',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  ⭐ RECOMMENDED
                </div>
              )}

              <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
                Route {route.route_id}: {route.name}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Distance</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                    {route.distance_miles} mi
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Estimated Time</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                    {route.estimated_time_display}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Reliability</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                    {route.reliability_score}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Traffic</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>
                    {route.traffic_level}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#6b7280', marginBottom: '8px' }}>
                  Highlights:
                </div>
                {route.highlights.map((highlight, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#374151', marginLeft: '16px', marginBottom: '4px' }}>
                    • {highlight}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
                <div>⚠️ Incidents: {route.incidents_enroute}</div>
                <div>🚧 Work Zones: {route.work_zones_enroute}</div>
              </div>
            </div>
          ))}

          {/* DMS Updates */}
          {routingData.routing.dms_updates && routingData.routing.dms_updates.length > 0 && (
            <div style={{ marginTop: '24px', padding: '20px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: '#92400e' }}>
                🚨 Recommended DMS Updates
              </h3>
              {routingData.routing.dms_updates.map((dms, idx) => (
                <div key={idx} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: idx < routingData.routing.dms_updates.length - 1 ? '1px solid #fde68a' : 'none' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#78350f', marginBottom: '4px' }}>
                    {dms.location}
                  </div>
                  <div style={{ fontSize: '14px', color: '#92400e', fontFamily: 'monospace', background: '#fffbeb', padding: '8px', borderRadius: '4px' }}>
                    {dms.recommended_message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer Note */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        background: '#f9fafb',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '13px',
        color: '#6b7280'
      }}>
        <p style={{ margin: 0 }}>
          <strong>Phase 6 MVP:</strong> Predictive analytics infrastructure deployed. ML models ready for training on historical data.
        </p>
        <p style={{ margin: '8px 0 0 0' }}>
          Future releases will incorporate TensorFlow models trained on 5+ years of incident, traffic, and weather data.
        </p>
      </div>
    </div>
  );
};

export default PredictiveAnalyticsDashboard;
