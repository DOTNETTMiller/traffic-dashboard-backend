// Vendor Upload Service
// Handles file uploads, data parsing, and processing for truck parking and segment enrichment

const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parse/sync');

class VendorUploadService {
  constructor(db) {
    this.db = db;
    this.uploadDir = path.join(__dirname, 'uploads');
    this.ensureUploadDirectory();
  }

  /**
   * Ensure upload directory exists
   */
  async ensureUploadDirectory() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
      console.log('✅ Created uploads directory');
    }
  }

  /**
   * Process uploaded file
   * @param {Object} fileInfo - File metadata (filename, buffer, mimetype, etc.)
   * @param {Number} providerId - Provider ID from plugin_providers table
   * @param {String} dataType - Type of data: 'truck_parking', 'segment_enrichment', etc.
   * @param {String} uploadedBy - User/vendor who uploaded
   * @returns {Object} Upload result with upload_id and processing status
   */
  async processUpload(fileInfo, providerId, dataType, uploadedBy = 'API') {
    const { filename, buffer, mimetype } = fileInfo;

    try {
      // Save file to disk
      const timestamp = Date.now();
      const safeFilename = `${timestamp}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = path.join(this.uploadDir, safeFilename);
      await fs.writeFile(filePath, buffer);

      // Determine file type
      const fileType = this.getFileType(filename, mimetype);

      // Create upload record
      const uploadId = await this.createUploadRecord({
        providerId,
        filename: safeFilename,
        fileSize: buffer.length,
        fileType,
        filePath,
        dataType,
        uploadedBy
      });

      // Process file based on data type
      console.log(`📂 Processing ${dataType} upload: ${filename}`);

      let result;
      if (dataType === 'truck_parking') {
        result = await this.processTruckParkingData(uploadId, filePath, fileType, providerId);
      } else if (dataType === 'segment_enrichment') {
        result = await this.processSegmentEnrichment(uploadId, filePath, fileType, providerId);
      } else {
        throw new Error(`Unsupported data type: ${dataType}`);
      }

      // Update upload status
      await this.updateUploadStatus(uploadId, 'completed', result.rowsProcessed, result.rowsFailed);

      console.log(`✅ Upload ${uploadId} completed: ${result.rowsProcessed} rows processed, ${result.rowsFailed} failed`);

      return {
        upload_id: uploadId,
        status: 'completed',
        rows_processed: result.rowsProcessed,
        rows_failed: result.rowsFailed,
        message: `Successfully processed ${result.rowsProcessed} records`
      };

    } catch (error) {
      console.error('❌ Error processing upload:', error);

      // Update status to failed if we have an upload ID
      if (error.uploadId) {
        await this.updateUploadStatus(error.uploadId, 'failed', 0, 0, error.message);
      }

      throw error;
    }
  }

  /**
   * Create upload record in database
   */
  async createUploadRecord(uploadData) {
    const result = await this.db.runAsync(
      `INSERT INTO vendor_uploads
       (provider_id, filename, file_size, file_type, file_path, data_type, uploaded_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'processing')`,
      [
        uploadData.providerId,
        uploadData.filename,
        uploadData.fileSize,
        uploadData.fileType,
        uploadData.filePath,
        uploadData.dataType,
        uploadData.uploadedBy
      ]
    );

    return result.lastID;
  }

  /**
   * Update upload status
   */
  async updateUploadStatus(uploadId, status, rowsProcessed = 0, rowsFailed = 0, errorLog = null) {
    await this.db.runAsync(
      `UPDATE vendor_uploads
       SET status = ?, rows_processed = ?, rows_failed = ?, error_log = ?
       WHERE upload_id = ?`,
      [status, rowsProcessed, rowsFailed, errorLog, uploadId]
    );
  }

  /**
   * Determine file type from filename and mimetype
   */
  getFileType(filename, mimetype) {
    const ext = path.extname(filename).toLowerCase();

    if (ext === '.csv' || mimetype === 'text/csv') return 'csv';
    if (ext === '.json' || mimetype === 'application/json') return 'json';
    if (ext === '.xlsx' || ext === '.xls' || mimetype.includes('spreadsheet')) return 'excel';
    if (ext === '.xml' || mimetype === 'application/xml') return 'xml';

    return 'unknown';
  }

  /**
   * Process truck parking data from file
   */
  async processTruckParkingData(uploadId, filePath, fileType, providerId) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    let records = [];
    let rowsProcessed = 0;
    let rowsFailed = 0;

    try {
      // Parse file based on type
      if (fileType === 'csv') {
        records = csv.parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        });
      } else if (fileType === 'json') {
        const data = JSON.parse(fileContent);
        records = Array.isArray(data) ? data : [data];
      } else {
        throw new Error(`Unsupported file type for truck parking: ${fileType}`);
      }

      // Process each record
      for (const record of records) {
        try {
          await this.insertTruckParkingRecord(record, uploadId, providerId);
          rowsProcessed++;
        } catch (error) {
          console.error(`❌ Failed to process record:`, error.message);
          rowsFailed++;
        }
      }

      return { rowsProcessed, rowsFailed };

    } catch (error) {
      console.error('❌ Error parsing truck parking data:', error);
      throw error;
    }
  }

  /**
   * Insert truck parking record into database
   */
  async insertTruckParkingRecord(record, uploadId, providerId) {
    // Map CSV/JSON fields to database columns
    const facilityName = record.facility_name || record.name || record.facilityName;
    const facilityId = record.facility_id || record.id || record.facilityId;
    const stateCode = record.state_code || record.state || record.stateCode;
    const latitude = parseFloat(record.latitude || record.lat || 0);
    const longitude = parseFloat(record.longitude || record.lon || record.lng || 0);
    const address = record.address || null;
    const exitNumber = record.exit_number || record.exit || null;
    const mileMarker = record.mile_marker ? parseFloat(record.mile_marker) : null;

    // Capacity data
    const totalSpaces = parseInt(record.total_spaces || record.capacity || 0);
    const availableSpaces = parseInt(record.available_spaces || record.available || 0);
    const occupiedSpaces = parseInt(record.occupied_spaces || record.occupied || 0);
    const reservedSpaces = parseInt(record.reserved_spaces || record.reserved || 0);

    // Facility details
    const facilityType = record.facility_type || record.type || 'rest_area';
    const amenities = record.amenities ? JSON.stringify(
      Array.isArray(record.amenities) ? record.amenities : record.amenities.split(',')
    ) : null;
    const securityFeatures = record.security_features ? JSON.stringify(
      Array.isArray(record.security_features) ? record.security_features : record.security_features.split(',')
    ) : null;

    // Timing
    const timestamp = record.timestamp || new Date().toISOString();
    const isRealTime = record.is_real_time === true || record.is_real_time === '1' || record.is_real_time === 1;
    const forecastTime = record.forecast_time || null;

    // Operational
    const isOpen = record.is_open !== false && record.is_open !== '0' && record.is_open !== 0;
    const hoursOfOperation = record.hours_of_operation || record.hours || null;
    const restrictions = record.restrictions ? JSON.stringify(record.restrictions) : null;

    // Pricing
    const isPaid = record.is_paid === true || record.is_paid === '1' || record.is_paid === 1;
    const hourlyRate = record.hourly_rate ? parseFloat(record.hourly_rate) : null;
    const dailyRate = record.daily_rate ? parseFloat(record.daily_rate) : null;

    // Quality metrics
    const confidenceScore = record.confidence_score ? parseFloat(record.confidence_score) : null;
    const dataQualityScore = record.data_quality_score ? parseFloat(record.data_quality_score) : null;

    await this.db.runAsync(
      `INSERT INTO truck_parking_data (
        provider_id, upload_id,
        facility_name, facility_id, state_code, latitude, longitude, address, exit_number, mile_marker,
        total_spaces, available_spaces, occupied_spaces, reserved_spaces,
        facility_type, amenities, security_features,
        timestamp, is_real_time, forecast_time,
        is_open, hours_of_operation, restrictions,
        is_paid, hourly_rate, daily_rate,
        confidence_score, data_quality_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        providerId, uploadId,
        facilityName, facilityId, stateCode, latitude, longitude, address, exitNumber, mileMarker,
        totalSpaces, availableSpaces, occupiedSpaces, reservedSpaces,
        facilityType, amenities, securityFeatures,
        timestamp, isRealTime ? 1 : 0, forecastTime,
        isOpen ? 1 : 0, hoursOfOperation, restrictions,
        isPaid ? 1 : 0, hourlyRate, dailyRate,
        confidenceScore, dataQualityScore
      ]
    );
  }

  /**
   * Process segment enrichment data from file
   */
  async processSegmentEnrichment(uploadId, filePath, fileType, providerId) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    let records = [];
    let rowsProcessed = 0;
    let rowsFailed = 0;

    try {
      // Parse file based on type
      if (fileType === 'csv') {
        records = csv.parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        });
      } else if (fileType === 'json') {
        const data = JSON.parse(fileContent);
        records = Array.isArray(data) ? data : [data];
      } else {
        throw new Error(`Unsupported file type for segment enrichment: ${fileType}`);
      }

      // Process each record
      for (const record of records) {
        try {
          await this.insertSegmentEnrichmentRecord(record, uploadId, providerId);
          rowsProcessed++;
        } catch (error) {
          console.error(`❌ Failed to process segment record:`, error.message);
          rowsFailed++;
        }
      }

      return { rowsProcessed, rowsFailed };

    } catch (error) {
      console.error('❌ Error parsing segment enrichment data:', error);
      throw error;
    }
  }

  /**
   * Insert segment enrichment record into database
   */
  async insertSegmentEnrichmentRecord(record, uploadId, providerId) {
    const segmentId = record.segment_id || null;
    const corridorId = record.corridor_id || null;
    const stateCode = record.state_code || record.state;
    const routeName = record.route_name || record.route;

    // Geometry
    const startLat = parseFloat(record.start_latitude || record.start_lat || 0);
    const startLon = parseFloat(record.start_longitude || record.start_lon || 0);
    const endLat = parseFloat(record.end_latitude || record.end_lat || 0);
    const endLon = parseFloat(record.end_longitude || record.end_lon || 0);
    const startMM = record.start_mile_marker ? parseFloat(record.start_mile_marker) : null;
    const endMM = record.end_mile_marker ? parseFloat(record.end_mile_marker) : null;
    const lengthMiles = record.length_miles ? parseFloat(record.length_miles) : null;

    // JSON data fields
    const trafficData = record.traffic_data ? JSON.stringify(record.traffic_data) : null;
    const safetyData = record.safety_data ? JSON.stringify(record.safety_data) : null;
    const infrastructureData = record.infrastructure_data ? JSON.stringify(record.infrastructure_data) : null;
    const weatherData = record.weather_data ? JSON.stringify(record.weather_data) : null;
    const economicData = record.economic_data ? JSON.stringify(record.economic_data) : null;

    // Temporal
    const dataDate = record.data_date || null;
    const timePeriod = record.time_period || null;

    // Metadata
    const dataSource = record.data_source || null;
    const confidenceScore = record.confidence_score ? parseFloat(record.confidence_score) : null;

    await this.db.runAsync(
      `INSERT INTO segment_enrichment_data (
        provider_id, upload_id,
        segment_id, corridor_id, state_code, route_name,
        start_latitude, start_longitude, end_latitude, end_longitude,
        start_mile_marker, end_mile_marker, length_miles,
        traffic_data, safety_data, infrastructure_data, weather_data, economic_data,
        data_date, time_period,
        data_source, confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        providerId, uploadId,
        segmentId, corridorId, stateCode, routeName,
        startLat, startLon, endLat, endLon,
        startMM, endMM, lengthMiles,
        trafficData, safetyData, infrastructureData, weatherData, economicData,
        dataDate, timePeriod,
        dataSource, confidenceScore
      ]
    );
  }

  /**
   * Get upload history for a provider
   */
  async getUploadHistory(providerId, limit = 50) {
    const uploads = await this.db.allAsync(
      `SELECT
        upload_id, filename, file_size, file_type, data_type,
        upload_date, uploaded_by, status,
        rows_processed, rows_failed, notes
       FROM vendor_uploads
       WHERE provider_id = ?
       ORDER BY upload_date DESC
       LIMIT ?`,
      [providerId, limit]
    );

    return uploads;
  }

  /**
   * Get truck parking data for a facility
   */
  async getTruckParkingData(facilityId = null, stateCode = null, limit = 100) {
    let query = `
      SELECT
        t.*,
        p.provider_name,
        u.filename as source_file
      FROM truck_parking_data t
      LEFT JOIN plugin_providers p ON t.provider_id = p.provider_id
      LEFT JOIN vendor_uploads u ON t.upload_id = u.upload_id
      WHERE 1=1
    `;
    const params = [];

    if (facilityId) {
      query += ` AND t.facility_id = ?`;
      params.push(facilityId);
    }

    if (stateCode) {
      query += ` AND t.state_code = ?`;
      params.push(stateCode);
    }

    query += ` ORDER BY t.timestamp DESC LIMIT ?`;
    params.push(limit);

    const data = await this.db.allAsync(query, params);
    return data;
  }

  /**
   * Get segment enrichment data
   */
  async getSegmentEnrichmentData(segmentId = null, corridorId = null, stateCode = null, limit = 100) {
    let query = `
      SELECT
        s.*,
        p.provider_name,
        u.filename as source_file
      FROM segment_enrichment_data s
      LEFT JOIN plugin_providers p ON s.provider_id = p.provider_id
      LEFT JOIN vendor_uploads u ON s.upload_id = u.upload_id
      WHERE 1=1
    `;
    const params = [];

    if (segmentId) {
      query += ` AND s.segment_id = ?`;
      params.push(segmentId);
    }

    if (corridorId) {
      query += ` AND s.corridor_id = ?`;
      params.push(corridorId);
    }

    if (stateCode) {
      query += ` AND s.state_code = ?`;
      params.push(stateCode);
    }

    query += ` ORDER BY s.created_at DESC LIMIT ?`;
    params.push(limit);

    const data = await this.db.allAsync(query, params);
    return data;
  }

  /**
   * Generate AI predictions for truck parking
   * This is a placeholder for ML model integration
   */
  async generateParkingPredictions(facilityId, horizonHours = [1, 2, 4, 8, 24]) {
    // Get historical data for this facility
    const historicalData = await this.db.allAsync(
      `SELECT
        available_spaces, occupied_spaces, total_spaces, timestamp
       FROM truck_parking_data
       WHERE facility_id = ?
       AND timestamp >= datetime('now', '-30 days')
       ORDER BY timestamp ASC`,
      [facilityId]
    );

    if (historicalData.length < 10) {
      throw new Error('Insufficient historical data for predictions (need at least 10 data points)');
    }

    // Get facility info
    const facility = await this.db.getAsync(
      `SELECT state_code, latitude, longitude, total_spaces
       FROM truck_parking_data
       WHERE facility_id = ?
       ORDER BY timestamp DESC
       LIMIT 1`,
      [facilityId]
    );

    const predictions = [];

    // Simple prediction model (placeholder - replace with actual ML model)
    for (const hours of horizonHours) {
      const predictionTime = new Date();
      predictionTime.setHours(predictionTime.getHours() + hours);

      // Calculate average occupancy for this hour of week from historical data
      const avgOccupancy = this.calculateAverageOccupancy(historicalData, hours);
      const predictedAvailability = Math.max(0, facility.total_spaces - avgOccupancy);
      const predictedOccupancyRate = avgOccupancy / facility.total_spaces;

      const predictionId = await this.savePrediction({
        facilityId,
        stateCode: facility.state_code,
        latitude: facility.latitude,
        longitude: facility.longitude,
        predictedAvailability,
        predictedOccupancyRate,
        predictionTime: predictionTime.toISOString(),
        predictionHorizonHours: hours,
        modelVersion: 'v1.0-simple-average',
        confidenceScore: 0.7,
        featuresUsed: JSON.stringify(['hour_of_week', 'historical_average']),
        inputDataProviders: JSON.stringify(['historical_data']),
        historicalDataCount: historicalData.length
      });

      predictions.push({
        prediction_id: predictionId,
        horizon_hours: hours,
        predicted_availability: predictedAvailability,
        predicted_occupancy_rate: predictedOccupancyRate,
        prediction_time: predictionTime.toISOString()
      });
    }

    return predictions;
  }

  /**
   * Calculate average occupancy for time-of-week prediction
   */
  calculateAverageOccupancy(historicalData, hoursAhead) {
    const targetHour = new Date();
    targetHour.setHours(targetHour.getHours() + hoursAhead);
    const targetDayOfWeek = targetHour.getDay();
    const targetHourOfDay = targetHour.getHours();

    // Filter data for same day-of-week and hour
    const relevantData = historicalData.filter(record => {
      const recordTime = new Date(record.timestamp);
      return recordTime.getDay() === targetDayOfWeek &&
             Math.abs(recordTime.getHours() - targetHourOfDay) <= 1;
    });

    if (relevantData.length === 0) {
      // Fallback to overall average
      const totalOccupied = historicalData.reduce((sum, r) => sum + (r.occupied_spaces || 0), 0);
      return totalOccupied / historicalData.length;
    }

    const totalOccupied = relevantData.reduce((sum, r) => sum + (r.occupied_spaces || 0), 0);
    return totalOccupied / relevantData.length;
  }

  /**
   * Save prediction to database
   */
  async savePrediction(predictionData) {
    const result = await this.db.runAsync(
      `INSERT INTO ai_model_predictions (
        facility_id, state_code, latitude, longitude,
        predicted_availability, predicted_occupancy_rate,
        prediction_time, prediction_horizon_hours,
        model_version, confidence_score, features_used,
        input_data_providers, historical_data_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        predictionData.facilityId,
        predictionData.stateCode,
        predictionData.latitude,
        predictionData.longitude,
        predictionData.predictedAvailability,
        predictionData.predictedOccupancyRate,
        predictionData.predictionTime,
        predictionData.predictionHorizonHours,
        predictionData.modelVersion,
        predictionData.confidenceScore,
        predictionData.featuresUsed,
        predictionData.inputDataProviders,
        predictionData.historicalDataCount
      ]
    );

    return result.lastID;
  }

  /**
   * Track API usage
   */
  async trackAPIUsage(providerId, endpoint, uploadCount = 0, dataVolumeMB = 0) {
    const today = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();

    await this.db.runAsync(
      `INSERT INTO vendor_api_usage (
        provider_id, api_endpoint, request_count, upload_count, data_volume_mb,
        usage_date, hour_of_day
      ) VALUES (?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(provider_id, api_endpoint, usage_date, hour_of_day)
      DO UPDATE SET
        request_count = request_count + 1,
        upload_count = upload_count + ?,
        data_volume_mb = data_volume_mb + ?`,
      [providerId, endpoint, uploadCount, dataVolumeMB, today, currentHour, uploadCount, dataVolumeMB]
    );
  }

  /**
   * Get API usage statistics
   */
  async getAPIUsageStats(providerId, days = 30) {
    const stats = await this.db.allAsync(
      `SELECT
        usage_date,
        api_endpoint,
        SUM(request_count) as total_requests,
        SUM(upload_count) as total_uploads,
        SUM(data_volume_mb) as total_data_mb
       FROM vendor_api_usage
       WHERE provider_id = ?
       AND usage_date >= date('now', '-' || ? || ' days')
       GROUP BY usage_date, api_endpoint
       ORDER BY usage_date DESC`,
      [providerId, days]
    );

    return stats;
  }
}

module.exports = VendorUploadService;
