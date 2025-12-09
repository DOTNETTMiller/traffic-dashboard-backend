import axios from 'axios';
import { config } from '../config';

const API_BASE_URL = config.apiUrl;

console.log('📡 API Base URL:', API_BASE_URL);

class TrafficAPI {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 300000 // Increased to 5 minutes for large GIS file uploads (.gdb.zip)
    });
  }

  // Generic GET method for any endpoint
  async get(endpoint, config = {}) {
    try {
      const response = await this.client.get(endpoint, config);
      return response;
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      throw error;
    }
  }

  // Generic POST method for any endpoint
  async post(endpoint, data, config = {}) {
    try {
      const response = await this.client.post(endpoint, data, config);
      return response;
    } catch (error) {
      console.error(`Error posting to ${endpoint}:`, error);
      throw error;
    }
  }

  // Get all events from all states
  async getAllEvents() {
    try {
      const response = await this.client.get('/api/events');
      return response.data;
    } catch (error) {
      console.error('Error fetching all events:', error);
      throw error;
    }
  }

  // Get events from a specific state
  async getStateEvents(state) {
    try {
      const response = await this.client.get(`/api/events/${state}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${state} events:`, error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.client.get('/api/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  async getActiveDetourAlerts(authToken) {
    try {
      const response = await this.client.get('/api/detour-alerts/active', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
      });
      return response.data;
    } catch (error) {
      // Silently fail - 403 errors expected if user lacks permissions
      if (error.response?.status !== 403) {
        console.error('Error fetching detour alerts:', error);
      }
      throw error;
    }
  }

  async getInterchanges(authToken) {
    try {
      const response = await this.client.get('/api/admin/interchanges', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching interchanges:', error);
      throw error;
    }
  }

  async createInterchange(data, authToken) {
    try {
      const response = await this.client.post('/api/admin/interchanges', data, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
      });
      return response.data;
    } catch (error) {
      console.error('Error creating interchange:', error);
      throw error;
    }
  }

  async updateInterchange(id, data, authToken) {
    try {
      const response = await this.client.put(`/api/admin/interchanges/${id}`, data, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
      });
      return response.data;
    } catch (error) {
      console.error('Error updating interchange:', error);
      throw error;
    }
  }

  async deleteInterchange(id, authToken) {
    try {
      const response = await this.client.delete(`/api/admin/interchanges/${id}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting interchange:', error);
      throw error;
    }
  }

  async resolveDetourAlert(id, note, authToken) {
    try {
      const response = await this.client.post(`/api/admin/detour-alerts/${id}/resolve`, { note }, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
      });
      return response.data;
    } catch (error) {
      console.error('Error resolving detour alert:', error);
      throw error;
    }
  }

  async submitFeed(data, authToken) {
    try {
      const response = await this.client.post('/api/feeds/submit', data, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
      });
      return response.data;
    } catch (error) {
      console.error('Error submitting feed:', error);
      throw error;
    }
  }

  async getFeedSubmissions(authToken, status = 'pending') {
    try {
      const response = await this.client.get(`/api/admin/feeds/submissions?status=${status}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching feed submissions:', error);
      throw error;
    }
  }

  async resolveFeedSubmission(id, payload, authToken) {
    try {
      const response = await this.client.post(`/api/admin/feeds/submissions/${id}/resolve`, payload, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
      });
      return response.data;
    } catch (error) {
      console.error('Error resolving feed submission:', error);
      throw error;
    }
  }

  async getGroundTruthAccuracy() {
    try {
      const response = await this.client.get('/api/parking/ground-truth/accuracy');
      return response.data;
    } catch (error) {
      console.error('Error fetching ground truth accuracy:', error);
      throw error;
    }
  }

  async getAICountConsensus(facilityId) {
    try {
      const response = await this.client.post('/api/parking/ground-truth/ai-count-consensus',
        { facilityId },
        { timeout: 120000 } // 2 minutes timeout for multi-camera analysis
      );
      return response.data;
    } catch (error) {
      console.error('Error getting AI consensus count:', error);
      throw error;
    }
  }

  async retrainParkingModel(authToken, minObservations = 3) {
    try {
      const response = await this.client.post('/api/parking/ground-truth/retrain',
        { minObservations },
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error retraining parking model:', error);
      throw error;
    }
  }
}

export default new TrafficAPI();
