import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class TrafficAPI {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000
    });
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
}

export default new TrafficAPI();
