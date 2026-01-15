const axios = require('axios');

/**
 * Grants.gov API Service
 * Fetches federal funding opportunities for transportation research and deployment
 */

// Transportation-focused keywords (NOT SDVOB contractor opportunities)
const TRANSPORTATION_KEYWORDS = [
  'connected corridors',
  'work zone data exchange',
  'WZDx',
  'intelligent transportation systems',
  'ITS deployment',
  'connected vehicles',
  'connected automated vehicles',
  'CAV',
  'smart mobility',
  'transportation data',
  'multi-state coordination',
  'ATCMTD',
  'SMART grant',
  'RAISE',
  'INFRA',
  'surface transportation',
  'highway safety',
  'traffic management'
];

// Research-focused keywords for academic institutions
const RESEARCH_KEYWORDS = [
  'transportation research',
  'connected vehicle research',
  'ITS research',
  'smart cities',
  'university transportation center',
  'UTC',
  'transportation innovation',
  'mobility research'
];

// Priority grant programs
const PRIORITY_PROGRAMS = [
  'SMART',
  'RAISE',
  'INFRA',
  'ATCMTD',
  'BUILD',
  'TIGER',
  'Safe Streets',
  'Reconnecting Communities'
];

class GrantsService {
  constructor() {
    this.baseUrl = 'https://api.grants.gov/v1/api/search2';
    this.cache = new Map();
    this.cacheExpiry = 6 * 60 * 60 * 1000; // 6 hours
  }

  /**
   * Search for transportation funding opportunities
   */
  async searchOpportunities(options = {}) {
    const {
      keyword = 'transportation',
      maxResults = 50,
      stateFilter = null,
      includeResearch = true
    } = options;

    const cacheKey = `${keyword}-${stateFilter}-${includeResearch}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log('📦 Returning cached grant opportunities');
        return cached.data;
      }
    }

    try {
      console.log(`🔍 Searching Grants.gov for: ${keyword}`);

      const response = await axios.post(this.baseUrl, {
        keyword,
        oppStatuses: 'forecasted|posted',
        sortBy: 'openDate|desc',
        rows: maxResults
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      let opportunities = [];

      // Handle new API response format (nested under data)
      const oppHits = response.data?.data?.oppHits || response.data?.oppHits || [];

      if (oppHits.length > 0) {
        opportunities = oppHits.map(opp => ({
          id: opp.number,
          title: opp.title,
          agency: opp.agency || opp.agencyName,
          category: opp.categoryExplanation || opp.category,
          description: opp.description || opp.synopsis || '',
          openDate: opp.openDate,
          closeDate: opp.closeDate,
          awardCeiling: opp.awardCeiling,
          awardFloor: opp.awardFloor,
          estimatedFunding: opp.estimatedFunding,
          eligibility: opp.applicantEligibilityDesc || opp.eligibility,
          cfda: opp.cfdaList || [],
          url: `https://www.grants.gov/web/grants/view-opportunity.html?oppId=${opp.id}`,
          rawData: opp
        }));
      }

      // Filter and score opportunities
      const scored = this.scoreOpportunities(opportunities, stateFilter, includeResearch);

      // Cache results
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: scored
      });

      console.log(`✅ Found ${scored.length} relevant opportunities`);
      return scored;

    } catch (error) {
      console.error('❌ Error fetching grants:', error.message);
      return [];
    }
  }

  /**
   * Score and filter opportunities based on relevance
   */
  scoreOpportunities(opportunities, stateFilter = null, includeResearch = true) {
    return opportunities
      .map(opp => {
        let score = 0;
        let matchReasons = [];
        const text = `${opp.title} ${opp.description} ${opp.category}`.toLowerCase();

        // Priority program bonus (+30 points)
        for (const program of PRIORITY_PROGRAMS) {
          if (text.includes(program.toLowerCase())) {
            score += 30;
            matchReasons.push(`Priority program: ${program}`);
            break;
          }
        }

        // Transportation keywords (+10 points each, max 50)
        let transportMatches = 0;
        for (const keyword of TRANSPORTATION_KEYWORDS) {
          if (text.includes(keyword.toLowerCase())) {
            transportMatches++;
            if (transportMatches <= 5) {
              score += 10;
              if (matchReasons.length < 3) {
                matchReasons.push(`Matches: ${keyword}`);
              }
            }
          }
        }

        // Research keywords (+5 points each, max 25) - only if includeResearch is true
        if (includeResearch) {
          let researchMatches = 0;
          for (const keyword of RESEARCH_KEYWORDS) {
            if (text.includes(keyword.toLowerCase())) {
              researchMatches++;
              if (researchMatches <= 5) {
                score += 5;
                if (matchReasons.length < 3) {
                  matchReasons.push(`Research focus: ${keyword}`);
                }
              }
            }
          }
        }

        // State-specific bonus (+15 points)
        if (stateFilter && text.includes(stateFilter.toLowerCase())) {
          score += 15;
          matchReasons.push(`State-specific: ${stateFilter}`);
        }

        // Multi-state coordination bonus (+10 points)
        if (text.includes('multi-state') || text.includes('regional') || text.includes('corridor')) {
          score += 10;
          matchReasons.push('Multi-state coordination');
        }

        // Data/technology focus bonus (+10 points)
        if (text.includes('data') && (text.includes('exchange') || text.includes('sharing') || text.includes('integration'))) {
          score += 10;
          matchReasons.push('Data exchange focus');
        }

        // ITS/Connected vehicle bonus (+10 points)
        if (text.includes('its ') || text.includes('connected vehicle') || text.includes('intelligent transportation')) {
          score += 10;
          matchReasons.push('ITS/Connected vehicle focus');
        }

        // Calculate relevance category
        let relevance = 'low';
        let priority = 'low';
        if (score >= 60) {
          relevance = 'very_high';
          priority = 'urgent';
        } else if (score >= 40) {
          relevance = 'high';
          priority = 'high';
        } else if (score >= 25) {
          relevance = 'medium';
          priority = 'medium';
        }

        return {
          ...opp,
          relevanceScore: score,
          relevance,
          priority,
          matchReasons: matchReasons.slice(0, 3),
          platformAlignment: this.calculatePlatformAlignment(opp)
        };
      })
      .filter(opp => opp.relevanceScore >= 25) // Only return medium+ relevance
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calculate how well the grant aligns with Corridor Communicator capabilities
   */
  calculatePlatformAlignment(opp) {
    const text = `${opp.title} ${opp.description}`.toLowerCase();
    let alignment = 0;
    const capabilities = [];

    // Data integration capability
    if (text.includes('data') && (text.includes('integration') || text.includes('exchange') || text.includes('sharing'))) {
      alignment += 25;
      capabilities.push('Real-time data integration (46 states)');
    }

    // WZDx compliance
    if (text.includes('work zone') || text.includes('wzdx') || text.includes('data exchange')) {
      alignment += 25;
      capabilities.push('WZDx v4.2 compliance');
    }

    // ITS infrastructure
    if (text.includes('its ') || text.includes('equipment') || text.includes('infrastructure')) {
      alignment += 20;
      capabilities.push('ITS equipment inventory system');
    }

    // Multi-state coordination
    if (text.includes('multi-state') || text.includes('corridor') || text.includes('regional')) {
      alignment += 20;
      capabilities.push('Multi-state corridor coordination');
    }

    // Connected vehicle readiness
    if (text.includes('connected vehicle') || text.includes('cav') || text.includes('v2x')) {
      alignment += 15;
      capabilities.push('V2X/Connected vehicle preparation');
    }

    return {
      score: Math.min(alignment, 100),
      level: alignment >= 75 ? 'excellent' : alignment >= 50 ? 'good' : alignment >= 25 ? 'fair' : 'limited',
      capabilities: capabilities.slice(0, 3)
    };
  }

  /**
   * Get comprehensive funding opportunities for all CCAI states
   */
  async getCCAIOpportunities() {
    const ccaiStates = ['Iowa', 'Kansas', 'Minnesota', 'Missouri', 'Nebraska', 'Nevada', 'Oklahoma', 'Pennsylvania', 'Texas'];

    // Search multiple keywords to get broad coverage
    const searches = [
      this.searchOpportunities({ keyword: 'connected corridors', maxResults: 25 }),
      this.searchOpportunities({ keyword: 'intelligent transportation', maxResults: 25 }),
      this.searchOpportunities({ keyword: 'transportation data', maxResults: 25 }),
      this.searchOpportunities({ keyword: 'highway safety', maxResults: 25 })
    ];

    const results = await Promise.all(searches);

    // Deduplicate by grant ID
    const seen = new Set();
    const allOpportunities = [];

    for (const resultSet of results) {
      for (const opp of resultSet) {
        if (!seen.has(opp.id)) {
          seen.add(opp.id);
          allOpportunities.push(opp);
        }
      }
    }

    return allOpportunities.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Generate grant evidence from platform statistics
   */
  generateGrantEvidence(stats) {
    const evidence = {
      dataQuality: [],
      multiStateCoordination: [],
      technicalReadiness: [],
      impactMetrics: []
    };

    // Data quality evidence
    if (stats.totalStates) {
      evidence.dataQuality.push(`${stats.totalStates} states integrated with real-time data feeds`);
    }
    if (stats.totalEvents) {
      evidence.dataQuality.push(`${stats.totalEvents.toLocaleString()}+ events tracked simultaneously`);
    }
    if (stats.wzdxCompliance) {
      evidence.dataQuality.push(`${stats.wzdxCompliance}% average WZDx compliance rate`);
    }
    if (stats.itsAssets) {
      evidence.dataQuality.push(`${stats.itsAssets.toLocaleString()} ITS assets inventoried`);
    }

    // Multi-state coordination evidence
    if (stats.corridors) {
      for (const corridor of stats.corridors) {
        evidence.multiStateCoordination.push(
          `${corridor.name}: ${corridor.states} states, ${corridor.miles.toLocaleString()} miles`
        );
      }
    }

    // Technical readiness
    evidence.technicalReadiness.push('24/7 uptime with 5-15 minute data refresh intervals');
    evidence.technicalReadiness.push('WZDx v4.2 standardized data dictionary');
    evidence.technicalReadiness.push('Open architecture with public APIs');

    // Impact metrics
    if (stats.pooledFundParticipants) {
      evidence.impactMetrics.push(`${stats.pooledFundParticipants} states in active pooled fund (TPF-5(536))`);
    }
    evidence.impactMetrics.push('Production platform serving multiple state DOTs');

    return evidence;
  }
}

module.exports = new GrantsService();
