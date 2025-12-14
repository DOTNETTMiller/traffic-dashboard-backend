import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';
import IFCViewer from './IFCViewer';
import IFCModelViewer from './IFCModelViewer';

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
  const [docContent, setDocContent] = useState('');
  const [docLoading, setDocLoading] = useState(false);

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

  const loadDocumentation = async () => {
    setDocLoading(true);
    try {
      const response = await fetch(`${API_BASE}/docs/digital-infrastructure.md`);
      if (response.ok) {
        const text = await response.text();
        setDocContent(text);
      } else {
        setDocContent('# Documentation Not Found\n\nThe digital infrastructure documentation could not be loaded.');
      }
    } catch (error) {
      setDocContent(`# Error Loading Documentation\n\n${error.message}`);
    }
    setDocLoading(false);
  };

  // Simple markdown to HTML converter (same as DocumentationViewer)
  const renderMarkdown = (markdown) => {
    if (!markdown) return '';

    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/gim, '<pre><code>$2</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Tables
    const lines = html.split('\n');
    let inTable = false;
    let tableHTML = '';
    const processedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('|') && line.trim().startsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHTML = '<table class="doc-table">';

          const nextLine = lines[i + 1];
          const isHeader = nextLine && nextLine.includes('|') && nextLine.includes('---');

          if (isHeader) {
            tableHTML += '<thead><tr>';
            const headers = line.split('|').filter(cell => cell.trim());
            headers.forEach(header => {
              tableHTML += `<th>${header.trim()}</th>`;
            });
            tableHTML += '</tr></thead><tbody>';
            i++;
            continue;
          } else {
            tableHTML += '<tbody>';
          }
        }

        tableHTML += '<tr>';
        const cells = line.split('|').filter(cell => cell.trim());
        cells.forEach(cell => {
          tableHTML += `<td>${cell.trim()}</td>`;
        });
        tableHTML += '</tr>';
      } else {
        if (inTable) {
          tableHTML += '</tbody></table>';
          processedLines.push(tableHTML);
          tableHTML = '';
          inTable = false;
        }
        processedLines.push(line);
      }
    }

    if (inTable) {
      tableHTML += '</tbody></table>';
      processedLines.push(tableHTML);
    }

    html = processedLines.join('\n');

    // Lists
    html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    return html;
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

      // Create blob with explicit markdown MIME type
      const blob = new Blob([response.data], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bim-standardization-requirements-${filename}-${Date.now()}.md`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      console.log('✅ Standards report downloaded successfully');
    } catch (error) {
      console.error('Error downloading standards report:', error);
      alert(`Failed to download standards report: ${error.response?.data?.error || error.message}`);
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
            if (!docContent) loadDocumentation();
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
          <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>Upload BIM/CAD Model</h2>
          <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
            Supported formats: IFC (.ifc), DXF (.dxf), DWG (.dwg), DGN (.dgn)
          </p>

          <form onSubmit={handleUpload}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                BIM/CAD File *
              </label>
              <input
                id="ifcFileInput"
                type="file"
                accept=".ifc,.dxf,.dwg,.dgn"
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
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                    {/* 3D Preview Thumbnail */}
                    <div style={{ flexShrink: 0, width: '200px' }}>
                      <IFCViewer model={model} width="200px" height="150px" />
                    </div>

                    {/* Model Info */}
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

                    {/* Action Buttons */}
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

          {/* 3D Model Viewer */}
          {modelDetails.filename?.toLowerCase().endsWith('.ifc') && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '20px', marginBottom: '15px' }}>3D Model Viewer</h3>
              <IFCModelViewer modelId={modelDetails.id} filename={modelDetails.filename} />
            </div>
          )}

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
              <h3 style={{ fontSize: '20px' }}>Gap Analysis ({gaps.length} unique gaps)</h3>
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
                ✅ No gaps identified - this model contains all required properties for ITS operations!
              </p>
            ) : (
              <div>
                {/* Gap Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                  <div style={{ padding: '20px', backgroundColor: '#ffebee', borderRadius: '8px', border: '2px solid #d32f2f' }}>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#d32f2f', marginBottom: '8px' }}>
                      {gaps.filter(g => g.severity === 'high').length}
                    </div>
                    <div style={{ color: '#666', fontSize: '14px' }}>High Severity Gaps</div>
                  </div>
                  <div style={{ padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px', border: '2px solid #f57c00' }}>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f57c00', marginBottom: '8px' }}>
                      {gaps.filter(g => g.severity === 'medium').length}
                    </div>
                    <div style={{ color: '#666', fontSize: '14px' }}>Medium Severity Gaps</div>
                  </div>
                  <div style={{ padding: '20px', backgroundColor: '#f1f8e9', borderRadius: '8px', border: '2px solid #689f38' }}>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#689f38', marginBottom: '8px' }}>
                      {gaps.filter(g => g.severity === 'low').length}
                    </div>
                    <div style={{ color: '#666', fontSize: '14px' }}>Low Severity Gaps</div>
                  </div>
                </div>

                {/* Gaps by Priority */}
                <div style={{ marginBottom: '15px' }}>
                  <h4 style={{ fontSize: '16px', marginBottom: '10px', color: '#666' }}>
                    Top Priority Data Gaps (sorted by severity and impact)
                  </h4>
                </div>

                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {gaps.slice(0, 20).map((gap, idx) => (
                    <div
                      key={idx}
                      style={{
                        marginBottom: '12px',
                        padding: '16px',
                        backgroundColor: '#ffffff',
                        border: `2px solid ${gap.severity === 'high' ? '#d32f2f' : gap.severity === 'medium' ? '#f57c00' : '#689f38'}`,
                        borderRadius: '8px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{
                              padding: '4px 10px',
                              backgroundColor: gap.severity === 'high' ? '#d32f2f' : gap.severity === 'medium' ? '#f57c00' : '#689f38',
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase'
                            }}>
                              {gap.severity}
                            </span>
                            <span style={{
                              padding: '4px 10px',
                              backgroundColor: '#e3f2fd',
                              color: '#1976d2',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '500'
                            }}>
                              {gap.gap_category || 'General'}
                            </span>
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
                            Missing: {gap.missing_property}
                          </div>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '6px' }}>
                            <strong>Required for:</strong> {gap.required_for}
                          </div>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '6px' }}>
                            <strong>ITS Use Case:</strong> {gap.its_use_case}
                          </div>
                          <div style={{ fontSize: '13px', color: '#999' }}>
                            <strong>Standards:</strong> {gap.standards_reference}
                          </div>
                        </div>
                        <div style={{
                          marginLeft: '20px',
                          padding: '12px 16px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '8px',
                          textAlign: 'center',
                          minWidth: '120px'
                        }}>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                            {gap.affected_element_count || 1}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {gap.affected_element_count === 1 ? 'element' : 'elements'} affected
                          </div>
                        </div>
                      </div>

                      {gap.idm_recommendation && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px',
                          backgroundColor: '#f9f9f9',
                          borderLeft: '3px solid #1976d2',
                          fontSize: '13px',
                          color: '#555'
                        }}>
                          <strong>💡 Recommendation:</strong> {gap.idm_recommendation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {gaps.length > 20 && (
                  <div style={{
                    marginTop: '20px',
                    padding: '15px',
                    textAlign: 'center',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '8px',
                    border: '1px solid #1976d2'
                  }}>
                    <p style={{ margin: 0, color: '#1976d2', fontWeight: '500' }}>
                      Showing top 20 of {gaps.length} unique gaps. Download the CSV report for complete analysis.
                    </p>
                  </div>
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
            Comprehensive guide to BIM/IFC integration with ITS operations, ARC-ITS data, and digital twin workflows
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

          {/* Markdown Documentation Content */}
          {docLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              Loading documentation...
            </div>
          ) : docContent ? (
            <div
              className="markdown-content"
              style={{
                fontSize: '15px',
                lineHeight: '1.7',
                color: '#1f2937',
                maxHeight: 'calc(100vh - 400px)',
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingRight: '8px'
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(docContent) }}
            />
          ) : (
            <div style={{ padding: '20px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
              <p style={{ margin: 0, color: '#856404' }}>
                Click the Documentation tab to load the comprehensive digital infrastructure guide.
              </p>
            </div>
          )}

          {/* CSS for markdown content */}
          <style>{`
            .markdown-content h1 {
              font-size: 32px;
              font-weight: 700;
              margin: 24px 0 16px 0;
              color: #111827;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 8px;
            }
            .markdown-content h2 {
              font-size: 24px;
              font-weight: 600;
              margin: 20px 0 12px 0;
              color: #1f2937;
            }
            .markdown-content h3 {
              font-size: 20px;
              font-weight: 600;
              margin: 16px 0 8px 0;
              color: #374151;
            }
            .markdown-content p {
              margin: 12px 0;
            }
            .markdown-content code {
              background-color: #f3f4f6;
              padding: 2px 6px;
              border-radius: 3px;
              font-family: 'Monaco', 'Courier New', monospace;
              font-size: 13px;
              color: #be123c;
            }
            .markdown-content pre {
              background-color: #1f2937;
              color: #f9fafb;
              padding: 16px;
              border-radius: 6px;
              overflow-x: auto;
              margin: 16px 0;
            }
            .markdown-content pre code {
              background-color: transparent;
              color: #f9fafb;
              padding: 0;
            }
            .markdown-content strong {
              font-weight: 600;
              color: #111827;
            }
            .markdown-content ul {
              margin: 12px 0;
              padding-left: 24px;
            }
            .markdown-content li {
              margin: 6px 0;
              list-style-type: disc;
            }
            .markdown-content a {
              color: #2563eb;
              text-decoration: underline;
            }
            .markdown-content a:hover {
              color: #1d4ed8;
            }
            .doc-table {
              width: 100%;
              border-collapse: collapse;
              margin: 16px 0;
              font-size: 14px;
            }
            .doc-table th {
              background-color: #f3f4f6;
              border: 1px solid #d1d5db;
              padding: 10px;
              text-align: left;
              font-weight: 600;
              color: #111827;
            }
            .doc-table td {
              border: 1px solid #e5e7eb;
              padding: 10px;
            }
            .doc-table tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .markdown-content::-webkit-scrollbar {
              width: 8px;
            }
            .markdown-content::-webkit-scrollbar-track {
              background: #f1f1f1;
              border-radius: 10px;
            }
            .markdown-content::-webkit-scrollbar-thumb {
              background: #3b82f6;
              border-radius: 10px;
            }
            .markdown-content::-webkit-scrollbar-thumb:hover {
              background: #2563eb;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

export default DigitalInfrastructure;
