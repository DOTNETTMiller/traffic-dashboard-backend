/**
 * ML Integrations Module
 * Integrates all 10 patent-worthy ML/AI features into the backend
 */

const MLClient = require('./utils/ml-client');
const ProvenanceChain = require('./utils/cryptographic-provenance');
const SpatialCompressor = require('./utils/spatial-compression');

// Initialize services
const mlClient = new MLClient();
const provenanceChain = new ProvenanceChain();
const spatialCompressor = new SpatialCompressor();

// Cache for recent events (for anomaly detection context)
const recentEventsCache = [];
const MAX_CACHE_SIZE = 1000;

/**
 * Setup all ML-related API endpoints
 */
function setupMLEndpoints(app, db, requireAdmin, requireUser) {

    // ========== FEATURE #1: ML Data Quality Assessment ==========

    app.post('/api/ml/assess-quality', requireUser, async (req, res) => {
        try {
            const { events, training_mode, labels } = req.body;

            if (!events || !Array.isArray(events)) {
                return res.status(400).json({
                    success: false,
                    error: 'Events array required'
                });
            }

            const result = await mlClient.assessDataQuality(events, {
                training_mode,
                labels
            });

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('ML quality assessment error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ========== FEATURE #2: Cross-State Event Correlation ==========

    app.post('/api/ml/correlations', requireUser, async (req, res) => {
        try {
            const { events, predict_downstream } = req.body;

            if (!events || !Array.isArray(events)) {
                return res.status(400).json({
                    success: false,
                    error: 'Events array required'
                });
            }

            const result = await mlClient.analyzeCorrelations(events, {
                predict_downstream
            });

            // Record provenance for correlations
            if (result.correlations && result.correlations.length > 0) {
                provenanceChain.recordTransformation(
                    { events },
                    result,
                    'cross_state_correlation_analysis'
                );
            }

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('ML correlation error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ========== FEATURE #3: Automatic Schema Learning ==========

    app.post('/api/ml/learn-schema', requireAdmin, async (req, res) => {
        try {
            const { sample_data, existing_mappings } = req.body;

            if (!sample_data || !Array.isArray(sample_data)) {
                return res.status(400).json({
                    success: false,
                    error: 'Sample data array required'
                });
            }

            const result = await mlClient.learnSchema(sample_data, existing_mappings);

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('Schema learning error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ========== FEATURE #4: Cryptographic Provenance Chain ==========

    app.get('/api/provenance/:eventId', requireUser, async (req, res) => {
        try {
            const { eventId } = req.params;
            const provenance = provenanceChain.getEventProvenance(eventId);

            res.json({
                success: true,
                ...provenance
            });

        } catch (error) {
            console.error('Provenance query error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    app.get('/api/provenance/verify/chain', requireAdmin, async (req, res) => {
        try {
            const verification = provenanceChain.verifyChain();

            res.json({
                success: true,
                ...verification
            });

        } catch (error) {
            console.error('Provenance verification error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    app.get('/api/provenance/export/:eventId', requireUser, async (req, res) => {
        try {
            const { eventId } = req.params;
            const proof = provenanceChain.exportProof(eventId);

            res.json({
                success: true,
                ...proof
            });

        } catch (error) {
            console.error('Provenance export error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    app.get('/api/provenance/stats', requireAdmin, async (req, res) => {
        try {
            const stats = provenanceChain.getStatistics();

            res.json({
                success: true,
                ...stats
            });

        } catch (error) {
            console.error('Provenance stats error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ========== FEATURE #5: Anomaly Detection with Self-Healing ==========

    app.post('/api/ml/detect-anomaly', requireUser, async (req, res) => {
        try {
            const { event } = req.body;

            if (!event) {
                return res.status(400).json({
                    success: false,
                    error: 'Event required'
                });
            }

            const result = await mlClient.detectAnomalies(event, recentEventsCache);

            // If anomaly detected with fallback, record in provenance
            if (result.is_anomaly && result.fallback) {
                provenanceChain.recordTransformation(
                    event,
                    result.fallback,
                    'anomaly_self_healing'
                );
            }

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('Anomaly detection error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // OPTIMIZED: Batch anomaly detection endpoint for performance
    app.post('/api/ml/detect-anomalies-batch', requireUser, async (req, res) => {
        try {
            const { events } = req.body;

            if (!events || !Array.isArray(events)) {
                return res.status(400).json({
                    success: false,
                    error: 'Events array required'
                });
            }

            // Process all events in parallel instead of sequentially
            const results = await Promise.all(
                events.map(async (event) => {
                    try {
                        const result = await mlClient.detectAnomalies(event, recentEventsCache);

                        // If anomaly detected with fallback, record in provenance
                        if (result.is_anomaly && result.fallback) {
                            provenanceChain.recordTransformation(
                                event,
                                result.fallback,
                                'anomaly_self_healing'
                            );
                        }

                        return {
                            event_id: event.id,
                            ...result
                        };
                    } catch (error) {
                        console.error(`Anomaly detection failed for event ${event.id}:`, error);
                        return {
                            event_id: event.id,
                            is_anomaly: false,
                            error: error.message
                        };
                    }
                })
            );

            res.json({
                success: true,
                results: results,
                total_checked: events.length,
                anomalies_found: results.filter(r => r.is_anomaly).length
            });

        } catch (error) {
            console.error('Batch anomaly detection error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ========== FEATURE #6: Multi-Objective Route Optimization ==========

    app.post('/api/ml/optimize-route', requireUser, async (req, res) => {
        try {
            const { origin, destination, vehicle_constraints, current_events } = req.body;

            if (!origin || !destination) {
                return res.status(400).json({
                    success: false,
                    error: 'Origin and destination required'
                });
            }

            const result = await mlClient.optimizeRoute(
                origin,
                destination,
                vehicle_constraints || {},
                current_events || []
            );

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('Route optimization error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ========== FEATURE #7: Federated Learning ==========

    app.post('/api/ml/federated/init', requireAdmin, async (req, res) => {
        try {
            const { model_name, states } = req.body;

            if (!model_name || !states) {
                return res.status(400).json({
                    success: false,
                    error: 'model_name and states required'
                });
            }

            const result = await mlClient.initFederatedTraining(model_name, states);

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('Federated learning init error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ========== FEATURE #8: NLP Event Extraction ==========

    app.post('/api/ml/extract-from-text', requireUser, async (req, res) => {
        try {
            const { text_sources } = req.body;

            if (!text_sources || !Array.isArray(text_sources)) {
                return res.status(400).json({
                    success: false,
                    error: 'text_sources array required'
                });
            }

            const result = await mlClient.extractEventsFromText(text_sources);

            // Record provenance for extracted events
            if (result.extracted_events) {
                for (const event of result.extracted_events) {
                    provenanceChain.recordIngestion(event, 'nlp_extraction');
                }
            }

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('NLP extraction error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ========== FEATURE #9: Spatial-Temporal Compression ==========

    app.post('/api/compress/spatial-temporal', requireUser, async (req, res) => {
        try {
            const { events, compression_level } = req.body;

            if (!events || !Array.isArray(events)) {
                return res.status(400).json({
                    success: false,
                    error: 'Events array required'
                });
            }

            // Set compression level
            if (compression_level) {
                spatialCompressor.compressionLevel = compression_level;
            }

            const result = spatialCompressor.compress(events);

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('Compression error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    app.post('/api/decompress/spatial-temporal', requireUser, async (req, res) => {
        try {
            const { compressed_events } = req.body;

            if (!compressed_events || !Array.isArray(compressed_events)) {
                return res.status(400).json({
                    success: false,
                    error: 'Compressed events array required'
                });
            }

            const decompressed = spatialCompressor.decompress(compressed_events);

            res.json({
                success: true,
                decompressed: decompressed,
                count: decompressed.length
            });

        } catch (error) {
            console.error('Decompression error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ========== FEATURE #10: Predictive Incident Detection ==========

    app.post('/api/ml/predict-incidents', requireUser, async (req, res) => {
        try {
            const { current_conditions, historical_events } = req.body;

            if (!current_conditions) {
                return res.status(400).json({
                    success: false,
                    error: 'current_conditions required'
                });
            }

            const result = await mlClient.predictIncidents(
                current_conditions,
                historical_events || []
            );

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('Incident prediction error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // ========== Health Check ==========

    app.get('/api/ml/health', async (req, res) => {
        try {
            const health = await mlClient.healthCheck();

            res.json({
                success: true,
                ml_service: health,
                provenance_chain: {
                    total_records: provenanceChain.chain.length,
                    valid: provenanceChain.verifyChain().valid
                },
                spatial_compression: {
                    available: true
                }
            });

        } catch (error) {
            console.error('ML health check error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    console.log('✅ ML integration endpoints configured');
}

/**
 * Middleware to automatically record provenance for incoming events
 */
function provenanceMiddleware(source) {
    return (req, res, next) => {
        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to capture response
        res.json = function(data) {
            // Record provenance for successful event ingestion
            if (data && data.events && Array.isArray(data.events)) {
                for (const event of data.events) {
                    if (event.id) {
                        provenanceChain.recordIngestion(event, source);
                    }
                }
            }

            // Call original json method
            return originalJson(data);
        };

        next();
    };
}

/**
 * Middleware to cache events for anomaly detection
 */
function eventCacheMiddleware(req, res, next) {
    const originalJson = res.json.bind(res);

    res.json = function(data) {
        // Cache events for anomaly detection context
        if (data && data.events && Array.isArray(data.events)) {
            for (const event of data.events) {
                recentEventsCache.push(event);
            }

            // Keep cache size limited
            while (recentEventsCache.length > MAX_CACHE_SIZE) {
                recentEventsCache.shift();
            }
        }

        return originalJson(data);
    };

    next();
}

/**
 * Initialize ML services
 */
async function initializeMLServices() {
    console.log('\n🤖 Initializing ML Services...');

    try {
        const health = await mlClient.healthCheck();

        if (health.healthy) {
            console.log('   ✅ ML Service: Connected');
            console.log(`   📊 Models loaded: ${JSON.stringify(health.models)}`);
        } else {
            console.log('   ⚠️  ML Service: Offline (using fallback methods)');
        }
    } catch (error) {
        console.log('   ⚠️  ML Service: Not available (using fallback methods)');
    }

    console.log('   ✅ Provenance Chain: Initialized');
    console.log(`   📝 Chain length: ${provenanceChain.chain.length} records`);

    console.log('   ✅ Spatial Compression: Ready');

    console.log('');
}

module.exports = {
    setupMLEndpoints,
    provenanceMiddleware,
    eventCacheMiddleware,
    initializeMLServices,
    mlClient,
    provenanceChain,
    spatialCompressor
};
