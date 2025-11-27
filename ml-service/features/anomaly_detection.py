"""
Feature #5: Real-Time Anomaly Detection with Self-Healing
Patent-worthy innovation: Detects data corruption and automatically switches to fallback sources
"""

import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from collections import deque
import joblib
import os

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class AnomalyDetector:
    """
    Detects anomalous events in real-time using unsupervised learning.
    Novel: Automatically suggests fallback data when anomalies detected.
    """

    def __init__(self, model_path: str = "models/anomaly_model.pkl"):
        self.model_path = model_path
        self.model = None
        self.scaler = StandardScaler()
        self.event_history = deque(maxlen=1000)  # Recent normal events
        self.state_baselines = {}  # Expected patterns per state

        if SKLEARN_AVAILABLE:
            if os.path.exists(model_path):
                self._load_model()
            else:
                self.model = IsolationForest(
                    contamination=0.1,
                    random_state=42,
                    n_estimators=100
                )

    def detect(self, current_event: Dict, recent_events: List[Dict]) -> Dict[str, Any]:
        """
        Detect if current event is anomalous.

        Args:
            current_event: Event to check
            recent_events: Recent events for context

        Returns:
            Anomaly detection results with fallback suggestions
        """
        # Extract features
        features = self._extract_features(current_event, recent_events)

        # Detect anomalies using multiple methods
        is_anomaly = False
        anomaly_score = 0.0
        anomaly_type = "none"
        explanation = ""

        # Method 1: Statistical outlier detection
        stat_anomaly, stat_score, stat_type = self._statistical_detection(
            current_event, recent_events
        )

        # Method 2: ML-based detection (if model available)
        ml_anomaly = False
        ml_score = 0.0

        if SKLEARN_AVAILABLE and self.model and hasattr(self.model, 'predict'):
            try:
                features_scaled = self.scaler.transform([features])
                prediction = self.model.predict(features_scaled)[0]
                ml_score = abs(self.model.score_samples(features_scaled)[0])
                ml_anomaly = prediction == -1
            except:
                pass

        # Method 3: Pattern-based detection
        pattern_anomaly, pattern_score, pattern_type = self._pattern_detection(
            current_event, recent_events
        )

        # Combine methods
        anomaly_scores = {
            'statistical': stat_score,
            'ml': ml_score,
            'pattern': pattern_score
        }

        is_anomaly = stat_anomaly or ml_anomaly or pattern_anomaly
        anomaly_score = max(stat_score, ml_score, pattern_score)

        if stat_anomaly:
            anomaly_type = stat_type
            explanation = self._explain_anomaly(stat_type, current_event)
        elif pattern_anomaly:
            anomaly_type = pattern_type
            explanation = self._explain_anomaly(pattern_type, current_event)
        elif ml_anomaly:
            anomaly_type = "ml_detected"
            explanation = "Event deviates from learned normal patterns"

        # Generate fallback data if anomaly detected
        fallback = None
        if is_anomaly:
            fallback = self._generate_fallback(current_event, recent_events, anomaly_type)

        return {
            "is_anomaly": is_anomaly,
            "score": round(anomaly_score, 3),
            "type": anomaly_type,
            "explanation": explanation,
            "fallback": fallback,
            "scores": anomaly_scores,
            "confidence": round(anomaly_score, 3)
        }

    def _extract_features(self, event: Dict, context: List[Dict]) -> np.ndarray:
        """Extract numerical features for anomaly detection."""
        features = []

        # Event attributes
        features.append(event.get('latitude', 0))
        features.append(event.get('longitude', 0))

        # Timestamp features
        if event.get('timestamp'):
            try:
                ts = datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00'))
                features.append(ts.hour)
                features.append(ts.weekday())
                features.append(ts.minute)
            except:
                features.extend([0, 0, 0])
        else:
            features.extend([0, 0, 0])

        # Event type encoding
        event_types = ['construction', 'incident', 'weather', 'special_event']
        event_type = event.get('event_type', '').lower()
        features.extend([1 if et == event_type else 0 for et in event_types])

        # Contextual features
        # Distance from nearest recent event
        if context:
            min_dist = min(self._distance(event, e) for e in context if e.get('latitude'))
            features.append(min_dist)
        else:
            features.append(999)

        # Number of nearby recent events
        nearby = sum(1 for e in context if self._distance(event, e) < 10)  # 10km
        features.append(nearby)

        return np.array(features, dtype=np.float32)

    def _statistical_detection(self, event: Dict, recent: List[Dict]) -> tuple:
        """Detect anomalies using statistical methods."""
        # Check for impossible coordinates
        lat = event.get('latitude', 0)
        lon = event.get('longitude', 0)

        # All events at (0,0) - sensor failure
        if lat == 0 and lon == 0:
            return True, 1.0, "zero_coordinates"

        # Coordinates outside US bounds
        if not (24 <= lat <= 50 and -125 <= lon <= -65):
            return True, 1.0, "invalid_coordinates"

        # All recent events have identical coordinates - API stuck
        if len(recent) >= 5:
            coords = [(e.get('latitude'), e.get('longitude')) for e in recent[-5:]]
            if len(set(coords)) == 1:
                return True, 0.9, "stuck_api"

        # Timestamp in future
        if event.get('timestamp'):
            try:
                ts = datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00'))
                if ts > datetime.now(ts.tzinfo) + timedelta(hours=1):
                    return True, 0.95, "future_timestamp"
            except:
                pass

        # Very old event suddenly appearing
        if event.get('timestamp'):
            try:
                ts = datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00'))
                age_hours = (datetime.now(ts.tzinfo) - ts).total_seconds() / 3600
                if age_hours > 168:  # 1 week old
                    return True, 0.8, "stale_event"
            except:
                pass

        return False, 0.0, "none"

    def _pattern_detection(self, event: Dict, recent: List[Dict]) -> tuple:
        """Detect anomalies based on unusual patterns."""
        state = event.get('state')

        # Check against state baseline patterns
        if state in self.state_baselines:
            baseline = self.state_baselines[state]

            # Sudden spike in event count
            current_count = sum(1 for e in recent if e.get('state') == state)
            if current_count > baseline.get('avg_count', 10) * 3:
                return True, 0.7, "event_spike"

            # Event in unexpected location for state
            expected_lat_range = baseline.get('lat_range', (0, 90))
            expected_lon_range = baseline.get('lon_range', (-180, 0))

            lat = event.get('latitude', 0)
            lon = event.get('longitude', 0)

            if not (expected_lat_range[0] <= lat <= expected_lat_range[1] and
                   expected_lon_range[0] <= lon <= expected_lon_range[1]):
                return True, 0.75, "out_of_state_bounds"

        # Duplicate ID with different data
        event_id = event.get('id')
        if event_id:
            duplicates = [e for e in recent if e.get('id') == event_id]
            if duplicates and duplicates[0] != event:
                return True, 0.85, "duplicate_id_mismatch"

        return False, 0.0, "none"

    def _distance(self, event1: Dict, event2: Dict) -> float:
        """Calculate distance between events in km."""
        lat1 = event1.get('latitude', 0)
        lon1 = event1.get('longitude', 0)
        lat2 = event2.get('latitude', 0)
        lon2 = event2.get('longitude', 0)

        # Haversine formula
        R = 6371
        dlat = np.radians(lat2 - lat1)
        dlon = np.radians(lon2 - lon1)

        a = (np.sin(dlat/2)**2 +
             np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) *
             np.sin(dlon/2)**2)

        c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))
        return R * c

    def _generate_fallback(self, anomalous_event: Dict,
                          recent_events: List[Dict], anomaly_type: str) -> Dict:
        """
        Generate fallback data when anomaly detected.
        Novel: Intelligent fallback based on anomaly type.
        """
        state = anomalous_event.get('state')

        if anomaly_type == "zero_coordinates":
            # Use last known good coordinates for this state/event
            similar = [e for e in reversed(recent_events)
                      if e.get('state') == state and
                      e.get('latitude') != 0 and e.get('longitude') != 0]

            if similar:
                return {
                    "source": "cached_coordinates",
                    "latitude": similar[0]['latitude'],
                    "longitude": similar[0]['longitude'],
                    "confidence": 0.6
                }

        elif anomaly_type == "stuck_api":
            # Skip update, use previous version
            return {
                "source": "skip_update",
                "action": "retain_previous_data",
                "confidence": 0.8
            }

        elif anomaly_type == "stale_event":
            # Mark as historical, don't display
            return {
                "source": "filtered_out",
                "action": "remove_from_active_events",
                "confidence": 0.9
            }

        # Default: interpolate from nearby events
        nearby = [e for e in recent_events
                 if e.get('state') == state and
                 self._distance(e, anomalous_event) < 50]

        if nearby:
            avg_lat = np.mean([e['latitude'] for e in nearby if e.get('latitude')])
            avg_lon = np.mean([e['longitude'] for e in nearby if e.get('longitude')])

            return {
                "source": "interpolated",
                "latitude": float(avg_lat),
                "longitude": float(avg_lon),
                "confidence": 0.5
            }

        return {
            "source": "none_available",
            "action": "manual_review_required",
            "confidence": 0.0
        }

    def _explain_anomaly(self, anomaly_type: str, event: Dict) -> str:
        """Generate human-readable explanation of anomaly."""
        explanations = {
            "zero_coordinates": f"Event coordinates (0, 0) indicate sensor failure for {event.get('state', 'unknown')} API",
            "invalid_coordinates": f"Coordinates ({event.get('latitude')}, {event.get('longitude')}) outside valid US range",
            "stuck_api": "API returning identical data - possible caching issue or service outage",
            "future_timestamp": f"Event timestamp {event.get('timestamp')} is in the future",
            "stale_event": f"Event is over 1 week old - may be incorrectly included in feed",
            "event_spike": f"Unusual spike in events from {event.get('state')} - possible data corruption",
            "out_of_state_bounds": f"Event location doesn't match state {event.get('state')} geography",
            "duplicate_id_mismatch": f"Event ID {event.get('id')} reused with different data"
        }

        return explanations.get(anomaly_type, "Anomaly detected by ML model")

    def train(self, normal_events: List[Dict]) -> Dict[str, Any]:
        """Train anomaly detector on normal event patterns."""
        if not SKLEARN_AVAILABLE or not normal_events:
            return {"error": "Training requires sklearn and training data"}

        # Extract features from normal events
        features = np.array([self._extract_features(e, normal_events) for e in normal_events])

        # Fit scaler
        self.scaler.fit(features)
        features_scaled = self.scaler.transform(features)

        # Train isolation forest
        self.model.fit(features_scaled)

        # Build state baselines
        for event in normal_events:
            state = event.get('state')
            if state:
                if state not in self.state_baselines:
                    self.state_baselines[state] = {
                        'events': [],
                        'lats': [],
                        'lons': []
                    }

                self.state_baselines[state]['events'].append(event)
                if event.get('latitude'):
                    self.state_baselines[state]['lats'].append(event['latitude'])
                if event.get('longitude'):
                    self.state_baselines[state]['lons'].append(event['longitude'])

        # Calculate statistics
        for state, data in self.state_baselines.items():
            data['avg_count'] = len(data['events'])
            if data['lats']:
                data['lat_range'] = (min(data['lats']), max(data['lats']))
            if data['lons']:
                data['lon_range'] = (min(data['lons']), max(data['lons']))

        self._save_model()

        return {
            "training_samples": len(normal_events),
            "states_profiled": len(self.state_baselines),
            "model_type": "IsolationForest"
        }

    def _save_model(self):
        """Save model to disk."""
        if SKLEARN_AVAILABLE:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            joblib.dump({
                'model': self.model,
                'scaler': self.scaler,
                'baselines': self.state_baselines
            }, self.model_path)

    def _load_model(self):
        """Load model from disk."""
        if SKLEARN_AVAILABLE and os.path.exists(self.model_path):
            data = joblib.load(self.model_path)
            self.model = data['model']
            self.scaler = data['scaler']
            self.state_baselines = data['baselines']

    def is_loaded(self) -> bool:
        """Check if detector is ready."""
        return True  # Statistical methods always available
