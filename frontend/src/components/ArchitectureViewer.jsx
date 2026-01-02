/**
 * Regional ITS Architecture Viewer
 *
 * Displays ARC-IT service package analysis and architecture diagrams
 * Replaces traditional RAD-IT desktop application functionality
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';
import './ArchitectureViewer.css';

function ArchitectureViewer() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedState, setSelectedState] = useState('ia');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [view, setView] = useState('overview'); // overview, packages, diagram, standards, v2x-gaps
  const [v2xGaps, setV2xGaps] = useState(null);
  const [v2xLoading, setV2xLoading] = useState(false);

  useEffect(() => {
    fetchAnalysis();
    fetchV2XGaps();
  }, [selectedState]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${config.apiUrl}/api/architecture/analyze?stateKey=${selectedState}`);
      setAnalysis(response.data);
    } catch (err) {
      console.error('Error fetching architecture analysis:', err);
      setError('Failed to load architecture analysis');
    } finally {
      setLoading(false);
    }
  };

  const fetchV2XGaps = async () => {
    setV2xLoading(true);

    try {
      const response = await axios.get(`${config.apiUrl}/api/architecture/v2x-gaps?stateKey=${selectedState}`);
      setV2xGaps(response.data);
    } catch (err) {
      console.error('Error fetching V2X gap analysis:', err);
    } finally {
      setV2xLoading(false);
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Traffic Management': return '🚦';
      case 'Weather': return '🌡️';
      case 'Connected Vehicle': return '📡';
      case 'Maintenance': return '🚧';
      case 'Archived Data': return '💾';
      default: return '📋';
    }
  };

  const getComplianceColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div className="architecture-viewer loading">
        <div className="loading-spinner"></div>
        <p>Analyzing regional ITS architecture...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="architecture-viewer">
        <div className="error-message">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="architecture-viewer">
      {/* Header */}
      <div className="arch-header">
        <div className="header-content">
          <h2>🏗️ Regional ITS Architecture</h2>
          <p className="subtitle">ARC-IT 10.0 Service Package Analysis • Live RAD-IT Replacement</p>
        </div>

        {/* State Selector */}
        <div className="state-selector">
          <label>Select State:</label>
          <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
            <option value="ia">Iowa (IA)</option>
            <option value="co">Colorado (CO)</option>
            <option value="all">All States</option>
          </select>
        </div>
      </div>

      {/* View Tabs */}
      <div className="view-tabs">
        <button
          className={view === 'overview' ? 'active' : ''}
          onClick={() => setView('overview')}
        >
          📊 Overview
        </button>
        <button
          className={view === 'packages' ? 'active' : ''}
          onClick={() => setView('packages')}
        >
          📦 Service Packages
        </button>
        <button
          className={view === 'diagram' ? 'active' : ''}
          onClick={() => setView('diagram')}
        >
          🗺️ Architecture Diagram
        </button>
        <button
          className={view === 'standards' ? 'active' : ''}
          onClick={() => setView('standards')}
        >
          📋 Standards & Compliance
        </button>
        <button
          className={view === 'v2x-gaps' ? 'active' : ''}
          onClick={() => setView('v2x-gaps')}
        >
          📡 V2X Gap Analysis
        </button>
      </div>

      {/* Overview Tab */}
      {view === 'overview' && analysis && (
        <div className="overview-view">
          {/* Summary Stats */}
          <div className="arch-stats">
            <div className="stat-card">
              <div className="stat-value">{analysis.total_equipment}</div>
              <div className="stat-label">ITS Equipment</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{analysis.service_package_count}</div>
              <div className="stat-label">Service Packages</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{analysis.physical_objects?.length || 0}</div>
              <div className="stat-label">Physical Objects</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{analysis.standards_required?.length || 0}</div>
              <div className="stat-label">Standards Required</div>
            </div>
            <div className="stat-card">
              <div
                className="stat-value"
                style={{ color: getComplianceColor(analysis.compliance_score) }}
              >
                {analysis.compliance_score}%
              </div>
              <div className="stat-label">Compliance Score</div>
            </div>
          </div>

          {/* Quick Summary */}
          <div className="summary-section">
            <h3>Regional Architecture Summary</h3>
            <div className="summary-content">
              <p>
                <strong>{analysis.state === 'all' ? 'All States' : analysis.state.toUpperCase()}</strong> regional ITS architecture includes <strong>{analysis.total_equipment} equipment assets</strong> supporting <strong>{analysis.service_package_count} ARC-IT service packages</strong>.
              </p>
              <p>
                The architecture involves <strong>{analysis.physical_objects?.length} physical objects</strong> and requires compliance with <strong>{analysis.standards_required?.length} industry standards</strong>.
              </p>
              <p>
                Current compliance score: <strong style={{ color: getComplianceColor(analysis.compliance_score) }}>{analysis.compliance_score}%</strong>
              </p>
            </div>
          </div>

          {/* Service Package Preview */}
          <div className="package-preview">
            <h3>Active Service Packages</h3>
            <div className="package-grid">
              {analysis.service_packages?.slice(0, 6).map((pkg) => (
                <div key={pkg.id} className="package-preview-card" onClick={() => {
                  setSelectedPackage(pkg);
                  setView('packages');
                }}>
                  <div className="package-header">
                    <span className="package-icon">{getCategoryIcon(pkg.category)}</span>
                    <div>
                      <div className="package-id">{pkg.id}</div>
                      <div className="package-name">{pkg.name}</div>
                    </div>
                  </div>
                  <div className="package-count">{pkg.equipment_count} equipment</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Service Packages Tab */}
      {view === 'packages' && analysis && (
        <div className="packages-view">
          <h3>ARC-IT Service Packages ({analysis.service_package_count})</h3>

          <div className="packages-list">
            {analysis.service_packages?.map((pkg) => (
              <div
                key={pkg.id}
                className={`package-card ${selectedPackage?.id === pkg.id ? 'selected' : ''}`}
                onClick={() => setSelectedPackage(selectedPackage?.id === pkg.id ? null : pkg)}
              >
                <div className="package-card-header">
                  <div className="package-title">
                    <span className="package-icon-lg">{getCategoryIcon(pkg.category)}</span>
                    <div>
                      <h4>{pkg.id}: {pkg.name}</h4>
                      <span className="package-category">{pkg.category}</span>
                    </div>
                  </div>
                  <div className="package-stats">
                    <div className="equipment-count">{pkg.equipment_count} assets</div>
                  </div>
                </div>

                <p className="package-description">{pkg.description}</p>

                {selectedPackage?.id === pkg.id && (
                  <div className="package-details">
                    {/* Functional Requirements */}
                    <div className="detail-section">
                      <h5>Functional Requirements</h5>
                      <ul>
                        {pkg.functional_requirements?.map((req, idx) => (
                          <li key={idx}>{req}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Physical Objects */}
                    <div className="detail-section">
                      <h5>Physical Objects</h5>
                      <div className="object-tags">
                        {pkg.physical_objects?.map((obj, idx) => (
                          <span key={idx} className="object-tag">{obj}</span>
                        ))}
                      </div>
                    </div>

                    {/* Standards */}
                    <div className="detail-section">
                      <h5>Required Standards</h5>
                      <div className="standard-tags">
                        {pkg.standards?.map((std, idx) => (
                          <span key={idx} className="standard-tag">{std}</span>
                        ))}
                      </div>
                    </div>

                    {/* Equipment Examples */}
                    <div className="detail-section">
                      <h5>Equipment Examples</h5>
                      <div className="equipment-examples">
                        {pkg.equipment_examples?.map((eq, idx) => (
                          <div key={idx} className="equipment-example">
                            <strong>{eq.id}</strong> • {eq.type} • {eq.location}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Information Flows */}
                    <div className="detail-section">
                      <h5>Information Flows</h5>
                      <div className="info-flows">
                        {pkg.information_flows?.map((flow, idx) => (
                          <div key={idx} className="info-flow">
                            <span className="flow-from">{flow.from}</span>
                            <span className="flow-arrow">→</span>
                            <span className="flow-to">{flow.to}</span>
                            <span className="flow-data">({flow.data})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Architecture Diagram Tab */}
      {view === 'diagram' && analysis && (
        <div className="diagram-view">
          <h3>Regional ITS Architecture Diagram</h3>

          <div className="diagram-placeholder">
            <div className="placeholder-content">
              <div className="placeholder-icon">🗺️</div>
              <h4>Interactive Architecture Diagram</h4>
              <p>Coming Soon: SVG-based interactive architecture diagrams showing:</p>
              <ul>
                <li>Physical object interconnections</li>
                <li>Information flow visualization</li>
                <li>Equipment deployment map</li>
                <li>Service package relationships</li>
              </ul>
              <p className="placeholder-note">
                This will provide full RAD-IT diagram functionality in a web-based format,
                exportable to PDF, PNG, and HTML.
              </p>
            </div>
          </div>

          {/* Physical Objects List */}
          <div className="objects-section">
            <h4>Physical Objects in Regional Architecture</h4>
            <div className="object-grid">
              {analysis.physical_objects?.map((obj, idx) => (
                <div key={idx} className="object-card">
                  <div className="object-name">{obj}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Standards & Compliance Tab */}
      {view === 'standards' && analysis && (
        <div className="standards-view">
          <h3>Standards & Compliance</h3>

          {/* Compliance Score */}
          <div className="compliance-card">
            <div className="compliance-header">
              <h4>Regional Architecture Compliance</h4>
              <div
                className="compliance-score-lg"
                style={{
                  background: `conic-gradient(${getComplianceColor(analysis.compliance_score)} ${analysis.compliance_score * 3.6}deg, #e5e7eb 0deg)`
                }}
              >
                <div className="score-inner">
                  <div className="score-value">{analysis.compliance_score}%</div>
                </div>
              </div>
            </div>
            <p className="compliance-description">
              Compliance score is calculated based on equipment metadata completeness,
              location accuracy, status information, and standards conformance.
            </p>
          </div>

          {/* Required Standards */}
          <div className="standards-section">
            <h4>Required Industry Standards ({analysis.standards_required?.length})</h4>
            <div className="standards-grid">
              {analysis.standards_required?.map((std, idx) => (
                <div key={idx} className="standard-card">
                  <div className="standard-name">{std}</div>
                  <div className="standard-type">
                    {std.startsWith('NTCIP') ? 'NTCIP Protocol' :
                     std.startsWith('SAE') ? 'SAE Standard' :
                     std.startsWith('IEEE') ? 'IEEE Standard' :
                     std === 'TMDD' ? 'Traffic Management' :
                     std === 'WZDx' ? 'Work Zone Data Exchange' :
                     'Industry Standard'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Export Options */}
          <div className="export-section">
            <h4>Export Architecture Documentation</h4>
            <p>Generate FHWA-compliant documentation for grant applications</p>
            <div className="export-buttons">
              <button
                className="export-btn"
                onClick={() => {
                  const url = `${config.apiUrl}/api/architecture/export/pdf?stateKey=${selectedState}`;
                  window.open(url, '_blank');
                }}
              >
                📄 Regional Architecture Report (PDF)
              </button>
              <button className="export-btn" disabled>
                📊 Service Package Matrix (Excel)
              </button>
              <button className="export-btn" disabled>
                🗺️ Architecture Diagram (PNG)
              </button>
              <button className="export-btn" disabled>
                📋 Standards Compliance Report
              </button>
            </div>
            <p className="export-note">Additional export formats coming soon</p>
          </div>
        </div>
      )}

      {/* V2X Gap Analysis Tab */}
      {view === 'v2x-gaps' && (
        <div className="v2x-gaps-view">
          {v2xLoading ? (
            <div className="loading-spinner">
              <p>Analyzing V2X coverage gaps...</p>
            </div>
          ) : v2xGaps ? (
            <>
              <h3>V2X Deployment Gap Analysis</h3>

              {/* Summary Stats */}
              <div className="arch-stats">
                <div className="stat-card">
                  <div className="stat-value">{v2xGaps.summary?.total_rsus || 0}</div>
                  <div className="stat-label">Active RSUs</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{v2xGaps.summary?.routes_analyzed || 0}</div>
                  <div className="stat-label">Routes Analyzed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{v2xGaps.summary?.coverage_percent || 0}%</div>
                  <div className="stat-label">Coverage</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{v2xGaps.summary?.gaps_identified || 0}</div>
                  <div className="stat-label">Gaps Identified</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{v2xGaps.summary?.recommended_deployments || 0}</div>
                  <div className="stat-label">Recommended RSUs</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">
                    ${((v2xGaps.summary?.deployment_cost || 0) / 1000000).toFixed(1)}M
                  </div>
                  <div className="stat-label">Est. Deployment Cost</div>
                </div>
              </div>

              {/* Route Analysis */}
              {v2xGaps.route_analysis && v2xGaps.route_analysis.length > 0 && (
                <div className="route-analysis-section">
                  <h4>Route Coverage Analysis</h4>
                  <div className="route-cards">
                    {v2xGaps.route_analysis.map((route, idx) => (
                      <div key={idx} className="route-card">
                        <div className="route-header">
                          <h5>{route.route}</h5>
                          <span className={`status-badge status-${route.status}`}>
                            {route.status}
                          </span>
                        </div>
                        <div className="route-stats">
                          <div className="route-stat">
                            <span className="label">RSU Count:</span>
                            <span className="value">{route.rsuCount}</span>
                          </div>
                          <div className="route-stat">
                            <span className="label">Route Length:</span>
                            <span className="value">{(route.routeLength / 1000).toFixed(1)} km</span>
                          </div>
                          <div className="route-stat">
                            <span className="label">Coverage:</span>
                            <span className="value">{route.coveragePercent}%</span>
                          </div>
                          <div className="route-stat">
                            <span className="label">Gaps:</span>
                            <span className="value">{route.gaps}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coverage Gaps */}
              {v2xGaps.gaps && v2xGaps.gaps.length > 0 ? (
                <div className="gaps-section">
                  <h4>Coverage Gaps ({v2xGaps.gaps.length})</h4>
                  <div className="gaps-list">
                    {v2xGaps.gaps.map((gap, idx) => (
                      <div key={idx} className={`gap-card priority-${gap.priority}`}>
                        <div className="gap-header">
                          <div>
                            <h5>{gap.route}</h5>
                            <span className="gap-id">{gap.gapId}</span>
                          </div>
                          <span className={`priority-badge priority-${gap.priority}`}>
                            {gap.priority} priority
                          </span>
                        </div>
                        <div className="gap-details">
                          <div className="gap-detail">
                            <strong>Gap Distance:</strong> {(gap.gapDistance / 1000).toFixed(1)} km
                          </div>
                          <div className="gap-detail">
                            <strong>Total Distance:</strong> {(gap.totalDistance / 1000).toFixed(1)} km
                          </div>
                          <div className="gap-detail">
                            <strong>Milepost Range:</strong> MP {gap.startMilepost || 'N/A'} - {gap.endMilepost || 'N/A'}
                          </div>
                          <div className="gap-detail">
                            <strong>Recommended RSUs:</strong> {gap.recommendedRSUs}
                          </div>
                          <div className="gap-detail">
                            <strong>Midpoint:</strong> {gap.midpoint.latitude.toFixed(6)}, {gap.midpoint.longitude.toFixed(6)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="no-gaps-message">
                  <div className="placeholder-content">
                    <div className="placeholder-icon">✅</div>
                    <h4>No Coverage Gaps Detected</h4>
                    <p>The current V2X infrastructure provides continuous coverage along analyzed routes.</p>
                  </div>
                </div>
              )}

              {/* Deployment Recommendations */}
              {v2xGaps.deployment_recommendations && v2xGaps.deployment_recommendations.length > 0 && (
                <div className="recommendations-section">
                  <h4>Deployment Recommendations</h4>
                  <div className="recommendations-list">
                    {v2xGaps.deployment_recommendations.map((rec, idx) => (
                      <div key={idx} className="recommendation-card">
                        <div className="rec-header">
                          <span className="priority-num">Priority {rec.priority}</span>
                          <h5>{rec.title}</h5>
                        </div>
                        <p className="rec-description">{rec.description}</p>
                        {rec.estimated_cost && (
                          <div className="rec-cost">
                            Estimated Cost: ${(rec.estimated_cost / 1000000).toFixed(2)}M
                          </div>
                        )}
                        {rec.total_budget && (
                          <div className="rec-budget">
                            <div>Total Budget: ${(rec.total_budget / 1000000).toFixed(2)}M</div>
                            <div>Annual Operations: ${(rec.annual_operations / 1000).toFixed(0)}K/year</div>
                          </div>
                        )}
                        {rec.phases && (
                          <div className="rec-phases">
                            <strong>Phased Approach:</strong>
                            {rec.phases.map((phase, pIdx) => (
                              <div key={pIdx} className="phase-item">
                                Phase {phase.phase}: {phase.focus} ({phase.duration})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost Estimate */}
              {v2xGaps.cost_estimate && (
                <div className="cost-section">
                  <h4>Deployment Cost Estimate</h4>
                  <div className="cost-breakdown">
                    <div className="cost-item">
                      <span className="cost-label">Hardware ({v2xGaps.cost_estimate.rsu_count} RSUs):</span>
                      <span className="cost-value">${(v2xGaps.cost_estimate.hardware / 1000000).toFixed(2)}M</span>
                    </div>
                    <div className="cost-item">
                      <span className="cost-label">Installation & Configuration:</span>
                      <span className="cost-value">${(v2xGaps.cost_estimate.installation / 1000000).toFixed(2)}M</span>
                    </div>
                    <div className="cost-item total">
                      <span className="cost-label">Total CapEx:</span>
                      <span className="cost-value">${(v2xGaps.cost_estimate.total_capex / 1000000).toFixed(2)}M</span>
                    </div>
                    <div className="cost-item">
                      <span className="cost-label">Annual OpEx:</span>
                      <span className="cost-value">${(v2xGaps.cost_estimate.annual_opex / 1000).toFixed(0)}K/year</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Configuration */}
              {v2xGaps.coverage_config && (
                <div className="config-section">
                  <h4>Analysis Configuration</h4>
                  <div className="config-items">
                    <div className="config-item">
                      <strong>RSU Range:</strong> {v2xGaps.coverage_config.rsu_range_meters}m (DSRC/C-V2X)
                    </div>
                    <div className="config-item">
                      <strong>Target Coverage:</strong> {v2xGaps.coverage_config.target_coverage_percent}%
                    </div>
                    <div className="config-item">
                      <strong>Corridor Width:</strong> {v2xGaps.coverage_config.corridor_width_meters}m
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="error-message">
              Failed to load V2X gap analysis
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ArchitectureViewer;
