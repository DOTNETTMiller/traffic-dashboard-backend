import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export function useTrafficData(refreshInterval = 300000) { // Changed from 60s to 5min (300s) to reduce API calls
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAllEvents();
      setEvents(data.events || []);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message || 'Failed to fetch events');
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      fetchEvents();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, fetchEvents]);

  return {
    events,
    loading,
    error,
    lastUpdate,
    refetch: fetchEvents
  };
}
