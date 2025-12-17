import React, { useState, useRef } from 'react';
import axios from 'axios';
import { config } from '../config';
import './FileUpload.css';

const FileUpload = ({ providerId, onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dataType, setDataType] = useState('truck_parking');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file) => {
    // Validate file type
    const validTypes = [
      'text/csv',
      'application/json',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const validExtensions = ['.csv', '.json', '.xlsx', '.xls'];

    const fileExtension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    const isValidType = validTypes.includes(file.mimetype) || validExtensions.includes(fileExtension);

    if (!isValidType) {
      setError('Invalid file type. Please upload CSV, JSON, or Excel files only.');
      return;
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 50MB.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setUploadResult(null);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !providerId) {
      setError('Please select a file and provider');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('provider_id', providerId);
    formData.append('data_type', dataType);
    formData.append('uploaded_by', 'Web Portal');

    try {
      const response = await axios.post(`${config.apiUrl}/api/vendors/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      if (response.data.success) {
        setUploadResult(response.data);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (onUploadComplete) {
          onUploadComplete(response.data);
        }
      } else {
        setError(response.data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="file-upload-container">
      <div className="upload-section">
        <h2>Upload Data File</h2>
        <p className="upload-description">
          Upload truck parking data or segment enrichment data in CSV, JSON, or Excel format
        </p>

        <div className="data-type-selector">
          <label>Data Type:</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                value="truck_parking"
                checked={dataType === 'truck_parking'}
                onChange={(e) => setDataType(e.target.value)}
                disabled={uploading}
              />
              <span>Truck Parking Data</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                value="segment_enrichment"
                checked={dataType === 'segment_enrichment'}
                onChange={(e) => setDataType(e.target.value)}
                disabled={uploading}
              />
              <span>Segment Enrichment Data</span>
            </label>
          </div>
        </div>

        <div
          className={`dropzone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInputChange}
            accept=".csv,.json,.xlsx,.xls"
            style={{ display: 'none' }}
            disabled={uploading}
          />

          {!selectedFile ? (
            <>
              <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="dropzone-text">
                <strong>Drag and drop your file here</strong> or click to browse
              </p>
              <p className="dropzone-hint">
                Supported formats: CSV, JSON, Excel (max 50MB)
              </p>
            </>
          ) : (
            <div className="selected-file">
              <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="file-info">
                <p className="file-name">{selectedFile.name}</p>
                <p className="file-size">{formatFileSize(selectedFile.size)}</p>
              </div>
              {!uploading && (
                <button
                  className="remove-file-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>

        {uploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="progress-text">Uploading... {uploadProgress}%</p>
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {uploadResult && (
          <div className="alert alert-success">
            <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p><strong>Upload successful!</strong></p>
              <p>{uploadResult.message}</p>
              <p className="upload-stats">
                Processed: {uploadResult.rows_processed} rows
                {uploadResult.rows_failed > 0 && ` | Failed: ${uploadResult.rows_failed} rows`}
              </p>
            </div>
          </div>
        )}

        <div className="upload-actions">
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!selectedFile || uploading || !providerId}
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      </div>

      <div className="upload-help">
        <h3>File Format Guidelines</h3>
        <div className="help-section">
          <h4>Truck Parking Data (CSV/JSON)</h4>
          <p>Required fields:</p>
          <ul>
            <li><code>facility_name</code>: Name of the facility</li>
            <li><code>state_code</code>: State (e.g., IA, TX)</li>
            <li><code>latitude</code>, <code>longitude</code>: Location coordinates</li>
            <li><code>total_spaces</code>: Total parking spaces</li>
            <li><code>available_spaces</code>: Currently available spaces</li>
            <li><code>timestamp</code>: Data timestamp (ISO format)</li>
          </ul>
          <p>Optional fields:</p>
          <ul>
            <li><code>facility_type</code>: rest_area, truck_stop, private_lot, etc.</li>
            <li><code>amenities</code>: restrooms, fuel, food, wifi (comma-separated)</li>
            <li><code>is_paid</code>: true/false for paid parking</li>
            <li><code>hourly_rate</code>, <code>daily_rate</code>: Pricing information</li>
          </ul>
        </div>

        <div className="help-section">
          <h4>Segment Enrichment Data</h4>
          <p>Required fields:</p>
          <ul>
            <li><code>state_code</code>: State code</li>
            <li><code>route_name</code>: Route identifier (e.g., I-80, US-50)</li>
            <li><code>start_latitude</code>, <code>start_longitude</code>: Segment start</li>
            <li><code>end_latitude</code>, <code>end_longitude</code>: Segment end</li>
          </ul>
          <p>Optional fields (JSON objects):</p>
          <ul>
            <li><code>traffic_data</code>: Speed, volume, occupancy metrics</li>
            <li><code>safety_data</code>: Crash history, risk scores</li>
            <li><code>infrastructure_data</code>: Lane count, surface type</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
