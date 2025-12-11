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

  // Upload form state
  const [selectedFile, setSelectedFile] = useState(null);
  const [stateKey, setStateKey] = useState('');
  const [uploadedBy, setUploadedBy] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [route, setRoute] = useState('');
  const [milepost, setMilepost] = useState('');

  // Load models on mount
  useEffect(() => {
    loadModels();
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

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
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
                  State
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
                  <option value="IA">Iowa (IA)</option>
                  <option value="IL">Illinois (IL)</option>
                  <option value="IN">Indiana (IN)</option>
                  <option value="MI">Michigan (MI)</option>
                  <option value="MN">Minnesota (MN)</option>
                  <option value="OH">Ohio (OH)</option>
                  <option value="PA">Pennsylvania (PA)</option>
                  <option value="WI">Wisconsin (WI)</option>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="41.5"
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
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="-93.6"
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
                  Route
                </label>
                <input
                  type="text"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder="I-80"
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
                  Milepost
                </label>
                <input
                  type="number"
                  step="any"
                  value={milepost}
                  onChange={(e) => setMilepost(e.target.value)}
                  placeholder="123.4"
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
                    cursor: 'pointer',
                    transition: 'box-shadow 0.2s',
                  }}
                  onClick={() => loadModelDetails(model.id)}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
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
                    <div>
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
              <div>
                <button
                  onClick={() => downloadGapReport(modelDetails.id, modelDetails.filename.replace('.ifc', ''))}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginRight: '10px'
                  }}
                >
                  Download CSV Report
                </button>
                <button
                  onClick={() => downloadIDSFile(modelDetails.id, modelDetails.filename.replace('.ifc', ''))}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Download IDS XML
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
    </div>
  );
}

export default DigitalInfrastructure;
