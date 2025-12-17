import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';
import FileUpload from './FileUpload';
import './VendorPortal.css';

const VendorPortal = () => {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [truckParkingData, setTruckParkingData] = useState([]);
  const [activeTab, setActiveTab] = useState('upload');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (selectedProvider) {
      fetchUploadHistory();
      fetchTruckParkingData();
    }
  }, [selectedProvider]);

  const fetchProviders = async () => {
    try {
      const response = await axios.get(`${config.apiUrl}/api/plugins/providers`);
      if (response.data.success) {
        setProviders(response.data.providers);
        if (response.data.providers.length > 0) {
          setSelectedProvider(response.data.providers[0].provider_id);
        }
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const fetchUploadHistory = async () => {
    if (!selectedProvider) return;

    try {
      setLoading(true);
      const response = await axios.get(`${config.apiUrl}/api/vendors/uploads/${selectedProvider}`);
      if (response.data.success) {
        setUploads(response.data.uploads);
      }
    } catch (error) {
      console.error('Error fetching upload history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTruckParkingData = async () => {
    if (!selectedProvider) return;

    try {
      const response = await axios.get(`${config.apiUrl}/api/vendors/truck-parking`, {
        params: { limit: 100 }
      });
      if (response.data.success) {
        setTruckParkingData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching truck parking data:', error);
    }
  };

  const handleUploadComplete = () => {
    fetchUploadHistory();
    fetchTruckParkingData();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'completed': 'badge-success',
      'processing': 'badge-warning',
      'pending': 'badge-info',
      'failed': 'badge-danger'
    };
    return `status-badge ${statusColors[status] || 'badge-secondary'}`;
  };

  return (
    <div className="vendor-portal">
      <div className="portal-header">
        <h1>Vendor Data Portal</h1>
        <p>Upload and manage truck parking and segment enrichment data</p>
      </div>

      <div className="provider-selector">
        <label htmlFor="provider-select">Select Provider:</label>
        <select
          id="provider-select"
          value={selectedProvider || ''}
          onChange={(e) => setSelectedProvider(parseInt(e.target.value))}
          className="form-select"
        >
          {providers.map((provider) => (
            <option key={provider.provider_id} value={provider.provider_id}>
              {provider.provider_name} - {provider.category}
            </option>
          ))}
        </select>
      </div>

      <div className="portal-tabs">
        <button
          className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          Upload Data
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Upload History
        </button>
        <button
          className={`tab-button ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          Truck Parking Data
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'upload' && (
          <div className="upload-tab">
            <FileUpload
              providerId={selectedProvider}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-tab">
            <h2>Upload History</h2>
            {loading ? (
              <div className="loading">Loading upload history...</div>
            ) : uploads.length === 0 ? (
              <div className="empty-state">
                <p>No uploads yet. Start by uploading your first data file.</p>
              </div>
            ) : (
              <div className="uploads-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Filename</th>
                      <th>Type</th>
                      <th>Data Type</th>
                      <th>Size</th>
                      <th>Status</th>
                      <th>Rows</th>
                      <th>Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploads.map((upload) => (
                      <tr key={upload.upload_id}>
                        <td>{formatDate(upload.upload_date)}</td>
                        <td>{upload.filename}</td>
                        <td><span className="file-type-badge">{upload.file_type}</span></td>
                        <td><span className="data-type-badge">{upload.data_type}</span></td>
                        <td>{formatFileSize(upload.file_size)}</td>
                        <td>
                          <span className={getStatusBadge(upload.status)}>
                            {upload.status}
                          </span>
                        </td>
                        <td>{upload.rows_processed || 0}</td>
                        <td>{upload.rows_failed || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'data' && (
          <div className="data-tab">
            <h2>Truck Parking Data</h2>
            {truckParkingData.length === 0 ? (
              <div className="empty-state">
                <p>No truck parking data available. Upload data to see it here.</p>
              </div>
            ) : (
              <div className="parking-data-grid">
                {truckParkingData.slice(0, 20).map((facility, index) => (
                  <div key={index} className="facility-card">
                    <div className="facility-header">
                      <h3>{facility.facility_name || 'Unnamed Facility'}</h3>
                      <span className="facility-type">{facility.facility_type}</span>
                    </div>
                    <div className="facility-details">
                      <div className="detail-row">
                        <span className="label">State:</span>
                        <span className="value">{facility.state_code}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Total Spaces:</span>
                        <span className="value">{facility.total_spaces || 'N/A'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Available:</span>
                        <span className="value">{facility.available_spaces || 'N/A'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Occupied:</span>
                        <span className="value">{facility.occupied_spaces || 'N/A'}</span>
                      </div>
                      {facility.is_paid && (
                        <div className="detail-row">
                          <span className="label">Rate:</span>
                          <span className="value">
                            ${facility.hourly_rate || facility.daily_rate || 'N/A'}
                            {facility.hourly_rate ? '/hr' : '/day'}
                          </span>
                        </div>
                      )}
                      <div className="detail-row">
                        <span className="label">Last Updated:</span>
                        <span className="value">{formatDate(facility.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorPortal;
