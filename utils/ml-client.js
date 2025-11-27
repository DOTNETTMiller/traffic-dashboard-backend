/**
 * ML Service Client
 * Bridge between Node.js backend and Python ML microservice
 */

const axios = require('axios');

class MLClient {
    constructor() {
        this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
        this.timeout = 30000; // 30 seconds
        this.retries = 3;
    }

    /**
     * Feature #1: Assess data quality using ML
     */
    async assessDataQuality(events, options = {}) {
        try {
            const response = await this._request('POST', '/api/ml/data-quality/assess', {
                events: events,
                training_mode: options.training_mode || false,
                labels: options.labels
            });

            return response.data;
        } catch (error) {
            console.error('ML data quality assessment failed:', error.message);
            // Fallback to rule-based if ML service unavailable
            return this._fallbackQualityAssessment(events);
        }
    }

    /**
     * Feature #2: Analyze cross-state event correlations
     */
    async analyzeCorrelations(events, options = {}) {
        try {
            const response = await this._request('POST', '/api/ml/correlation/analyze', {
                events: events,
                predict_downstream: options.predict_downstream !== false
            });

            return response.data;
        } catch (error) {
            console.error('ML correlation analysis failed:', error.message);
            return {
                success: false,
                correlations: [],
                predictions: [],
                error: error.message
            };
        }
    }

    /**
     * Feature #3: Learn schema from new data source
     */
    async learnSchema(sampleData, existingMappings = {}) {
        try {
            const response = await this._request('POST', '/api/ml/schema/learn', {
                sample_data: sampleData,
                existing_mappings: existingMappings
            });

            return response.data;
        } catch (error) {
            console.error('ML schema learning failed:', error.message);
            return {
                success: false,
                mappings: {},
                error: error.message
            };
        }
    }

    /**
     * Feature #5: Detect anomalies in real-time
     */
    async detectAnomalies(currentEvent, recentEvents) {
        try {
            const response = await this._request('POST', '/api/ml/anomaly/detect', {
                current_event: currentEvent,
                events: recentEvents
            });

            return response.data;
        } catch (error) {
            console.error('ML anomaly detection failed:', error.message);
            return {
                success: false,
                is_anomaly: false,
                anomaly_score: 0,
                error: error.message
            };
        }
    }

    /**
     * Feature #6: Optimize route for commercial vehicle
     */
    async optimizeRoute(origin, destination, vehicleConstraints, currentEvents) {
        try {
            const response = await this._request('POST', '/api/ml/route/optimize', {
                origin: origin,
                destination: destination,
                vehicle_constraints: vehicleConstraints,
                current_events: currentEvents
            });

            return response.data;
        } catch (error) {
            console.error('ML route optimization failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Feature #7: Initialize federated learning round
     */
    async initFederatedTraining(modelName, states) {
        try {
            const response = await this._request('POST', '/api/ml/federated/init-training', {
                model_name: modelName,
                states: states
            });

            return response.data;
        } catch (error) {
            console.error('Federated learning init failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Feature #8: Extract events from unstructured text
     */
    async extractEventsFromText(textSources) {
        try {
            const response = await this._request('POST', '/api/ml/nlp/extract', {
                text_sources: textSources
            });

            return response.data;
        } catch (error) {
            console.error('NLP extraction failed:', error.message);
            return {
                success: false,
                extracted_events: [],
                error: error.message
            };
        }
    }

    /**
     * Feature #10: Predict future incidents
     */
    async predictIncidents(currentConditions, historicalEvents) {
        try {
            const response = await this._request('POST', '/api/ml/predict/incidents', {
                current_conditions: currentConditions,
                historical_events: historicalEvents
            });

            return response.data;
        } catch (error) {
            console.error('Incident prediction failed:', error.message);
            return {
                success: false,
                predictions: [],
                error: error.message
            };
        }
    }

    /**
     * Check ML service health
     */
    async healthCheck() {
        try {
            const response = await this._request('GET', '/health', null, { timeout: 5000 });
            return {
                healthy: response.data.status === 'healthy',
                models: response.data.models_loaded,
                timestamp: response.data.timestamp
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }

    /**
     * Make HTTP request to ML service with retry logic
     */
    async _request(method, endpoint, data = null, options = {}) {
        const config = {
            method: method,
            url: `${this.mlServiceUrl}${endpoint}`,
            timeout: options.timeout || this.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            config.data = data;
        }

        let lastError;

        for (let attempt = 0; attempt < this.retries; attempt++) {
            try {
                const response = await axios(config);
                return response;
            } catch (error) {
                lastError = error;

                if (attempt < this.retries - 1) {
                    // Exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    /**
     * Fallback quality assessment when ML service unavailable
     */
    _fallbackQualityAssessment(events) {
        const scores = events.map(event => {
            let score = 0.5;

            // Basic completeness check
            if (event.id && event.state && event.event_type && event.latitude && event.longitude) {
                score += 0.3;
            }

            // Timestamp freshness
            if (event.timestamp) {
                const age = Date.now() - new Date(event.timestamp).getTime();
                if (age < 3600000) score += 0.2; // < 1 hour
            }

            return Math.min(score, 1.0);
        });

        return {
            success: true,
            scores: scores,
            model_version: 'fallback_rule_based',
            fallback: true
        };
    }
}

module.exports = MLClient;
