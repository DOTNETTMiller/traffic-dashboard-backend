/**
 * Traffic Impact Analyzer
 * Analyzes traffic events to identify potential interstate backups and generate warnings
 */

class TrafficImpactAnalyzer {
  constructor() {
    // Peak hours: weekday 6-9am and 4-7pm
    this.peakHours = {
      morning: { start: 6, end: 9 },
      evening: { start: 16, end: 19 }
    };
  }

  /**
   * Determine if current time is during peak hours
   */
  isPeakHours(date = new Date()) {
    const hour = date.getHours();
    const day = date.getDay();
    const isWeekday = day >= 1 && day <= 5;

    if (!isWeekday) return false;

    return (
      (hour >= this.peakHours.morning.start && hour < this.peakHours.morning.end) ||
      (hour >= this.peakHours.evening.start && hour < this.peakHours.evening.end)
    );
  }

  /**
   * Calculate impact score for an event (0-100)
   * Higher score = higher likelihood of causing backup
   */
  calculateImpactScore(event) {
    let score = 0;

    // Base score by event type
    const eventTypeScores = {
      'Incident': 40,
      'Accident': 45,
      'Crash': 45,
      'Road Closure': 50,
      'Construction': 30,
      'Weather': 25,
      'Congestion': 35,
      'Stalled Vehicle': 20,
      'Debris': 15
    };

    score += eventTypeScores[event.eventType] || 20;

    // Severity multiplier
    if (event.severity === 'high') {
      score += 30;
    } else if (event.severity === 'medium') {
      score += 15;
    } else {
      score += 5;
    }

    // Lanes affected
    const lanesText = (event.lanesAffected || event.description || '').toLowerCase();
    if (lanesText.includes('all lanes') || lanesText.includes('road closed')) {
      score += 40;
    } else if (lanesText.includes('multiple lanes') || /\d+\s*lanes/.test(lanesText)) {
      score += 25;
    } else if (lanesText.includes('lane') || lanesText.includes('shoulder')) {
      score += 10;
    }

    // Peak hours
    if (this.isPeakHours()) {
      score += 20;
    }

    // Major interstate corridors get higher scores
    if (event.corridor && event.corridor.match(/I-(80|35|70|95|5|10)/)) {
      score += 10;
    }

    // Cap at 100
    return Math.min(score, 100);
  }

  /**
   * Determine warning level based on impact score
   */
  getWarningLevel(score) {
    if (score >= 70) return 'severe';
    if (score >= 50) return 'high';
    if (score >= 30) return 'moderate';
    return 'low';
  }

  /**
   * Generate a human-readable warning message
   */
  generateWarningMessage(event, warningLevel) {
    const corridor = event.corridor || 'this corridor';
    const location = event.location || event.county || 'unknown location';
    const eventType = event.eventType || 'traffic event';

    let message = '';
    let recommendation = '';

    switch (warningLevel) {
      case 'severe':
        message = `⛔ SEVERE TRAFFIC IMPACT on ${corridor}`;
        recommendation = 'Alternate routes STRONGLY recommended. Major delays expected.';
        break;
      case 'high':
        message = `⚠️ HIGH TRAFFIC IMPACT on ${corridor}`;
        recommendation = 'Alternate routes recommended. Significant delays likely.';
        break;
      case 'moderate':
        message = `⚡ MODERATE TRAFFIC IMPACT on ${corridor}`;
        recommendation = 'Consider alternate routes if possible. Some delays expected.';
        break;
      default:
        message = `ℹ️ Minor traffic impact on ${corridor}`;
        recommendation = 'Monitor conditions. Minor delays possible.';
    }

    const details = `${eventType} at ${location}`;
    const lanesInfo = event.lanesAffected ? ` - ${event.lanesAffected}` : '';

    return {
      title: message,
      details: details + lanesInfo,
      recommendation,
      level: warningLevel
    };
  }

  /**
   * Analyze a single event and generate warning if needed
   */
  analyzeEvent(event) {
    const score = this.calculateImpactScore(event);
    const warningLevel = this.getWarningLevel(score);

    // Only generate warnings for moderate or higher impact
    if (score < 30) {
      return null;
    }

    const warning = this.generateWarningMessage(event, warningLevel);

    return {
      eventId: event.id,
      corridor: event.corridor,
      state: event.state,
      impactScore: score,
      warningLevel,
      ...warning,
      event: {
        id: event.id,
        eventType: event.eventType,
        location: event.location,
        description: event.description,
        severity: event.severity,
        latitude: event.latitude,
        longitude: event.longitude,
        startTime: event.startTime,
        endTime: event.endTime
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Analyze all events and generate warnings
   */
  analyzeAllEvents(events) {
    const warnings = [];

    for (const event of events) {
      const warning = this.analyzeEvent(event);
      if (warning) {
        warnings.push(warning);
      }
    }

    // Sort by impact score (highest first)
    warnings.sort((a, b) => b.impactScore - a.impactScore);

    return warnings;
  }

  /**
   * Get warnings for a specific corridor
   */
  getCorridorWarnings(events, corridorName) {
    const allWarnings = this.analyzeAllEvents(events);

    if (!corridorName) {
      return this.deduplicateWarnings(allWarnings);
    }

    // Normalize corridor name for matching
    const normalizedCorridor = corridorName.toLowerCase().replace(/\s+/g, '');

    const filteredWarnings = allWarnings.filter(warning => {
      if (!warning.corridor) return false;
      const eventCorridor = warning.corridor.toLowerCase().replace(/\s+/g, '');
      return eventCorridor.includes(normalizedCorridor) || normalizedCorridor.includes(eventCorridor);
    });

    return this.deduplicateWarnings(filteredWarnings);
  }

  /**
   * Deduplicate warnings with similar characteristics
   * Groups warnings by corridor + event type + warning level
   */
  deduplicateWarnings(warnings) {
    const grouped = new Map();

    for (const warning of warnings) {
      // Create a key based on corridor, event type, and warning level
      const key = `${warning.corridor}|${warning.event.eventType}|${warning.warningLevel}`;

      if (!grouped.has(key)) {
        // First warning in this group - keep it as representative
        grouped.set(key, {
          ...warning,
          eventCount: 1,
          eventIds: [warning.eventId],
          events: [warning.event]
        });
      } else {
        // Add to existing group
        const existing = grouped.get(key);
        existing.eventCount++;
        existing.eventIds.push(warning.eventId);
        existing.events.push(warning.event);

        // Update impact score to reflect the aggregate (use highest score)
        existing.impactScore = Math.max(existing.impactScore, warning.impactScore);

        // Update details to show it's multiple events
        if (existing.eventCount === 2) {
          // First duplicate - update message
          existing.details = `${existing.eventCount} ${existing.event.eventType} events affecting ${existing.corridor}`;
        } else {
          // Additional duplicates
          existing.details = `${existing.eventCount} ${existing.event.eventType} events affecting ${existing.corridor}`;
        }
      }
    }

    // Convert back to array and sort by impact score
    return Array.from(grouped.values()).sort((a, b) => b.impactScore - a.impactScore);
  }

  /**
   * Get statistics about warnings
   */
  getWarningStatistics(warnings) {
    const stats = {
      total: warnings.length,
      severe: warnings.filter(w => w.warningLevel === 'severe').length,
      high: warnings.filter(w => w.warningLevel === 'high').length,
      moderate: warnings.filter(w => w.warningLevel === 'moderate').length,
      low: warnings.filter(w => w.warningLevel === 'low').length,
      corridors: [...new Set(warnings.map(w => w.corridor))].length,
      states: [...new Set(warnings.map(w => w.state))].length
    };

    return stats;
  }
}

module.exports = TrafficImpactAnalyzer;
