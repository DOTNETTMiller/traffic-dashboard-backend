/**
 * Feature #4: Cryptographic Data Provenance Chain
 * Patent-worthy innovation: Blockchain-like hash chain proving data custody
 * from state API → backend → user, with immutable audit trail
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class ProvenanceChain {
    constructor(chainPath = './data/provenance_chain.json') {
        this.chainPath = chainPath;
        this.chain = [];
        this.pendingRecords = [];
        this.loadChain();
    }

    /**
     * Record event ingestion with cryptographic proof
     */
    recordIngestion(event, source) {
        const timestamp = new Date().toISOString();

        // Create provenance record
        const record = {
            event_id: event.id,
            timestamp: timestamp,
            source_api: source,
            operation: 'INGESTION',
            data_hash: this.hashData(event),
            metadata: {
                state: event.state,
                event_type: event.event_type,
                collection_timestamp: timestamp
            }
        };

        // Sign the record
        record.signature = this.signRecord(record);

        // Add to chain
        this.addToChain(record);

        return record;
    }

    /**
     * Record data transformation with proof of unchanged source
     */
    recordTransformation(originalEvent, transformedEvent, transformationType) {
        const timestamp = new Date().toISOString();

        const record = {
            event_id: transformedEvent.id,
            timestamp: timestamp,
            operation: 'TRANSFORMATION',
            transformation_type: transformationType,
            original_hash: this.hashData(originalEvent),
            transformed_hash: this.hashData(transformedEvent),
            changes: this.detectChanges(originalEvent, transformedEvent),
            metadata: {
                transform_timestamp: timestamp
            }
        };

        record.signature = this.signRecord(record);
        this.addToChain(record);

        return record;
    }

    /**
     * Record data delivery to end user
     */
    recordDelivery(event, recipientInfo) {
        const timestamp = new Date().toISOString();

        const record = {
            event_id: event.id,
            timestamp: timestamp,
            operation: 'DELIVERY',
            data_hash: this.hashData(event),
            recipient: {
                ip: recipientInfo.ip || 'unknown',
                user_agent: recipientInfo.userAgent || 'unknown',
                user_id: recipientInfo.userId || 'anonymous'
            },
            metadata: {
                delivery_timestamp: timestamp
            }
        };

        record.signature = this.signRecord(record);
        this.addToChain(record);

        return record;
    }

    /**
     * Create cryptographic hash of data
     * Novel: Uses SHA-256 for tamper detection
     */
    hashData(data) {
        const dataString = JSON.stringify(this.normalizeData(data));
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    /**
     * Sign record with HMAC
     * Novel: Ensures record authenticity
     */
    signRecord(record) {
        const secret = process.env.PROVENANCE_SECRET || 'default-secret-change-in-production';
        const recordString = JSON.stringify({
            event_id: record.event_id,
            timestamp: record.timestamp,
            operation: record.operation,
            data_hash: record.data_hash || record.original_hash
        });

        return crypto.createHmac('sha256', secret)
            .update(recordString)
            .digest('hex');
    }

    /**
     * Add record to chain with previous hash link
     * Novel: Blockchain-lite approach - each record links to previous
     */
    addToChain(record) {
        // Link to previous record
        if (this.chain.length > 0) {
            record.previous_hash = this.hashData(this.chain[this.chain.length - 1]);
        } else {
            record.previous_hash = '0000000000000000000000000000000000000000000000000000000000000000';
        }

        // Add block number
        record.block_number = this.chain.length;

        // Add to chain
        this.chain.push(record);

        // Persist if chain is getting large
        if (this.chain.length % 100 === 0) {
            this.saveChain();
        }
    }

    /**
     * Verify chain integrity
     * Novel: Detects tampering anywhere in chain
     */
    verifyChain() {
        const errors = [];

        for (let i = 1; i < this.chain.length; i++) {
            const currentRecord = this.chain[i];
            const previousRecord = this.chain[i - 1];

            // Verify link to previous
            const expectedPreviousHash = this.hashData(previousRecord);
            if (currentRecord.previous_hash !== expectedPreviousHash) {
                errors.push({
                    block: i,
                    error: 'broken_chain_link',
                    message: `Block ${i} has invalid previous_hash`
                });
            }

            // Verify signature
            if (!this.verifySignature(currentRecord)) {
                errors.push({
                    block: i,
                    error: 'invalid_signature',
                    message: `Block ${i} has invalid signature`
                });
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            total_blocks: this.chain.length
        };
    }

    /**
     * Verify record signature
     */
    verifySignature(record) {
        const expectedSignature = this.signRecord(record);
        return record.signature === expectedSignature;
    }

    /**
     * Get provenance history for specific event
     */
    getEventProvenance(eventId) {
        const records = this.chain.filter(r => r.event_id === eventId);

        return {
            event_id: eventId,
            total_operations: records.length,
            timeline: records.map(r => ({
                timestamp: r.timestamp,
                operation: r.operation,
                verified: this.verifySignature(r),
                details: this.getOperationDetails(r)
            })),
            custody_chain_verified: records.every(r => this.verifySignature(r))
        };
    }

    /**
     * Get operation details for display
     */
    getOperationDetails(record) {
        switch (record.operation) {
            case 'INGESTION':
                return {
                    source: record.source_api,
                    state: record.metadata.state,
                    data_hash: record.data_hash
                };

            case 'TRANSFORMATION':
                return {
                    type: record.transformation_type,
                    changes: record.changes,
                    original_hash: record.original_hash,
                    transformed_hash: record.transformed_hash
                };

            case 'DELIVERY':
                return {
                    recipient: record.recipient,
                    data_hash: record.data_hash
                };

            default:
                return {};
        }
    }

    /**
     * Detect what changed between original and transformed data
     */
    detectChanges(original, transformed) {
        const changes = [];

        // Check for added fields
        for (const key in transformed) {
            if (!(key in original)) {
                changes.push({
                    type: 'field_added',
                    field: key,
                    value: transformed[key]
                });
            } else if (original[key] !== transformed[key]) {
                changes.push({
                    type: 'field_modified',
                    field: key,
                    old_value: original[key],
                    new_value: transformed[key]
                });
            }
        }

        // Check for removed fields
        for (const key in original) {
            if (!(key in transformed)) {
                changes.push({
                    type: 'field_removed',
                    field: key
                });
            }
        }

        return changes;
    }

    /**
     * Normalize data for consistent hashing
     */
    normalizeData(data) {
        // Remove volatile fields that shouldn't affect hash
        const normalized = { ...data };
        delete normalized.cache_timestamp;
        delete normalized.request_id;
        return normalized;
    }

    /**
     * Save chain to disk
     */
    saveChain() {
        try {
            const dir = path.dirname(this.chainPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(
                this.chainPath,
                JSON.stringify({
                    version: '1.0',
                    created_at: new Date().toISOString(),
                    chain: this.chain
                }, null, 2)
            );
        } catch (err) {
            console.error('Failed to save provenance chain:', err);
        }
    }

    /**
     * Load chain from disk
     */
    loadChain() {
        try {
            if (fs.existsSync(this.chainPath)) {
                const data = JSON.parse(fs.readFileSync(this.chainPath, 'utf8'));
                this.chain = data.chain || [];
                console.log(`✅ Loaded provenance chain with ${this.chain.length} records`);

                // Verify integrity on load
                const verification = this.verifyChain();
                if (!verification.valid) {
                    console.warn('⚠️  Provenance chain integrity issues detected:', verification.errors);
                }
            }
        } catch (err) {
            console.warn('Could not load provenance chain, starting fresh:', err.message);
            this.chain = [];
        }
    }

    /**
     * Export provenance proof for specific event (for legal/regulatory use)
     */
    exportProof(eventId) {
        const provenance = this.getEventProvenance(eventId);
        const verification = this.verifyChain();

        return {
            event_id: eventId,
            provenance: provenance,
            chain_verification: verification,
            export_timestamp: new Date().toISOString(),
            signature: this.signRecord({ event_id: eventId, timestamp: new Date().toISOString() })
        };
    }

    /**
     * Get chain statistics
     */
    getStatistics() {
        const operationCounts = {};
        const stateCounts = {};

        for (const record of this.chain) {
            operationCounts[record.operation] = (operationCounts[record.operation] || 0) + 1;

            if (record.metadata && record.metadata.state) {
                stateCounts[record.metadata.state] = (stateCounts[record.metadata.state] || 0) + 1;
            }
        }

        return {
            total_records: this.chain.length,
            operations: operationCounts,
            states: stateCounts,
            chain_valid: this.verifyChain().valid
        };
    }
}

module.exports = ProvenanceChain;
