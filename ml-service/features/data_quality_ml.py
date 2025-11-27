"""
Feature #1: ML-Based Data Quality Assessment
Patent-worthy innovation: ML learns patterns of good/bad event data quality
"""

import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
import joblib
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

class DataQualityAssessor:
    """
    ML-based data quality assessment that learns from expert-labeled examples.
    Goes beyond rule-based scoring to capture complex quality patterns.
    """

    def __init__(self, model_path: str = "models/data_quality_model.pkl"):
        self.model_path = model_path
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = []
        self.model_version = "1.0.0"

        # Load existing model if available
        if os.path.exists(model_path):
            self._load_model()
        else:
            # Initialize new model
            self.model = GradientBoostingClassifier(
                n_estimators=200,
                learning_rate=0.1,
                max_depth=5,
                random_state=42
            )

    def _extract_features(self, event: Dict[str, Any]) -> np.ndarray:
        """
        Extract quality-related features from an event.
        Novel approach: ML learns which features indicate quality.
        """
        features = []

        # Completeness features (more nuanced than binary presence)
        required_fields = ['id', 'state', 'event_type', 'latitude', 'longitude', 'timestamp']
        optional_fields = ['description', 'severity', 'lanes_affected', 'start_time', 'end_time']

        # Field presence rate
        features.append(sum(1 for f in required_fields if event.get(f)) / len(required_fields))
        features.append(sum(1 for f in optional_fields if event.get(f)) / len(optional_fields))

        # Field quality metrics
        # Timestamp freshness (hours since event)
        if event.get('timestamp'):
            try:
                ts = datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00'))
                hours_old = (datetime.now(ts.tzinfo) - ts).total_seconds() / 3600
                features.append(min(hours_old, 48))  # Cap at 48 hours
            except:
                features.append(48)  # Default to old if unparseable
        else:
            features.append(48)

        # Coordinate validity
        lat = event.get('latitude', 0)
        lon = event.get('longitude', 0)
        features.append(1 if (30 <= lat <= 50 and -125 <= lon <= -70) else 0)  # US bounds

        # Coordinate precision (decimal places - higher = more precise)
        lat_precision = len(str(lat).split('.')[-1]) if '.' in str(lat) else 0
        lon_precision = len(str(lon).split('.')[-1]) if '.' in str(lon) else 0
        features.append(min(lat_precision, 10))
        features.append(min(lon_precision, 10))

        # Description quality
        desc = event.get('description', '')
        features.append(len(desc))  # Length
        features.append(len(desc.split()) if desc else 0)  # Word count
        features.append(1 if any(char.isdigit() for char in desc) else 0)  # Has numbers
        features.append(1 if any(word in desc.lower() for word in ['closed', 'blocked', 'accident']) else 0)

        # Event type validity
        valid_types = ['construction', 'incident', 'weather', 'special_event', 'roadwork']
        features.append(1 if event.get('event_type', '').lower() in valid_types else 0)

        # State code validity
        valid_states = ['IA', 'IL', 'IN', 'KS', 'MN', 'NE', 'NV', 'OH', 'PA', 'UT', 'CA', 'NJ']
        features.append(1 if event.get('state') in valid_states else 0)

        # Source reliability (can be enhanced with historical tracking)
        features.append(event.get('source_reliability', 0.5))

        # Update frequency (if available from metadata)
        features.append(event.get('update_count', 0))

        # Data consistency score
        # Check if lat/lon matches state boundary (simplified)
        state = event.get('state', '')
        state_lat_ranges = {
            'IA': (40.4, 43.5), 'IL': (37.0, 42.5), 'OH': (38.4, 42.0),
            'NE': (40.0, 43.0), 'KS': (37.0, 40.0), 'IN': (37.8, 41.8)
        }
        if state in state_lat_ranges:
            lat_range = state_lat_ranges[state]
            features.append(1 if lat_range[0] <= lat <= lat_range[1] else 0)
        else:
            features.append(0.5)

        self.feature_names = [
            'required_completeness', 'optional_completeness', 'hours_old',
            'coords_in_bounds', 'lat_precision', 'lon_precision',
            'desc_length', 'desc_words', 'has_numbers', 'has_keywords',
            'valid_type', 'valid_state', 'source_reliability', 'update_count',
            'state_consistency'
        ]

        return np.array(features)

    def assess(self, events: List[Dict], training_mode: bool = False,
               labels: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Assess data quality for events using ML model.

        Args:
            events: List of event dictionaries
            training_mode: If True and labels provided, train on this data
            labels: Ground truth labels (1=good, 0=bad quality)

        Returns:
            Dictionary with quality scores and predictions
        """
        if not events:
            return {"scores": [], "model_version": self.model_version}

        # Extract features
        features = np.array([self._extract_features(e) for e in events])

        # Train if requested
        if training_mode and labels and len(labels) == len(events):
            return self.train(events, labels)

        # Predict quality scores
        if self.model is None or not hasattr(self.model, 'predict_proba'):
            # Fallback to rule-based if model not trained
            scores = [self._rule_based_score(e) for e in events]
            return {
                "scores": scores,
                "model_version": "rule_based_fallback",
                "accuracy": None
            }

        # ML prediction
        features_scaled = self.scaler.transform(features)
        probabilities = self.model.predict_proba(features_scaled)

        # Return probability of "good quality" (class 1)
        scores = probabilities[:, 1].tolist()

        return {
            "scores": scores,
            "model_version": self.model_version,
            "accuracy": None  # Only available during training
        }

    def train(self, events: List[Dict], labels: List[int]) -> Dict[str, Any]:
        """
        Train the ML model on labeled examples.

        Args:
            events: Training events
            labels: Quality labels (1=good, 0=bad)

        Returns:
            Training metrics
        """
        if len(events) != len(labels):
            raise ValueError("Events and labels must have same length")

        # Extract features
        features = np.array([self._extract_features(e) for e in events])
        labels_array = np.array(labels)

        # Scale features
        self.scaler.fit(features)
        features_scaled = self.scaler.transform(features)

        # Train model with cross-validation
        cv_scores = cross_val_score(
            self.model, features_scaled, labels_array, cv=5, scoring='accuracy'
        )

        # Fit on all data
        self.model.fit(features_scaled, labels_array)

        # Feature importance
        feature_importance = dict(zip(
            self.feature_names,
            self.model.feature_importances_.tolist()
        ))

        # Save model
        self._save_model()

        return {
            "accuracy": cv_scores.mean(),
            "std_dev": cv_scores.std(),
            "cv_scores": cv_scores.tolist(),
            "feature_importance": feature_importance,
            "training_samples": len(events),
            "model_version": self.model_version
        }

    def _rule_based_score(self, event: Dict) -> float:
        """Fallback rule-based scoring when ML model unavailable."""
        score = 0.0

        # Required fields (40%)
        if all(event.get(f) for f in ['id', 'state', 'event_type', 'latitude', 'longitude']):
            score += 0.4

        # Freshness (30%)
        if event.get('timestamp'):
            try:
                ts = datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00'))
                hours_old = (datetime.now(ts.tzinfo) - ts).total_seconds() / 3600
                if hours_old < 1:
                    score += 0.3
                elif hours_old < 6:
                    score += 0.2
                elif hours_old < 24:
                    score += 0.1
            except:
                pass

        # Coordinate quality (20%)
        lat = event.get('latitude', 0)
        lon = event.get('longitude', 0)
        if 30 <= lat <= 50 and -125 <= lon <= -70:
            score += 0.2

        # Description (10%)
        if event.get('description') and len(event.get('description', '')) > 20:
            score += 0.1

        return min(score, 1.0)

    def _save_model(self):
        """Save model to disk."""
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'version': self.model_version
        }, self.model_path)

    def _load_model(self):
        """Load model from disk."""
        if os.path.exists(self.model_path):
            data = joblib.load(self.model_path)
            self.model = data['model']
            self.scaler = data['scaler']
            self.feature_names = data['feature_names']
            self.model_version = data['version']

    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self.model is not None
