/**
 * Parking Prediction Calibration Service
 *
 * Runs a daily batch analysis using GPT-4o-mini to tune parking prediction weights.
 * Compares predictions vs. actuals, analyzes error patterns by time/day/state/corridor
 * conditions, and generates calibration weights the parking service applies at runtime.
 *
 * Cost: ~$0.01-0.02/day with GPT-4o-mini ($3-6/year).
 */

const fs = require('fs');
const path = require('path');

const CALIBRATION_FILE = path.join(__dirname, '..', 'data', 'parking_calibration.json');
const CALIBRATION_LOG = path.join(__dirname, '..', 'data', 'parking_calibration_log.json');

// Default calibration weights (used when no AI calibration has run yet)
const DEFAULT_CALIBRATION = {
  version: 0,
  generatedAt: null,
  timeOfDayMultipliers: {
    // hour -> multiplier applied to base occupancy rate
    0: 1.0, 1: 1.0, 2: 1.0, 3: 1.0, 4: 0.95, 5: 0.90,
    6: 0.85, 7: 0.85, 8: 0.85, 9: 0.85, 10: 0.85, 11: 0.85,
    12: 0.90, 13: 0.90, 14: 0.90, 15: 0.95, 16: 0.95, 17: 1.0,
    18: 1.05, 19: 1.10, 20: 1.15, 21: 1.15, 22: 1.10, 23: 1.05
  },
  dayOfWeekMultipliers: {
    0: 0.90, 1: 1.0, 2: 1.0, 3: 1.05, 4: 1.10, 5: 1.05, 6: 0.90
  },
  stateMultipliers: {},
  corridorDelaySurgeMultiplier: 1.0,
  biasCorrection: 0,
  notes: 'Default weights - no AI calibration yet'
};

class ParkingCalibrationService {
  constructor(db) {
    this.db = db;
    this.calibration = null;
    this._loadCalibration();
  }

  _loadCalibration() {
    try {
      if (fs.existsSync(CALIBRATION_FILE)) {
        this.calibration = JSON.parse(fs.readFileSync(CALIBRATION_FILE, 'utf8'));
        console.log(`📐 Loaded parking calibration v${this.calibration.version} from ${this.calibration.generatedAt || 'unknown'}`);
      } else {
        this.calibration = { ...DEFAULT_CALIBRATION };
        console.log('📐 Using default parking calibration (no AI calibration yet)');
      }
    } catch (error) {
      console.error('Warning: failed to load parking calibration:', error.message);
      this.calibration = { ...DEFAULT_CALIBRATION };
    }
  }

  /**
   * Get current calibration weights for the parking service to use
   */
  getCalibration() {
    return this.calibration;
  }

  /**
   * Apply calibration weights to a single prediction
   */
  applyCalibration(prediction) {
    if (!this.calibration || !prediction) return prediction;

    const cal = this.calibration;
    const hour = prediction.hour;
    const day = prediction.dayOfWeek;

    // Apply time-of-day multiplier
    const timeMult = cal.timeOfDayMultipliers?.[hour] ?? 1.0;

    // Apply day-of-week multiplier
    const dayMult = cal.dayOfWeekMultipliers?.[day] ?? 1.0;

    // Apply state-specific multiplier
    const stateMult = cal.stateMultipliers?.[prediction.state] ?? 1.0;

    // Combined adjustment
    const adjustedRate = Math.min(0.99, Math.max(0.01,
      (prediction.occupancyRate * timeMult * dayMult * stateMult) + (cal.biasCorrection || 0)
    ));

    if (Math.abs(adjustedRate - prediction.occupancyRate) > 0.005) {
      const capacity = prediction.capacity || 0;
      prediction.occupancyRate = Math.round(adjustedRate * 100) / 100;
      prediction.predictedAvailable = Math.max(0, Math.round(capacity * (1 - adjustedRate)));
      prediction.predictedOccupied = capacity - prediction.predictedAvailable;
      prediction.calibrationApplied = true;

      // Update status
      if (adjustedRate > 0.9) prediction.status = 'full';
      else if (adjustedRate > 0.7) prediction.status = 'limited';
      else prediction.status = 'available';
    }

    return prediction;
  }

  /**
   * Gather prediction accuracy data for the AI to analyze
   */
  async _gatherAnalysisData() {
    const data = { predictionErrors: [], patterns: [], facilities: [] };

    try {
      // Get recent prediction accuracy records
      const accuracyRows = await this.db.db.prepare(`
        SELECT facility_id, predicted_available, actual_available,
               error_magnitude, percent_error, event_nearby, timestamp
        FROM parking_prediction_accuracy
        ORDER BY timestamp DESC
        LIMIT 200
      `).all();

      data.predictionErrors = accuracyRows.map(r => ({
        facility: r.facility_id,
        predicted: r.predicted_available,
        actual: r.actual_available,
        error: r.error_magnitude,
        pctError: r.percent_error,
        eventNearby: r.event_nearby,
        hour: new Date(r.timestamp).getHours(),
        day: new Date(r.timestamp).getDay(),
        ts: r.timestamp
      }));

      // Get occupancy patterns (aggregated)
      const patternRows = await this.db.db.prepare(`
        SELECT facility_id, day_of_week, hour_of_day, avg_occupancy_rate, sample_count
        FROM parking_occupancy_patterns
        WHERE sample_count >= 5
        ORDER BY facility_id, day_of_week, hour_of_day
      `).all();

      data.patterns = patternRows.map(r => ({
        facility: r.facility_id,
        day: r.day_of_week,
        hour: r.hour_of_day,
        avgRate: Math.round(r.avg_occupancy_rate * 100) / 100,
        samples: r.sample_count
      }));

      // Get facility info
      const facilityRows = await this.db.db.prepare(`
        SELECT facility_id, state, avg_capacity, total_samples
        FROM truck_parking_facilities
        LIMIT 100
      `).all();

      data.facilities = facilityRows.map(r => ({
        id: r.facility_id,
        state: r.state,
        capacity: r.avg_capacity,
        samples: r.total_samples
      }));

      // Get ground truth observations
      const groundTruthRows = await this.db.db.prepare(`
        SELECT facility_id, observed_count, observed_total_capacity,
               predicted_count, predicted_occupancy_rate, timestamp
        FROM parking_ground_truth_observations
        ORDER BY timestamp DESC
        LIMIT 50
      `).all();

      data.groundTruth = groundTruthRows.map(r => ({
        facility: r.facility_id,
        observed: r.observed_count,
        capacity: r.observed_total_capacity,
        predicted: r.predicted_count,
        predictedRate: r.predicted_occupancy_rate,
        ts: r.timestamp
      }));

    } catch (error) {
      console.error('Error gathering calibration data:', error.message);
    }

    return data;
  }

  /**
   * Compress analysis data to minimize tokens sent to OpenAI
   */
  _compressForPrompt(data) {
    const summary = {
      errorCount: data.predictionErrors.length,
      patternCount: data.patterns.length,
      facilityCount: data.facilities.length,
      groundTruthCount: (data.groundTruth || []).length
    };

    // If no prediction errors, not enough data to calibrate
    if (summary.errorCount === 0 && summary.groundTruthCount === 0) {
      return null;
    }

    // Aggregate errors by hour
    const errorsByHour = {};
    for (const e of data.predictionErrors) {
      if (!errorsByHour[e.hour]) errorsByHour[e.hour] = { count: 0, totalError: 0, avgPctError: 0 };
      errorsByHour[e.hour].count++;
      errorsByHour[e.hour].totalError += e.error;
    }
    for (const h in errorsByHour) {
      errorsByHour[h].avgError = Math.round(errorsByHour[h].totalError / errorsByHour[h].count * 10) / 10;
    }

    // Aggregate errors by day
    const errorsByDay = {};
    for (const e of data.predictionErrors) {
      if (!errorsByDay[e.day]) errorsByDay[e.day] = { count: 0, totalPct: 0 };
      errorsByDay[e.day].count++;
      errorsByDay[e.day].totalPct += Math.abs(e.pctError);
    }
    for (const d in errorsByDay) {
      errorsByDay[d].avgPctError = Math.round(errorsByDay[d].totalPct / errorsByDay[d].count);
    }

    // Over/under prediction bias
    let overPredictions = 0, underPredictions = 0;
    for (const e of data.predictionErrors) {
      if (e.predicted > e.actual) overPredictions++;
      else if (e.predicted < e.actual) underPredictions++;
    }

    // Event correlation
    const withEvents = data.predictionErrors.filter(e => e.eventNearby);
    const withoutEvents = data.predictionErrors.filter(e => !e.eventNearby);
    const avgErrorWithEvents = withEvents.length > 0
      ? Math.round(withEvents.reduce((s, e) => s + Math.abs(e.pctError), 0) / withEvents.length)
      : null;
    const avgErrorWithoutEvents = withoutEvents.length > 0
      ? Math.round(withoutEvents.reduce((s, e) => s + Math.abs(e.pctError), 0) / withoutEvents.length)
      : null;

    // States with data
    const stateErrors = {};
    for (const e of data.predictionErrors) {
      const f = data.facilities.find(fac => fac.id === e.facility);
      const state = f?.state || 'unknown';
      if (!stateErrors[state]) stateErrors[state] = { count: 0, totalPct: 0 };
      stateErrors[state].count++;
      stateErrors[state].totalPct += Math.abs(e.pctError);
    }
    for (const s in stateErrors) {
      stateErrors[s].avgPctError = Math.round(stateErrors[s].totalPct / stateErrors[s].count);
    }

    return {
      summary,
      errorsByHour,
      errorsByDay,
      bias: { over: overPredictions, under: underPredictions },
      eventCorrelation: { avgErrorWithEvents, avgErrorWithoutEvents },
      stateErrors,
      groundTruthSample: (data.groundTruth || []).slice(0, 10)
    };
  }

  /**
   * Run the AI calibration. Call this daily (or on-demand via API).
   */
  async runCalibration() {
    console.log('🤖 Starting parking prediction AI calibration...');

    const data = await this._gatherAnalysisData();
    const compressed = this._compressForPrompt(data);

    if (!compressed) {
      console.log('⏭️  Skipping calibration — not enough prediction accuracy data yet');
      return { success: false, reason: 'insufficient_data' };
    }

    // Build the prompt — kept minimal to save tokens
    const prompt = `You are a truck parking prediction calibration engine. Analyze these prediction errors and output JSON calibration weights.

DATA:
${JSON.stringify(compressed, null, 0)}

Current weights:
${JSON.stringify({
  timeOfDay: this.calibration.timeOfDayMultipliers,
  dayOfWeek: this.calibration.dayOfWeekMultipliers,
  states: this.calibration.stateMultipliers,
  bias: this.calibration.biasCorrection,
  surgeMult: this.calibration.corridorDelaySurgeMultiplier
}, null, 0)}

TASK: Based on the error patterns, output updated calibration weights as JSON. Rules:
- timeOfDayMultipliers: object with keys 0-23, values 0.7-1.3 (1.0=no change)
- dayOfWeekMultipliers: object with keys 0-6 (0=Sun), values 0.8-1.2
- stateMultipliers: object with state codes, values 0.8-1.2 (omit states at 1.0)
- corridorDelaySurgeMultiplier: 0.5-2.0 (scales the delay surge effect)
- biasCorrection: -0.15 to 0.15 (added to occupancy rate; positive = predict fuller)
- notes: one sentence explaining the main adjustment

Output ONLY valid JSON, no markdown.`;

    try {
      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 800
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) throw new Error('Empty response from OpenAI');

      // Parse the JSON response
      const weights = JSON.parse(content);

      // Validate required fields
      if (!weights.timeOfDayMultipliers || !weights.dayOfWeekMultipliers) {
        throw new Error('Missing required calibration fields in AI response');
      }

      // Build new calibration
      const newCalibration = {
        version: (this.calibration.version || 0) + 1,
        generatedAt: new Date().toISOString(),
        timeOfDayMultipliers: weights.timeOfDayMultipliers,
        dayOfWeekMultipliers: weights.dayOfWeekMultipliers,
        stateMultipliers: weights.stateMultipliers || {},
        corridorDelaySurgeMultiplier: weights.corridorDelaySurgeMultiplier ?? 1.0,
        biasCorrection: weights.biasCorrection ?? 0,
        notes: weights.notes || 'AI-calibrated weights',
        tokenUsage: {
          prompt: response.usage?.prompt_tokens,
          completion: response.usage?.completion_tokens,
          total: response.usage?.total_tokens
        }
      };

      // Save calibration
      const dataDir = path.dirname(CALIBRATION_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

      fs.writeFileSync(CALIBRATION_FILE, JSON.stringify(newCalibration, null, 2));
      this.calibration = newCalibration;

      // Append to log
      const logEntry = {
        timestamp: newCalibration.generatedAt,
        version: newCalibration.version,
        tokens: newCalibration.tokenUsage?.total,
        notes: newCalibration.notes,
        dataPoints: compressed.summary.errorCount
      };

      let log = [];
      try {
        if (fs.existsSync(CALIBRATION_LOG)) {
          log = JSON.parse(fs.readFileSync(CALIBRATION_LOG, 'utf8'));
        }
      } catch (e) { /* start fresh */ }
      log.push(logEntry);
      // Keep last 90 entries
      if (log.length > 90) log = log.slice(-90);
      fs.writeFileSync(CALIBRATION_LOG, JSON.stringify(log, null, 2));

      console.log(`✅ Parking calibration v${newCalibration.version} saved (${newCalibration.tokenUsage?.total || '?'} tokens)`);
      console.log(`   ${newCalibration.notes}`);

      return {
        success: true,
        version: newCalibration.version,
        tokens: newCalibration.tokenUsage?.total,
        notes: newCalibration.notes
      };
    } catch (error) {
      console.error('❌ Parking calibration failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get calibration status and history
   */
  getStatus() {
    let log = [];
    try {
      if (fs.existsSync(CALIBRATION_LOG)) {
        log = JSON.parse(fs.readFileSync(CALIBRATION_LOG, 'utf8'));
      }
    } catch (e) { /* empty */ }

    const totalTokens = log.reduce((s, e) => s + (e.tokens || 0), 0);
    // GPT-4o-mini: $0.15/1M input, $0.60/1M output — roughly $0.30/1M blended
    const estimatedCost = (totalTokens / 1000000) * 0.30;

    return {
      currentVersion: this.calibration?.version || 0,
      lastCalibrated: this.calibration?.generatedAt || null,
      notes: this.calibration?.notes || null,
      calibrationCount: log.length,
      totalTokensUsed: totalTokens,
      estimatedCostUSD: Math.round(estimatedCost * 10000) / 10000,
      remainingBudget: Math.round((10 - estimatedCost) * 100) / 100,
      history: log.slice(-10)
    };
  }
}

// Need lazy getOpenAI reference from backend
let getOpenAI;
function setOpenAIGetter(getter) {
  getOpenAI = getter;
}

module.exports = { ParkingCalibrationService, setOpenAIGetter };
