"""
Feature #10: Predictive Incident Detection via Cross-Modal Correlation
Patent-worthy innovation: Predicts incidents BEFORE they occur by correlating
weather, traffic speed, time-of-day, and infrastructure characteristics
"""

import numpy as np
from typing import List, Dict, Any
from datetime import datetime, timedelta
import joblib
import os

try:
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class IncidentPredictor:
    """
    Predicts future incidents using multi-modal data fusion.
    Novel: Proactive warnings before incidents occur.
    """

    def __init__(self, model_path: str = "models/incident_prediction_model.pkl"):
        self.model_path = model_path
        self.model = None
        self.scaler = StandardScaler()
        self.risk_zones = {}  # High-risk locations learned from history

        if SKLEARN_AVAILABLE:
            if os.path.exists(model_path):
                self._load_model()
            else:
                self.model = GradientBoostingClassifier(
                    n_estimators=200,
                    learning_rate=0.05,
                    max_depth=6,
                    random_state=42
                )

    def predict(self, current_conditions: Dict[str, Any],
               historical_events: List[Dict]) -> Dict[str, Any]:
        """
        Predict incidents in next 30 minutes.

        Args:
            current_conditions: Current weather, traffic, time data
            historical_events: Recent historical incidents for pattern learning

        Returns:
            Predicted incidents with probabilities
        """
        # Extract multi-modal features
        features = self._extract_multimodal_features(current_conditions, historical_events)

        # Predict incidents using ML model
        predictions = []
        confidence_scores = []

        if SKLEARN_AVAILABLE and self.model and hasattr(self.model, 'predict_proba'):
            # ML-based prediction
            features_scaled = self.scaler.transform([features])
            incident_prob = self.model.predict_proba(features_scaled)[0][1]

            if incident_prob > 0.3:  # Threshold for actionable prediction
                predictions = self._generate_predictions(
                    current_conditions, incident_prob, historical_events
                )
                confidence_scores = [p['probability'] for p in predictions]

        else:
            # Fallback to rule-based prediction
            predictions = self._rule_based_prediction(current_conditions, historical_events)
            confidence_scores = [p['probability'] for p in predictions]

        # Identify contributing factors
        contributing_factors = self._identify_factors(current_conditions, historical_events)

        return {
            "incidents": predictions,
            "confidence": np.mean(confidence_scores) if confidence_scores else 0.0,
            "factors": contributing_factors,
            "prediction_horizon": "30_minutes",
            "timestamp": datetime.now().isoformat()
        }

    def _extract_multimodal_features(self, conditions: Dict, history: List[Dict]) -> np.ndarray:
        """
        Extract features from multiple data modalities.
        Novel: Fusion of weather, traffic, temporal, and infrastructure data.
        """
        features = []

        # === Weather Features ===
        weather = conditions.get('weather', {})

        # Precipitation
        features.append(weather.get('precipitation_mm', 0))
        features.append(1 if weather.get('precipitation_type') == 'snow' else 0)
        features.append(1 if weather.get('precipitation_type') == 'rain' else 0)

        # Temperature (extremes increase risk)
        temp = weather.get('temperature_c', 15)
        features.append(temp)
        features.append(1 if temp < 0 else 0)  # Freezing
        features.append(1 if temp > 35 else 0)  # Extreme heat

        # Visibility
        visibility = weather.get('visibility_km', 10)
        features.append(visibility)
        features.append(1 if visibility < 1 else 0)  # Low visibility

        # Wind
        wind_speed = weather.get('wind_speed_kmh', 0)
        features.append(wind_speed)
        features.append(1 if wind_speed > 40 else 0)  # High winds

        # === Traffic Features ===
        traffic = conditions.get('traffic', {})

        # Speed reduction (congestion indicator)
        avg_speed = traffic.get('average_speed_kmh', 100)
        speed_limit = traffic.get('speed_limit_kmh', 110)
        speed_ratio = avg_speed / speed_limit if speed_limit > 0 else 1.0
        features.append(speed_ratio)
        features.append(1 if speed_ratio < 0.5 else 0)  # Severe congestion

        # Volume
        traffic_volume = traffic.get('volume_vehicles_per_hour', 1000)
        features.append(traffic_volume / 1000)  # Normalize

        # === Temporal Features ===
        now = datetime.now()
        features.append(now.hour / 24.0)  # Hour of day
        features.append(now.weekday() / 6.0)  # Day of week
        features.append(1 if now.weekday() < 5 else 0)  # Weekday vs weekend
        features.append(1 if 7 <= now.hour <= 9 or 16 <= now.hour <= 18 else 0)  # Rush hour

        # === Infrastructure Features ===
        location = conditions.get('location', {})

        # Road characteristics
        features.append(1 if location.get('has_curve') else 0)
        features.append(1 if location.get('has_bridge') else 0)
        features.append(1 if location.get('has_intersection') else 0)
        features.append(location.get('grade_percent', 0) / 10.0)  # Road slope

        # === Historical Patterns ===
        # Incidents in last 24 hours at this location
        lat = location.get('latitude', 0)
        lon = location.get('longitude', 0)

        recent_incidents = [
            e for e in history
            if self._distance((lat, lon), (e.get('latitude', 0), e.get('longitude', 0))) < 5
        ]

        features.append(len(recent_incidents))

        # Time since last incident here
        if recent_incidents:
            try:
                last_incident_time = max(
                    datetime.fromisoformat(e['timestamp'].replace('Z', '+00:00'))
                    for e in recent_incidents if e.get('timestamp')
                )
                hours_since = (datetime.now(last_incident_time.tzinfo) - last_incident_time).total_seconds() / 3600
                features.append(min(hours_since, 48))
            except:
                features.append(48)
        else:
            features.append(48)

        return np.array(features, dtype=np.float32)

    def _generate_predictions(self, conditions: Dict, base_probability: float,
                             history: List[Dict]) -> List[Dict]:
        """Generate specific incident predictions."""
        predictions = []

        location = conditions.get('location', {})
        lat = location.get('latitude', 0)
        lon = location.get('longitude', 0)

        # Determine most likely incident type based on conditions
        weather = conditions.get('weather', {})
        traffic = conditions.get('traffic', {})

        incident_types = []

        # Weather-related
        if weather.get('precipitation_mm', 0) > 5:
            if weather.get('temperature_c', 15) < 0:
                incident_types.append({
                    'type': 'weather_related_crash',
                    'subtype': 'ice_snow',
                    'probability_boost': 0.2
                })
            else:
                incident_types.append({
                    'type': 'weather_related_crash',
                    'subtype': 'rain',
                    'probability_boost': 0.1
                })

        # Congestion-related
        if traffic.get('average_speed_kmh', 100) < 50:
            incident_types.append({
                'type': 'rear_end_collision',
                'subtype': 'congestion',
                'probability_boost': 0.15
            })

        # Visibility-related
        if weather.get('visibility_km', 10) < 1:
            incident_types.append({
                'type': 'low_visibility_crash',
                'subtype': 'fog',
                'probability_boost': 0.25
            })

        # Infrastructure-related
        if location.get('has_curve') and weather.get('precipitation_mm', 0) > 0:
            incident_types.append({
                'type': 'curve_related_crash',
                'subtype': 'wet_conditions',
                'probability_boost': 0.18
            })

        # Default incident type
        if not incident_types:
            incident_types.append({
                'type': 'general_incident',
                'subtype': 'unknown',
                'probability_boost': 0.0
            })

        # Generate predictions for each type
        for inc_type in incident_types:
            final_prob = min(base_probability + inc_type['probability_boost'], 0.95)

            if final_prob > 0.3:
                prediction = {
                    'incident_type': inc_type['type'],
                    'subtype': inc_type['subtype'],
                    'probability': round(final_prob, 3),
                    'predicted_location': {
                        'latitude': lat,
                        'longitude': lon,
                        'highway': location.get('highway', 'unknown')
                    },
                    'estimated_time': self._estimate_time(final_prob),
                    'severity_estimate': self._estimate_severity(conditions, inc_type),
                    'prevention_suggestions': self._suggest_preventions(inc_type, conditions)
                }

                predictions.append(prediction)

        return sorted(predictions, key=lambda x: x['probability'], reverse=True)[:3]

    def _rule_based_prediction(self, conditions: Dict, history: List[Dict]) -> List[Dict]:
        """Fallback rule-based prediction when ML unavailable."""
        predictions = []

        weather = conditions.get('weather', {})
        traffic = conditions.get('traffic', {})
        location = conditions.get('location', {})

        # High-risk conditions
        risk_score = 0.0

        # Heavy precipitation + freezing
        if weather.get('precipitation_mm', 0) > 5 and weather.get('temperature_c', 15) < 0:
            risk_score += 0.4

        # Low visibility
        if weather.get('visibility_km', 10) < 0.5:
            risk_score += 0.3

        # Severe congestion
        if traffic.get('average_speed_kmh', 100) < 30:
            risk_score += 0.2

        # Curve + wet
        if location.get('has_curve') and weather.get('precipitation_mm', 0) > 0:
            risk_score += 0.2

        if risk_score > 0.3:
            predictions.append({
                'incident_type': 'weather_related_incident',
                'subtype': 'rule_based',
                'probability': min(risk_score, 0.9),
                'predicted_location': location,
                'estimated_time': '15-30 minutes',
                'severity_estimate': 'medium',
                'prevention_suggestions': ['Reduce speed', 'Increase following distance']
            })

        return predictions

    def _identify_factors(self, conditions: Dict, history: List[Dict]) -> List[Dict]:
        """Identify contributing risk factors."""
        factors = []

        weather = conditions.get('weather', {})
        traffic = conditions.get('traffic', {})
        location = conditions.get('location', {})

        if weather.get('precipitation_mm', 0) > 5:
            factors.append({
                'factor': 'heavy_precipitation',
                'contribution': 0.3,
                'description': f"{weather.get('precipitation_mm')}mm precipitation"
            })

        if weather.get('visibility_km', 10) < 2:
            factors.append({
                'factor': 'low_visibility',
                'contribution': 0.25,
                'description': f"{weather.get('visibility_km')}km visibility"
            })

        if traffic.get('average_speed_kmh', 100) < 50:
            factors.append({
                'factor': 'congestion',
                'contribution': 0.2,
                'description': f"{traffic.get('average_speed_kmh')}km/h average speed"
            })

        if location.get('has_curve'):
            factors.append({
                'factor': 'curve',
                'contribution': 0.15,
                'description': "Curved roadway section"
            })

        return sorted(factors, key=lambda x: x['contribution'], reverse=True)

    def _estimate_time(self, probability: float) -> str:
        """Estimate time to incident based on probability."""
        if probability > 0.7:
            return "5-15 minutes"
        elif probability > 0.5:
            return "15-30 minutes"
        else:
            return "30-60 minutes"

    def _estimate_severity(self, conditions: Dict, incident_type: Dict) -> str:
        """Estimate incident severity."""
        weather = conditions.get('weather', {})
        traffic = conditions.get('traffic', {})

        severity_score = 0.5

        # High speeds increase severity
        if traffic.get('average_speed_kmh', 100) > 90:
            severity_score += 0.2

        # Poor weather increases severity
        if weather.get('precipitation_mm', 0) > 10:
            severity_score += 0.15

        # Infrastructure factors
        if conditions.get('location', {}).get('has_bridge'):
            severity_score += 0.1

        if severity_score > 0.7:
            return "high"
        elif severity_score > 0.4:
            return "medium"
        else:
            return "low"

    def _suggest_preventions(self, incident_type: Dict, conditions: Dict) -> List[str]:
        """Suggest prevention measures."""
        suggestions = []

        subtype = incident_type.get('subtype', '')

        if 'ice' in subtype or 'snow' in subtype:
            suggestions.extend([
                "Deploy anti-icing treatment",
                "Post reduced speed advisory",
                "Activate warning signs"
            ])

        if 'fog' in subtype:
            suggestions.extend([
                "Activate fog warning systems",
                "Reduce speed limit",
                "Increase patrols"
            ])

        if 'congestion' in subtype:
            suggestions.extend([
                "Activate variable message signs",
                "Implement queue warning",
                "Consider ramp metering"
            ])

        return suggestions

    def _distance(self, point1: tuple, point2: tuple) -> float:
        """Calculate distance between points in km."""
        lat1, lon1 = point1
        lat2, lon2 = point2

        R = 6371
        dlat = np.radians(lat2 - lat1)
        dlon = np.radians(lon2 - lon1)

        a = (np.sin(dlat/2)**2 +
             np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) *
             np.sin(dlon/2)**2)

        c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))
        return R * c

    def train(self, historical_data: List[Dict]) -> Dict[str, Any]:
        """Train prediction model on historical incident data."""
        if not SKLEARN_AVAILABLE:
            return {"error": "sklearn required for training"}

        # Extract features and labels from historical data
        # Label: 1 if incident occurred within 30 min, 0 otherwise
        # This would require labeled training data

        return {
            "status": "training_not_implemented",
            "message": "Requires labeled historical data with pre-incident conditions"
        }

    def _save_model(self):
        """Save model to disk."""
        if SKLEARN_AVAILABLE and self.model:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            joblib.dump({
                'model': self.model,
                'scaler': self.scaler,
                'risk_zones': self.risk_zones
            }, self.model_path)

    def _load_model(self):
        """Load model from disk."""
        if SKLEARN_AVAILABLE and os.path.exists(self.model_path):
            data = joblib.load(self.model_path)
            self.model = data['model']
            self.scaler = data['scaler']
            self.risk_zones = data.get('risk_zones', {})

    def is_loaded(self) -> bool:
        """Check if predictor is ready."""
        return True  # Rule-based fallback always available
