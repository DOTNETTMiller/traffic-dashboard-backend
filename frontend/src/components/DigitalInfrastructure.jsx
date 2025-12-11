import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';

const API_BASE = config.apiUrl;

function DigitalInfrastructure() {
  const [activeTab, setActiveTab] = useState('upload');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelDetails, setModelDetails] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [availableStates, setAvailableStates] = useState([]);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState(null);
  const [stateKey, setStateKey] = useState('');
  const [uploadedBy, setUploadedBy] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [route, setRoute] = useState('');
  const [milepost, setMilepost] = useState('');

  // Load models and states on mount
  useEffect(() => {
    loadModels();
    loadStates();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/digital-infrastructure/models`);
      setModels(response.data.models || []);
    } catch (error) {
      console.error('Error loading models:', error);
      alert('Failed to load models');
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
      // Fallback to hardcoded list if API fails
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

  const loadLiveStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/digital-infrastructure/models`);
      const allModels = response.data.models || [];

      // Calculate aggregate statistics
      const totalModels = allModels.length;
      const totalElements = allModels.reduce((sum, m) => sum + (m.total_elements || 0), 0);
      const statesContributing = [...new Set(allModels.map(m => m.state_key).filter(Boolean))];

      // Get most recent upload
      const mostRecent = allModels.length > 0
        ? new Date(Math.max(...allModels.map(m => new Date(m.upload_date))))
        : null;

      // Count by schema
      const schemaCount = {};
      allModels.forEach(m => {
        if (m.ifc_schema) {
          schemaCount[m.ifc_schema] = (schemaCount[m.ifc_schema] || 0) + 1;
        }
      });

      setLiveStats({
        totalModels,
        totalElements,
        statesContributing: statesContributing.length,
        statesList: statesContributing.sort(),
        mostRecent,
        schemaCount
      });
    } catch (error) {
      console.error('Error loading live stats:', error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.name.toLowerCase().endsWith('.ifc')) {
      setSelectedFile(file);
    } else {
      alert('Please select a valid IFC file (.ifc extension)');
      e.target.value = '';
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      alert('Please select an IFC file');
      return;
    }

    const formData = new FormData();
    formData.append('ifcFile', selectedFile);
    if (stateKey) formData.append('stateKey', stateKey);
    if (uploadedBy) formData.append('uploadedBy', uploadedBy);
    if (latitude) formData.append('latitude', latitude);
    if (longitude) formData.append('longitude', longitude);
    if (route) formData.append('route', route);
    if (milepost) formData.append('milepost', milepost);

    try {
      setUploading(true);
      setUploadProgress('Uploading and parsing IFC file...');

      const response = await axios.post(
        `${API_BASE}/api/digital-infrastructure/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      setUploadProgress(`Success! Extracted ${response.data.elements_extracted} elements, identified ${response.data.gaps_identified} gaps`);

      // Reset form
      setSelectedFile(null);
      setStateKey('');
      setUploadedBy('');
      setLatitude('');
      setLongitude('');
      setRoute('');
      setMilepost('');
      document.getElementById('ifcFileInput').value = '';

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
      const [detailsRes, gapsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/digital-infrastructure/models/${modelId}`),
        axios.get(`${API_BASE}/api/digital-infrastructure/gaps/${modelId}`)
      ]);

      setModelDetails(detailsRes.data.model);
      setGaps(gapsRes.data.gaps || []);
      setSelectedModel(modelId);
      setActiveTab('details');
    } catch (error) {
      console.error('Error loading model details:', error);
      alert('Failed to load model details');
    } finally {
      setLoading(false);
    }
  };

  const downloadGapReport = async (modelId, filename) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/digital-infrastructure/gap-report/${modelId}?format=csv`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `digital-infrastructure-gaps-${filename}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading gap report:', error);
      alert('Failed to download gap report');
    }
  };

  const downloadIDSFile = async (modelId, filename) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/digital-infrastructure/ids-export/${modelId}`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `its-requirements-${filename}-${Date.now()}.xml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading IDS file:', error);
      alert('Failed to download IDS file');
    }
  };

  const downloadStandardsReport = async (modelId, filename) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/digital-infrastructure/standards-report/${modelId}`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bim-standardization-requirements-${filename}-${Date.now()}.md`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading standards report:', error);
      alert('Failed to download standards report');
    }
  };

  const deleteModel = async (modelId, filename) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? This will permanently remove the model and all associated data.`)) {
      return;
    }

    try {
      const response = await axios.delete(`${API_BASE}/api/digital-infrastructure/models/${modelId}`);

      if (response.data.success) {
        alert(`Successfully deleted ${filename}`);
        // Reload models list
        await loadModels();
        // If we're viewing this model's details, switch back to models tab
        if (selectedModel === modelId) {
          setSelectedModel(null);
          setModelDetails(null);
          setActiveTab('models');
        }
      }
    } catch (error) {
      console.error('Error deleting model:', error);
      alert(error.response?.data?.error || 'Failed to delete model');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '10px' }}>Digital Infrastructure</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        BIM/IFC to ITS Operations - Extract operational data from Building Information Models
      </p>

      {/* Tabs */}
      <div style={{ borderBottom: '2px solid #e0e0e0', marginBottom: '30px' }}>
        <button
          onClick={() => setActiveTab('upload')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'upload' ? '3px solid #1976d2' : '3px solid transparent',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'upload' ? 'bold' : 'normal',
            color: activeTab === 'upload' ? '#1976d2' : '#666'
          }}
        >
          Upload IFC Model
        </button>
        <button
          onClick={() => setActiveTab('models')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'models' ? '3px solid #1976d2' : '3px solid transparent',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'models' ? 'bold' : 'normal',
            color: activeTab === 'models' ? '#1976d2' : '#666'
          }}
        >
          Models ({models.length})
        </button>
        {selectedModel && (
          <button
            onClick={() => setActiveTab('details')}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderBottom: activeTab === 'details' ? '3px solid #1976d2' : '3px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'details' ? 'bold' : 'normal',
              color: activeTab === 'details' ? '#1976d2' : '#666'
            }}
          >
            Model Details
          </button>
        )}
        <button
          onClick={() => {
            setActiveTab('documentation');
            if (!liveStats) loadLiveStats();
          }}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'documentation' ? '3px solid #1976d2' : '3px solid transparent',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'documentation' ? 'bold' : 'normal',
            color: activeTab === 'documentation' ? '#1976d2' : '#666'
          }}
        >
          Documentation
        </button>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>Upload IFC Model</h2>

          <form onSubmit={handleUpload}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                IFC File *
              </label>
              <input
                id="ifcFileInput"
                type="file"
                accept=".ifc"
                onChange={handleFileSelect}
                disabled={uploading}
                style={{
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  width: '100%'
                }}
              />
              {selectedFile && (
                <p style={{ marginTop: '8px', color: '#666', fontSize: '14px' }}>
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
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

            <div style={{ padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '4px', marginBottom: '15px', fontSize: '14px', color: '#0369a1' }}>
              <strong>Note:</strong> Location and route information will be automatically extracted from the IFC model if available. These fields are optional overrides.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Latitude (optional)
                </label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="Auto-extracted from IFC"
                  disabled={uploading}
                  style={{
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    width: '100%'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Longitude (optional)
                </label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="Auto-extracted from IFC"
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

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '30px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Route (optional)
                </label>
                <input
                  type="text"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder="I-80 (auto-extracted if available)"
                  disabled={uploading}
                  style={{
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    width: '100%'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Milepost (optional)
                </label>
                <input
                  type="number"
                  step="any"
                  value={milepost}
                  onChange={(e) => setMilepost(e.target.value)}
                  placeholder="Auto-extracted"
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

            <button
              type="submit"
              disabled={!selectedFile || uploading}
              style={{
                padding: '12px 30px',
                backgroundColor: !selectedFile || uploading ? '#ccc' : '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer'
              }}
            >
              {uploading ? 'Processing...' : 'Upload and Extract'}
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

          <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>What This Does</h3>
            <ul style={{ lineHeight: '1.8', color: '#666' }}>
              <li>Parses your IFC model to extract infrastructure elements (bridges, beams, signs, etc.)</li>
              <li>Identifies what data is present vs. what ITS operations require</li>
              <li>Generates gap analysis showing missing properties for V2X and AV systems</li>
              <li>Creates buildingSMART IDM/IDS recommendations for industry standards</li>
              <li>Supports IFC2X3 and IFC4.3 schemas</li>
            </ul>
          </div>
        </div>
      )}

      {/* Models List Tab */}
      {activeTab === 'models' && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>Uploaded Models</h2>

          {loading ? (
            <p>Loading models...</p>
          ) : models.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
              <p style={{ fontSize: '18px', marginBottom: '10px' }}>No models uploaded yet</p>
              <p>Upload your first IFC model to get started</p>
              <button
                onClick={() => setActiveTab('upload')}
                style={{
                  marginTop: '20px',
                  padding: '12px 30px',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Upload IFC Model
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '20px' }}>
              {models.map(model => (
                <div
                  key={model.id}
                  style={{
                    padding: '20px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    transition: 'box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div
                      style={{ flex: 1, cursor: 'pointer' }}
                      onClick={() => loadModelDetails(model.id)}
                    >
                      <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#1976d2' }}>
                        {model.filename}
                      </h3>
                      <p style={{ color: '#666', marginBottom: '8px' }}>
                        {model.project_name || 'No project name'}
                      </p>
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', color: '#666' }}>
                          Schema: <strong>{model.ifc_schema}</strong>
                        </span>
                        <span style={{ fontSize: '14px', color: '#666' }}>
                          Elements: <strong>{model.total_elements}</strong>
                        </span>
                        {model.state_key && (
                          <span style={{ fontSize: '14px', color: '#666' }}>
                            State: <strong>{model.state_key}</strong>
                          </span>
                        )}
                        <span style={{ fontSize: '14px', color: '#666' }}>
                          Uploaded: <strong>{new Date(model.upload_date).toLocaleDateString()}</strong>
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                      <span style={{
                        padding: '6px 12px',
                        backgroundColor: model.extraction_status === 'completed' ? '#4caf50' : '#ff9800',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {model.extraction_status.toUpperCase()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteModel(model.id, model.filename);
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model Details Tab */}
      {activeTab === 'details' && modelDetails && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>{modelDetails.filename}</h2>
            <p style={{ color: '#666' }}>{modelDetails.project_name}</p>
          </div>

          {/* Statistics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1976d2', marginBottom: '8px' }}>
                {modelDetails.total_elements}
              </div>
              <div style={{ color: '#666' }}>Total Elements</div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f57c00', marginBottom: '8px' }}>
                {modelDetails.v2x_elements}
              </div>
              <div style={{ color: '#666' }}>V2X Applicable</div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#fce4ec', borderRadius: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#c2185b', marginBottom: '8px' }}>
                {modelDetails.av_critical_elements}
              </div>
              <div style={{ color: '#666' }}>AV Critical</div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#ffebee', borderRadius: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#d32f2f', marginBottom: '8px' }}>
                {modelDetails.gaps}
              </div>
              <div style={{ color: '#666' }}>Data Gaps</div>
            </div>
          </div>

          {/* Element Types */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '15px' }}>Element Types</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
              {Object.entries(modelDetails.by_type || {}).map(([type, count]) => (
                <div key={type} style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{type}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Gap Analysis */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '20px' }}>Gap Analysis ({gaps.length} gaps)</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => downloadGapReport(modelDetails.id, modelDetails.filename.replace('.ifc', ''))}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  📊 Download CSV Report
                </button>
                <button
                  onClick={() => downloadIDSFile(modelDetails.id, modelDetails.filename.replace('.ifc', ''))}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  🏗️ Download IDS XML
                </button>
                <button
                  onClick={() => downloadStandardsReport(modelDetails.id, modelDetails.filename.replace('.ifc', ''))}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  📋 BIM Standardization Report
                </button>
              </div>
            </div>

            {gaps.length === 0 ? (
              <p style={{ color: '#666', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                No gaps identified - this model contains all required properties for ITS operations!
              </p>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Severity</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Missing Property</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Required For</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>ITS Use Case</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Standards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gaps.slice(0, 50).map((gap, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: gap.severity === 'high' ? '#ffebee' : '#fff3e0',
                            color: gap.severity === 'high' ? '#d32f2f' : '#f57c00',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {gap.severity.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{gap.missing_property}</td>
                        <td style={{ padding: '12px' }}>{gap.required_for}</td>
                        <td style={{ padding: '12px', fontSize: '14px', color: '#666' }}>{gap.its_use_case}</td>
                        <td style={{ padding: '12px', fontSize: '14px', color: '#666' }}>{gap.standards_reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {gaps.length > 50 && (
                  <p style={{ padding: '15px', textAlign: 'center', color: '#666', backgroundColor: '#f5f5f5' }}>
                    Showing first 50 of {gaps.length} gaps. Download CSV for complete report.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documentation Tab */}
      {activeTab === 'documentation' && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>Digital Infrastructure Documentation</h2>
          <p style={{ color: '#666', marginBottom: '30px' }}>
            BIM/IFC to ITS Operations - System Overview and Live Statistics
          </p>

          {/* Live Statistics */}
          {liveStats && (
            <div style={{ marginBottom: '40px', padding: '20px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #0ea5e9' }}>
              <h3 style={{ fontSize: '20px', marginBottom: '20px', color: '#0369a1' }}>Live Usage Statistics</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px' }}>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1976d2', marginBottom: '8px' }}>
                    {liveStats.totalModels}
                  </div>
                  <div style={{ color: '#666' }}>Models Uploaded</div>
                </div>

                <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px' }}>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#059669', marginBottom: '8px' }}>
                    {liveStats.totalElements.toLocaleString()}
                  </div>
                  <div style={{ color: '#666' }}>Infrastructure Elements</div>
                </div>

                <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px' }}>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#f57c00', marginBottom: '8px' }}>
                    {liveStats.statesContributing}
                  </div>
                  <div style={{ color: '#666' }}>States Contributing</div>
                </div>

                {liveStats.mostRecent && (
                  <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#7c3aed', marginBottom: '8px' }}>
                      {liveStats.mostRecent.toLocaleDateString()}
                    </div>
                    <div style={{ color: '#666' }}>Most Recent Upload</div>
                  </div>
                )}
              </div>

              {liveStats.statesList.length > 0 && (
                <div style={{ marginBottom: '15px' }}>
                  <strong>Contributing States:</strong> {liveStats.statesList.join(', ')}
                </div>
              )}

              {Object.keys(liveStats.schemaCount).length > 0 && (
                <div>
                  <strong>IFC Schemas in Use:</strong>
                  <div style={{ display: 'flex', gap: '15px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {Object.entries(liveStats.schemaCount).map(([schema, count]) => (
                      <span key={schema} style={{ padding: '6px 12px', backgroundColor: 'white', borderRadius: '4px', fontSize: '14px' }}>
                        {schema}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* System Overview */}
          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '15px', borderBottom: '2px solid #e0e0e0', paddingBottom: '10px' }}>
              System Overview
            </h3>
            <p style={{ lineHeight: '1.8', color: '#444', marginBottom: '15px' }}>
              This system bridges the gap between BIM/CAD design data and ITS operational needs by extracting infrastructure elements
              from IFC models, analyzing what properties exist versus what ITS operations require, identifying gaps in data for V2X
              and autonomous vehicle deployments, and generating buildingSMART IDM/IDS recommendations for industry standards.
            </p>
            <p style={{ lineHeight: '1.8', color: '#444' }}>
              This directly informs IDM/IDS development for transportation infrastructure at scale, helping to close the gap between
              design-phase BIM models and operational ITS requirements.
            </p>
          </div>

          {/* Supported IFC Types */}
          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '15px', borderBottom: '2px solid #e0e0e0', paddingBottom: '10px' }}>
              Supported IFC Types
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
              {[
                { type: 'IFCBRIDGE', desc: 'Bridge structures (V2X + AV critical)', critical: true },
                { type: 'IFCBEAM', desc: 'Girders, beams (clearance verification)', critical: true },
                { type: 'IFCSIGN', desc: 'Traffic signs (V2X critical)', critical: true },
                { type: 'IFCPAVEMENT', desc: 'Pavement surfaces', critical: false },
                { type: 'IFCKERB', desc: 'Lane boundaries', critical: false },
                { type: 'IFCROAD/IFCROADPART', desc: 'Roadway elements', critical: false },
                { type: 'IFCCOLUMN', desc: 'Structural columns', critical: false },
                { type: 'IFCPLATE', desc: 'Deck plates, structural plates', critical: false },
              ].map(item => (
                <div key={item.type} style={{
                  padding: '15px',
                  backgroundColor: item.critical ? '#fef3c7' : '#f5f5f5',
                  borderRadius: '4px',
                  borderLeft: item.critical ? '4px solid #f59e0b' : '4px solid #999'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px', fontFamily: 'monospace' }}>
                    {item.type}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ITS Use Cases */}
          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '15px', borderBottom: '2px solid #e0e0e0', paddingBottom: '10px' }}>
              Industry Impact & Use Cases
            </h3>

            <div style={{ display: 'grid', gap: '20px' }}>
              <div style={{ padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
                <h4 style={{ fontSize: '18px', marginBottom: '10px', color: '#1976d2' }}>V2X Deployments</h4>
                <ul style={{ lineHeight: '1.8', color: '#444', margin: '0', paddingLeft: '20px' }}>
                  <li>Bridge clearance broadcasting to commercial vehicles</li>
                  <li>Sign message content for V2X-enabled vehicles</li>
                  <li>Pavement condition for traction control systems</li>
                </ul>
              </div>

              <div style={{ padding: '20px', backgroundColor: '#f3e5f5', borderRadius: '8px' }}>
                <h4 style={{ fontSize: '18px', marginBottom: '10px', color: '#7b1fa2' }}>Autonomous Vehicles</h4>
                <ul style={{ lineHeight: '1.8', color: '#444', margin: '0', paddingLeft: '20px' }}>
                  <li>Route planning with vertical clearance verification</li>
                  <li>Lane boundary detection from pavement markings</li>
                  <li>Dynamic routing around low-clearance structures</li>
                </ul>
              </div>

              <div style={{ padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
                <h4 style={{ fontSize: '18px', marginBottom: '10px', color: '#2e7d32' }}>Digital Infrastructure</h4>
                <ul style={{ lineHeight: '1.8', color: '#444', margin: '0', paddingLeft: '20px' }}>
                  <li>Real-time infrastructure data feeds</li>
                  <li>Operational digital twins for asset management</li>
                  <li>Integration with existing ITS and asset management systems</li>
                </ul>
              </div>

              <div style={{ padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px' }}>
                <h4 style={{ fontSize: '18px', marginBottom: '10px', color: '#e65100' }}>Grant Applications</h4>
                <ul style={{ lineHeight: '1.8', color: '#444', margin: '0', paddingLeft: '20px' }}>
                  <li>SMART grants (data-driven transportation)</li>
                  <li>RAISE grants (innovative infrastructure)</li>
                  <li>ATCMTD programs (advanced transportation technologies)</li>
                  <li>Digital infrastructure modernization initiatives</li>
                </ul>
              </div>
            </div>
          </div>

          {/* buildingSMART Standards */}
          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '15px', borderBottom: '2px solid #e0e0e0', paddingBottom: '10px' }}>
              buildingSMART IDM/IDS Development
            </h3>
            <p style={{ lineHeight: '1.8', color: '#444', marginBottom: '15px' }}>
              This system demonstrates the gap between current BIM models and ITS operational requirements, providing concrete
              data-driven recommendations for buildingSMART standards development:
            </p>
            <ul style={{ lineHeight: '1.8', color: '#444', paddingLeft: '20px' }}>
              <li><strong>Current State:</strong> What BIM models provide today (extracted elements and properties)</li>
              <li><strong>Operational Needs:</strong> What ITS systems actually require for V2X, AV, and digital infrastructure</li>
              <li><strong>Gaps:</strong> Specific properties missing for digital infrastructure maturity</li>
              <li><strong>Standards:</strong> Precise IDM/IDS requirements to close gaps and enable operational data exchange</li>
            </ul>
          </div>

          {/* Technical Details */}
          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '15px', borderBottom: '2px solid #e0e0e0', paddingBottom: '10px' }}>
              Technical Architecture
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <h4 style={{ fontSize: '16px', marginBottom: '10px', color: '#1976d2' }}>Backend</h4>
                <ul style={{ lineHeight: '1.6', color: '#666', fontSize: '14px', margin: '0', paddingLeft: '20px' }}>
                  <li>Custom IFC parser (IFC2X3, IFC4.3)</li>
                  <li>Multi-line entity parsing</li>
                  <li>Gap analysis engine</li>
                  <li>IDM/IDS recommendation generation</li>
                  <li>PostgreSQL + SQLite dual support</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: '16px', marginBottom: '10px', color: '#1976d2' }}>Database Schema</h4>
                <ul style={{ lineHeight: '1.6', color: '#666', fontSize: '14px', margin: '0', paddingLeft: '20px' }}>
                  <li>ifc_models - Uploaded BIM files</li>
                  <li>infrastructure_elements - Extracted data</li>
                  <li>infrastructure_gaps - Missing properties</li>
                  <li>infrastructure_standards - IFC to ITS mapping</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Getting Started */}
          <div style={{ padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>Getting Started</h3>
            <ol style={{ lineHeight: '1.8', color: '#444', paddingLeft: '20px' }}>
              <li>Upload your IFC model (IFC2X3 or IFC4.3 format) using the Upload tab</li>
              <li>System automatically extracts infrastructure elements and analyzes gaps</li>
              <li>Review extraction results and gap analysis in the Models and Details tabs</li>
              <li>Download CSV gap reports for review or buildingSMART IDS XML for validation</li>
              <li>Use findings to inform BIM authoring workflows and standards development</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default DigitalInfrastructure;
