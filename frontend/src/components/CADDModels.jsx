import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';
import CADDViewer from './CADDViewer';

const API_BASE = config.apiUrl;

export default function CADDModels() {
  const [activeTab, setActiveTab] = useState('upload');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [availableStates, setAvailableStates] = useState([]);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState(null);
  const [stateKey, setStateKey] = useState('');
  const [uploadedBy, setUploadedBy] = useState('');
  const [route, setRoute] = useState('');

  useEffect(() => {
    loadModels();
    loadStates();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/cadd/models`);
      setModels(response.data.models || []);
    } catch (error) {
      console.error('Error loading CADD models:', error);
      // Don't alert on first load if tables don't exist yet
    } finally {
      setLoading(false);
    }
  };

  const loadStates = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/states/list`);
      setAvailableStates(response.data.states || []);
    } catch (error) {
      console.error('Error loading states:', error);
      setAvailableStates([
        { stateKey: 'ia', stateName: 'Iowa' },
        { stateKey: 'il', stateName: 'Illinois' },
        { stateKey: 'in', stateName: 'Indiana' },
        { stateKey: 'mi', stateName: 'Michigan' },
        { stateKey: 'mn', stateName: 'Minnesota' },
        { stateKey: 'oh', stateName: 'Ohio' },
        { stateKey: 'pa', stateName: 'Pennsylvania' },
        { stateKey: 'wi', stateName: 'Wisconsin' }
      ]);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    const ext = file?.name.toLowerCase().split('.').pop();
    if (file && ['dxf', 'dwg', 'dgn'].includes(ext)) {
      setSelectedFile(file);
    } else {
      alert('Please select a valid CAD file (.dxf, .dwg, or .dgn extension)');
      e.target.value = '';
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      alert('Please select a CAD file');
      return;
    }

    const formData = new FormData();
    formData.append('ifcFile', selectedFile);  // Keep same parameter name as IFC endpoint
    if (stateKey) formData.append('stateKey', stateKey);
    if (uploadedBy) formData.append('uploadedBy', uploadedBy);
    if (route) formData.append('route', route);

    try {
      setUploading(true);
      setUploadProgress('Uploading and parsing CAD file...');

      const response = await axios.post(
        `${API_BASE}/api/digital-infrastructure/upload`,  // Uses same endpoint as IFC
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000 // 5 minutes for CAD files
        }
      );

      setUploadProgress(`Success! Extracted ${response.data.entities} entities, ${response.data.its_equipment} ITS equipment items`);

      // Reset form
      setSelectedFile(null);
      setStateKey('');
      setUploadedBy('');
      setRoute('');
      document.getElementById('caddFileInput').value = '';

      // Reload models
      await loadModels();

      // Switch to models tab
      setTimeout(() => {
        setActiveTab('models');
        setUploadProgress(null);
      }, 3000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress(null);
      alert(error.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const loadModelDetails = async (modelId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/cadd/models/${modelId}`);
      setSelectedModel(response.data.model);
    } catch (error) {
      console.error('Error loading model details:', error);
      alert('Failed to load model details');
    } finally {
      setLoading(false);
    }
  };

  const deleteModel = async (modelId) => {
    if (!confirm('Are you sure you want to delete this CAD model?')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE}/api/cadd/models/${modelId}`);
      alert('Model deleted successfully');
      await loadModels();
    } catch (error) {
      console.error('Error deleting model:', error);
      alert('Failed to delete model');
    }
  };

  const exportToGeoJSON = async (modelId, filename) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/cadd/models/${modelId}/export/geojson`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cadd_${modelId}_${filename.replace(/\.[^.]+$/, '')}.geojson`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      alert('GeoJSON exported successfully! Import into ArcGIS or QGIS for georeferencing.');
    } catch (error) {
      console.error('Error exporting to GeoJSON:', error);
      alert('Failed to export to GeoJSON');
    }
  };

  const exportToCSV = async (modelId, filename) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/cadd/models/${modelId}/export/csv`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cadd_${modelId}_${filename.replace(/\.[^.]+$/, '')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      alert('CSV exported successfully! Import into ArcGIS using "Display XY Data" for georeferencing.');
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      alert('Failed to export to CSV');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '10px' }}>📐 CADD Models</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Upload and analyze CAD design files (DXF, DWG, DGN) to extract operational elements for ITS operations
        </p>

        <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #e5e7eb' }}>
          <button
            onClick={() => setActiveTab('upload')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'upload' ? '#1976d2' : 'transparent',
              color: activeTab === 'upload' ? '#111827' : '#666',
              border: 'none',
              borderBottom: activeTab === 'upload' ? '3px solid #1976d2' : 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px'
            }}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab('models')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'models' ? '#1976d2' : 'transparent',
              color: activeTab === 'models' ? '#111827' : '#666',
              border: 'none',
              borderBottom: activeTab === 'models' ? '3px solid #1976d2' : 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px'
            }}
          >
            Models ({models.length})
          </button>
        </div>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>Upload CAD File</h2>

          <form onSubmit={handleUpload}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Select CAD File *
              </label>
              <input
                id="caddFileInput"
                type="file"
                accept=".dxf,.dwg,.dgn"
                onChange={handleFileSelect}
                disabled={uploading}
                style={{
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  width: '100%'
                }}
              />
              <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                Supported formats: DXF (.dxf), DWG (.dwg), DGN (.dgn)
              </div>
              {selectedFile && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  State (optional)
                </label>
                <select
                  value={stateKey}
                  onChange={(e) => setStateKey(e.target.value)}
                  disabled={uploading}
                  style={{
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    width: '100%'
                  }}
                >
                  <option value="">Select State...</option>
                  {availableStates.map(state => (
                    <option key={state.stateKey} value={state.stateKey}>
                      {state.stateName} ({state.stateKey.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Uploaded By
                </label>
                <input
                  type="text"
                  value={uploadedBy}
                  onChange={(e) => setUploadedBy(e.target.value)}
                  placeholder="Your name or email"
                  disabled={uploading}
                  style={{
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    width: '100%'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Route/Corridor (optional)
              </label>
              <input
                type="text"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="I-80, US-30, etc."
                disabled={uploading}
                style={{
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  width: '100%'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={!selectedFile || uploading}
              style={{
                padding: '12px 30px',
                backgroundColor: !selectedFile || uploading ? '#ccc' : '#1976d2',
                color: '#111827',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer'
              }}
            >
              {uploading ? 'Processing...' : 'Upload and Parse'}
            </button>

            {uploadProgress && (
              <div style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: '#e3f2fd',
                borderLeft: '4px solid #1976d2',
                borderRadius: '4px'
              }}>
                {uploadProgress}
              </div>
            )}
          </form>

          <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>What This Does</h3>
            <ul style={{ lineHeight: '1.8', color: '#666' }}>
              <li>Parses CAD design files (DXF, DWG, DGN) to extract layers and entities</li>
              <li>Identifies ITS equipment (signs, signals, cameras, DMS, sensors, RSUs)</li>
              <li>Extracts road geometry (centerlines, lane markings, pavement)</li>
              <li>Classifies traffic control devices and work zones</li>
              <li>Provides statistics on entities by type and layer</li>
              <li><strong>Exports to GeoJSON or CSV</strong> for georeferencing in ArcGIS/QGIS</li>
            </ul>
          </div>

          <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#eff6ff', borderRadius: '4px', border: '2px solid #3b82f6' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '15px', color: '#1e40af' }}>🗺️ Georeferencing Workflow</h3>
            <ol style={{ lineHeight: '1.8', color: '#1e40af', fontWeight: '500' }}>
              <li><strong>Upload CAD File:</strong> System extracts ITS equipment and road geometry</li>
              <li><strong>Export to GeoJSON or CSV:</strong> Download extracted elements with CAD coordinates</li>
              <li><strong>Import to ArcGIS/QGIS:</strong>
                <ul style={{ marginTop: '8px', fontSize: '14px', fontWeight: 'normal' }}>
                  <li>GeoJSON: Use "Add Data" and georeference using control points</li>
                  <li>CSV: Use "Display XY Data" with cad_x, cad_y columns</li>
                </ul>
              </li>
              <li><strong>Georeference:</strong> Add control points to convert CAD coords to lat/lng</li>
              <li><strong>Export from ArcGIS:</strong> Save as georeferenced Shapefile or GeoJSON</li>
              <li><strong>Import Back:</strong> Use georeferenced data in operations (future feature)</li>
            </ol>
          </div>
        </div>
      )}

      {/* Models List Tab */}
      {activeTab === 'models' && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>Uploaded CAD Models</h2>

          {loading ? (
            <p>Loading models...</p>
          ) : models.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
              <p style={{ fontSize: '18px', marginBottom: '10px' }}>No CAD models uploaded yet</p>
              <p>Upload your first CAD file to get started</p>
              <button
                onClick={() => setActiveTab('upload')}
                style={{
                  marginTop: '20px',
                  padding: '12px 30px',
                  backgroundColor: '#1976d2',
                  color: '#111827',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Upload CAD File
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '20px' }}>
              {models.map(model => (
                <div
                  key={model.id}
                  style={{
                    padding: '20px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    backgroundColor: '#f9fafb',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '18px', marginBottom: '10px', color: '#111827' }}>
                        📐 {model.original_filename}
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginTop: '15px' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Format</div>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>{model.file_format}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Entities</div>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3b82f6' }}>{model.total_entities || 0}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Layers</div>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>{model.total_layers || 0}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>ITS Equipment</div>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f59e0b' }}>{model.its_equipment_count || 0}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
                        {model.corridor && <span>📍 {model.corridor} • </span>}
                        {model.state && <span>{model.state.toUpperCase()} • </span>}
                        <span>Uploaded {new Date(model.uploaded_at).toLocaleDateString()}</span>
                        {model.uploaded_by && <span> by {model.uploaded_by}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => loadModelDetails(model.id)}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#1976d2',
                            color: '#111827',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => deleteModel(model.id)}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          Delete
                        </button>
                      </div>

                      {/* Export Buttons */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportToGeoJSON(model.id, model.original_filename);
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px'
                          }}
                          title="Export to GeoJSON for ArcGIS/QGIS georeferencing"
                        >
                          📄 GeoJSON
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportToCSV(model.id, model.original_filename);
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px'
                          }}
                          title="Export to CSV for ArcGIS Display XY Data"
                        >
                          📊 CSV/XY
                        </button>
                      </div>

                      <div style={{
                        fontSize: '10px',
                        color: '#6b7280',
                        marginTop: '4px'
                      }}>
                        💡 Export for georeferencing in ArcGIS/QGIS
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model Viewer Modal */}
      {selectedModel && (
        <CADDViewer
          model={selectedModel}
          onClose={() => setSelectedModel(null)}
        />
      )}
    </div>
  );
}
