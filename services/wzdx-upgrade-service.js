/**
 * WZDx Feed Upgrade Service
 *
 * Consumes upstream WZDx feeds (v3.1, v4.0, v4.1) and upgrades them to v4.2
 * Provides caching and fallback for reliability
 */

const axios = require('axios');

// State feed configurations
const UPSTREAM_FEEDS = {
  // CRITICAL - v3.1
  'NC': {
    state: 'North Carolina',
    url: 'https://us-datacloud.one.network/wzdx-north-carolina.json',
    version: '3.1',
    priority: 'critical'
  },

  // HIGH PRIORITY - v4.0
  'OK': {
    state: 'Oklahoma',
    url: 'https://oktraffic.org/api/Geojsons/workzones',
    version: '4.0',
    priority: 'high'
  },
  'UT': {
    state: 'Utah',
    url: 'https://udottraffic.utah.gov/wzdx/udot/v40/data',
    version: '4.0',
    priority: 'high'
  },
  'IA': {
    state: 'Iowa',
    url: 'https://iowa-atms.cloud-q-free.com/api/rest/dataprism/wzdx',
    version: '4.0',
    priority: 'high'
  },
  'MN': {
    state: 'Minnesota',
    url: 'https://mn.carsprogram.org/carsapi_v1/api/wzdx',
    version: '4.0',
    priority: 'high'
  },
  'VA': {
    state: 'Virginia',
    url: 'https://data.511-atis-ttrip-prod.iteriscloud.com/smarterRoads',
    version: '4.0',
    priority: 'high'
  },
  'KS': {
    state: 'Kansas',
    url: 'https://ks.carsprogram.org/carsapi_v1/api/wzdx',
    version: '4.0',
    priority: 'high'
  },

  // MEDIUM PRIORITY - v4.1
  'MD': {
    state: 'Maryland',
    url: 'https://filter.ritis.org/wzdx_v4.1/mdot.geojson',
    version: '4.1',
    priority: 'medium'
  },
  'WI': {
    state: 'Wisconsin',
    url: 'https://511wi.gov/api/wzdx',
    version: '4.1',
    priority: 'medium'
  },
  'NM': {
    state: 'New Mexico',
    url: 'https://ai.blyncsy.io/wzdx/nmdot/feed',
    version: '4.1',
    priority: 'medium'
  },
  'HI': {
    state: 'Hawaii',
    url: 'https://ai.blyncsy.io/wzdx/hidot/feed',
    version: '4.1',
    priority: 'medium'
  },
  'NY': {
    state: 'New York',
    url: 'https://511ny.org/api/wzdx',
    version: '4.1',
    priority: 'medium'
  },
  'MA': {
    state: 'Massachusetts',
    url: 'https://feed.massdot-swzm.com/massdot_wzdx_v4.1_work_zone_feed.geojson',
    version: '4.1',
    priority: 'medium'
  },
  'KY': {
    state: 'Kentucky',
    url: 'https://storage.googleapis.com/kytc-its-2020-openrecords/wzdx/wzdx.geojson',
    version: '4.1',
    priority: 'medium'
  },
  'NJ': {
    state: 'New Jersey',
    url: 'https://smartworkzones.njit.edu/nj/wzdx',
    version: '4.1',
    priority: 'medium'
  },
  'ID': {
    state: 'Idaho',
    url: 'https://511.idaho.gov/api/wzdx',
    version: '4.1',
    priority: 'medium'
  },
  'IN': {
    state: 'Indiana',
    url: 'https://in.carsprogram.org/carsapi_v1/api/wzdx',
    version: '4.1',
    priority: 'medium'
  },
  'LA': {
    state: 'Louisiana',
    url: 'https://wzdx.e-dot.com/la_dot_d_feed_wzdx_v4.1.geojson',
    version: '4.1',
    priority: 'medium'
  },
  'DE': {
    state: 'Delaware',
    url: 'https://wzdx.e-dot.com/del_dot_feed_wzdx_v4.1.geojson',
    version: '4.1',
    priority: 'medium'
  }
};

class WZDxUpgradeService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 300000; // 5 minutes
    this.axios = axios.create({
      timeout: 30000, // 30 second timeout for feed fetches
      headers: {
        'User-Agent': 'DOT-Corridor-Communicator-WZDx-Upgrader/1.0',
        'Accept': 'application/geo+json, application/json'
      }
    });
  }

  /**
   * Fetch upstream feed from state DOT
   */
  async fetchUpstreamFeed(stateCode) {
    const config = UPSTREAM_FEEDS[stateCode.toUpperCase()];
    if (!config) {
      throw new Error(`No upstream feed configured for state: ${stateCode}`);
    }

    console.log(`🔄 Fetching ${config.state} WZDx v${config.version} feed...`);

    try {
      const response = await this.axios.get(config.url);
      console.log(`✅ Fetched ${config.state} feed: ${response.data?.features?.length || 0} features`);
      return {
        feed: response.data,
        version: config.version,
        state: config.state,
        stateCode: stateCode.toUpperCase()
      };
    } catch (error) {
      console.error(`❌ Error fetching ${config.state} feed:`, error.message);
      throw error;
    }
  }

  /**
   * Upgrade v3.1 feed to v4.2
   */
  upgradeV31ToV42(feed) {
    console.log('🔧 Upgrading WZDx v3.1 → v4.2');

    // v3.1 to v4.2 requires major schema changes
    const upgraded = {
      road_event_feed_info: {
        publisher: feed.road_event_feed_info?.publisher || 'DOT Corridor Communicator (Upgraded)',
        version: '4.2',
        update_date: new Date().toISOString(),
        license: feed.road_event_feed_info?.license || 'https://creativecommons.org/publicdomain/zero/1.0/',
        data_sources: [{
          data_source_id: feed.road_event_feed_info?.data_sources?.[0]?.data_source_id || 'upstream-feed',
          organization_name: feed.road_event_feed_info?.publisher || 'State DOT',
          update_frequency: 300,
          update_date: new Date().toISOString()
        }]
      },
      type: 'FeatureCollection',
      features: []
    };

    // Convert features
    if (feed.features && Array.isArray(feed.features)) {
      upgraded.features = feed.features.map(feature => this.upgradeFeatureV31ToV42(feature));
    }

    return upgraded;
  }

  /**
   * Upgrade v4.0 feed to v4.2
   */
  upgradeV40ToV42(feed) {
    console.log('🔧 Upgrading WZDx v4.0 → v4.2');

    const upgraded = {
      road_event_feed_info: {
        ...feed.road_event_feed_info,
        version: '4.2',
        update_date: new Date().toISOString(),
        publisher: feed.road_event_feed_info?.publisher || 'DOT Corridor Communicator (Upgraded)'
      },
      type: 'FeatureCollection',
      features: []
    };

    // Convert features (v4.0 → v4.2 is mostly compatible)
    if (feed.features && Array.isArray(feed.features)) {
      upgraded.features = feed.features.map(feature => this.upgradeFeatureV40ToV42(feature));
    }

    return upgraded;
  }

  /**
   * Upgrade v4.1 feed to v4.2
   */
  upgradeV41ToV42(feed) {
    console.log('🔧 Upgrading WZDx v4.1 → v4.2');

    const upgraded = {
      road_event_feed_info: {
        ...feed.road_event_feed_info,
        version: '4.2',
        update_date: new Date().toISOString()
      },
      type: 'FeatureCollection',
      features: []
    };

    // Convert features (v4.1 → v4.2 is highly compatible)
    if (feed.features && Array.isArray(feed.features)) {
      upgraded.features = feed.features.map(feature => this.upgradeFeatureV41ToV42(feature));
    }

    return upgraded;
  }

  /**
   * Upgrade v3.1 feature to v4.2
   */
  upgradeFeatureV31ToV42(feature) {
    const props = feature.properties || {};

    return {
      type: 'Feature',
      id: feature.id,
      properties: {
        core_details: {
          data_source_id: props.data_source_id || 'upstream-feed',
          event_type: props.road_event_type || 'work-zone',
          road_names: props.road_names || [],
          direction: props.direction || 'unknown',
          name: props.name || props.description || 'Work Zone',
          description: props.description || '',
          creation_date: props.start_date || new Date().toISOString(),
          update_date: new Date().toISOString()
        },
        start_date: props.start_date,
        end_date: props.end_date,
        beginning_accuracy: 'estimated',
        ending_accuracy: 'estimated',
        vehicle_impact: props.vehicle_impact || 'unknown',
        event_status: props.event_status || 'active',
        reduced_speed_limit_kph: props.reduced_speed_limit || null
      },
      geometry: feature.geometry
    };
  }

  /**
   * Upgrade v4.0 feature to v4.2
   */
  upgradeFeatureV40ToV42(feature) {
    const props = feature.properties || {};

    // v4.0 → v4.2: Mostly compatible, add missing v4.2 fields
    return {
      type: 'Feature',
      id: feature.id,
      properties: {
        core_details: {
          ...props.core_details,
          update_date: new Date().toISOString()
        },
        start_date: props.start_date,
        end_date: props.end_date,
        beginning_accuracy: props.beginning_accuracy || 'estimated',
        ending_accuracy: props.ending_accuracy || 'estimated',
        vehicle_impact: props.vehicle_impact || 'unknown',
        event_status: props.event_status || 'active',
        reduced_speed_limit_kph: props.reduced_speed_limit_kph || null,
        // Add v4.2 optional fields
        location_method: props.location_method || 'channel-device-method',
        work_zone_type: props.work_zone_type || null
      },
      geometry: feature.geometry
    };
  }

  /**
   * Upgrade v4.1 feature to v4.2
   */
  upgradeFeatureV41ToV42(feature) {
    // v4.1 → v4.2: Very compatible, minimal changes
    return {
      type: 'Feature',
      id: feature.id,
      properties: {
        ...feature.properties,
        core_details: {
          ...feature.properties.core_details,
          update_date: new Date().toISOString()
        }
      },
      geometry: feature.geometry
    };
  }

  /**
   * Get upgraded feed for a state (with caching)
   */
  async getUpgradedFeed(stateCode) {
    const cacheKey = stateCode.toUpperCase();

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`✅ Returning cached upgraded feed for ${stateCode} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
      return cached.feed;
    }

    // Fetch and upgrade
    try {
      const { feed, version, state, stateCode: code } = await this.fetchUpstreamFeed(stateCode);

      let upgraded;
      switch (version) {
        case '3.1':
          upgraded = this.upgradeV31ToV42(feed);
          break;
        case '4.0':
          upgraded = this.upgradeV40ToV42(feed);
          break;
        case '4.1':
          upgraded = this.upgradeV41ToV42(feed);
          break;
        default:
          throw new Error(`Unsupported WZDx version: ${version}`);
      }

      // Cache the result
      this.cache.set(cacheKey, {
        feed: upgraded,
        timestamp: Date.now(),
        originalVersion: version,
        state: state
      });

      console.log(`✅ Upgraded ${state} feed: v${version} → v4.2 (${upgraded.features.length} features)`);
      return upgraded;

    } catch (error) {
      // Return stale cache on error if available
      if (cached) {
        console.warn(`⚠️  Returning stale cache for ${stateCode} due to error:`, error.message);
        return cached.feed;
      }
      throw error;
    }
  }

  /**
   * Get all configured states
   */
  getConfiguredStates() {
    return Object.keys(UPSTREAM_FEEDS).map(code => ({
      code,
      state: UPSTREAM_FEEDS[code].state,
      version: UPSTREAM_FEEDS[code].version,
      priority: UPSTREAM_FEEDS[code].priority
    }));
  }

  /**
   * Get upgrade statistics
   */
  getStats() {
    const configured = this.getConfiguredStates();
    const cached = Array.from(this.cache.entries()).map(([code, data]) => ({
      code,
      state: data.state,
      originalVersion: data.originalVersion,
      upgradedVersion: '4.2',
      features: data.feed.features?.length || 0,
      cacheAge: Math.round((Date.now() - data.timestamp) / 1000)
    }));

    return {
      total_configured: configured.length,
      total_cached: cached.length,
      by_priority: {
        critical: configured.filter(s => s.priority === 'critical').length,
        high: configured.filter(s => s.priority === 'high').length,
        medium: configured.filter(s => s.priority === 'medium').length
      },
      configured_states: configured,
      cached_feeds: cached
    };
  }
}

module.exports = WZDxUpgradeService;
