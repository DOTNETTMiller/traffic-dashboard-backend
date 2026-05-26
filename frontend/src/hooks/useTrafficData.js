import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export function useTrafficData() {
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

  // Single load on mount — no background polling. Callers trigger refresh via refetch().
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    lastUpdate,
    refetch: fetchEvents
  };
}
