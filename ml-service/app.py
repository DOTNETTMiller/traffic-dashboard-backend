"""
DOT Corridor Communicator - ML Service
Advanced ML capabilities for patent-worthy features
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import uvicorn
import os
from datetime import datetime
import json

# Import feature modules
from features.data_quality_ml import DataQualityAssessor
from features.event_correlation import CrossStateCorrelation
from features.schema_learning import SchemaLearner
from features.anomaly_detection import AnomalyDetector
from features.route_optimization import RouteOptimizer
from features.federated_learning import FederatedCoordinator
from features.nlp_extraction import NLPExtractor
from features.incident_prediction import IncidentPredictor

app = FastAPI(
    title="DOT Corridor Communicator ML Service",
    description="Advanced ML capabilities for multi-state traffic intelligence",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize feature modules
data_quality = DataQualityAssessor()
event_correlation = CrossStateCorrelation()
schema_learner = SchemaLearner()
anomaly_detector = AnomalyDetector()
route_optimizer = RouteOptimizer()
federated_coordinator = FederatedCoordinator()
nlp_extractor = NLPExtractor()
incident_predictor = IncidentPredictor()

# ==================== Request/Response Models ====================

class Event(BaseModel):
    id: str
    state: str
    event_type: str
    latitude: float
    longitude: float
    timestamp: str
    description: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = {}

class DataQualityRequest(BaseModel):
    events: List[Event]
    training_mode: bool = False
    labels: Optional[List[int]] = None  # 1 = good, 0 = bad

class CorrelationRequest(BaseModel):
    events: List[Event]
    predict_downstream: bool = True

class SchemaRequest(BaseModel):
    sample_data: List[Dict[str, Any]]
    existing_mappings: Optional[Dict[str, str]] = {}

class AnomalyRequest(BaseModel):
    events: List[Event]
    current_event: Event

class RouteRequest(BaseModel):
    origin: Dict[str, float]  # {lat, lon}
    destination: Dict[str, float]
    vehicle_constraints: Dict[str, Any]
    current_events: List[Event]

class NLPRequest(BaseModel):
    text_sources: List[Dict[str, str]]  # [{source, text}]

class PredictionRequest(BaseModel):
    current_conditions: Dict[str, Any]
    historical_events: List[Event]

# ==================== Feature #1: ML Data Quality Assessment ====================

@app.post("/api/ml/data-quality/assess")
async def assess_data_quality(request: DataQualityRequest):
    """
    Assess event data quality using ML.
    Returns quality scores and predictions.
    """
    try:
        results = data_quality.assess(
            [e.dict() for e in request.events],
            training_mode=request.training_mode,
            labels=request.labels
        )
        return {
            "success": True,
            "scores": results["scores"],
            "accuracy": results.get("accuracy"),
            "model_version": results["model_version"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/data-quality/train")
async def train_quality_model(request: DataQualityRequest):
    """Train or update the data quality ML model."""
    try:
        if not request.labels:
            raise HTTPException(status_code=400, detail="Training requires labeled data")

        metrics = data_quality.train(
            [e.dict() for e in request.events],
            request.labels
        )
        return {
            "success": True,
            "metrics": metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Feature #2: Cross-State Event Correlation ====================

@app.post("/api/ml/correlation/analyze")
async def analyze_correlations(request: CorrelationRequest):
    """
    Analyze cross-state event correlations using graph neural networks.
    Predicts downstream effects across state boundaries.
    """
    try:
        results = event_correlation.analyze(
            [e.dict() for e in request.events],
            predict_downstream=request.predict_downstream
        )
        return {
            "success": True,
            "correlations": results["correlations"],
            "predictions": results.get("predictions", []),
            "confidence": results["confidence"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/correlation/train")
async def train_correlation_model(request: CorrelationRequest):
    """Train the cross-state correlation model on historical data."""
    try:
        metrics = event_correlation.train([e.dict() for e in request.events])
        return {
            "success": True,
            "metrics": metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Feature #3: Automatic Schema Learning ====================

@app.post("/api/ml/schema/learn")
async def learn_schema(request: SchemaRequest):
    """
    Automatically learn field mappings for new data sources.
    Uses few-shot learning to infer schema from examples.
    """
    try:
        mappings = schema_learner.learn(
            request.sample_data,
            existing_mappings=request.existing_mappings
        )
        return {
            "success": True,
            "suggested_mappings": mappings["mappings"],
            "confidence": mappings["confidence"],
            "field_types": mappings["field_types"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Feature #5: Anomaly Detection ====================

@app.post("/api/ml/anomaly/detect")
async def detect_anomalies(request: AnomalyRequest):
    """
    Detect anomalies in real-time event stream.
    Returns anomaly score and suggested fallback data.
    """
    try:
        result = anomaly_detector.detect(
            request.current_event.dict(),
            [e.dict() for e in request.events]
        )
        return {
            "success": True,
            "is_anomaly": result["is_anomaly"],
            "anomaly_score": result["score"],
            "anomaly_type": result["type"],
            "fallback_data": result.get("fallback"),
            "explanation": result["explanation"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/anomaly/train")
async def train_anomaly_detector(events: List[Event]):
    """Train the anomaly detection model on normal event patterns."""
    try:
        metrics = anomaly_detector.train([e.dict() for e in events])
        return {
            "success": True,
            "metrics": metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Feature #6: Route Optimization ====================

@app.post("/api/ml/route/optimize")
async def optimize_route(request: RouteRequest):
    """
    Multi-objective route optimization for commercial vehicles.
    Balances time, fuel, parking, restrictions, and safety.
    """
    try:
        route = route_optimizer.optimize(
            origin=request.origin,
            destination=request.destination,
            vehicle=request.vehicle_constraints,
            events=[e.dict() for e in request.current_events]
        )
        return {
            "success": True,
            "route": route["path"],
            "waypoints": route["waypoints"],
            "metrics": {
                "estimated_time": route["time"],
                "fuel_cost": route["fuel_cost"],
                "savings_vs_fastest": route["savings"],
                "parking_stops": route["parking_stops"]
            },
            "warnings": route["warnings"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Feature #7: Federated Learning ====================

@app.post("/api/ml/federated/init-training")
async def init_federated_training(model_name: str, states: List[str]):
    """Initialize federated learning round across multiple states."""
    try:
        config = federated_coordinator.init_round(model_name, states)
        return {
            "success": True,
            "round_id": config["round_id"],
            "client_configs": config["configs"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/federated/aggregate")
async def aggregate_updates(round_id: str, updates: List[Dict]):
    """Aggregate model updates from state DOTs."""
    try:
        result = federated_coordinator.aggregate(round_id, updates)
        return {
            "success": True,
            "global_model": result["model"],
            "improvement": result["improvement"],
            "ready_for_deployment": result["ready"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Feature #8: NLP Event Extraction ====================

@app.post("/api/ml/nlp/extract")
async def extract_events_from_text(request: NLPRequest):
    """
    Extract structured events from unstructured text sources.
    Supports social media, 511 messages, news, etc.
    """
    try:
        events = nlp_extractor.extract(request.text_sources)
        return {
            "success": True,
            "extracted_events": events["events"],
            "confidence_scores": events["confidence"],
            "sources": events["sources"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Feature #10: Incident Prediction ====================

@app.post("/api/ml/predict/incidents")
async def predict_incidents(request: PredictionRequest):
    """
    Predict future incidents using cross-modal correlation.
    Combines weather, traffic, time, and infrastructure data.
    """
    try:
        predictions = incident_predictor.predict(
            current_conditions=request.current_conditions,
            historical_events=[e.dict() for e in request.historical_events]
        )
        return {
            "success": True,
            "predictions": predictions["incidents"],
            "time_horizon": "30_minutes",
            "confidence": predictions["confidence"],
            "contributing_factors": predictions["factors"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Health & Status ====================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models_loaded": {
            "data_quality": data_quality.is_loaded(),
            "correlation": event_correlation.is_loaded(),
            "anomaly": anomaly_detector.is_loaded(),
            "route": route_optimizer.is_loaded(),
            "nlp": nlp_extractor.is_loaded(),
            "prediction": incident_predictor.is_loaded()
        }
    }

@app.get("/")
async def root():
    """Service information."""
    return {
        "service": "DOT Corridor Communicator ML Service",
        "version": "1.0.0",
        "features": [
            "ML Data Quality Assessment",
            "Cross-State Event Correlation",
            "Automatic Schema Learning",
            "Anomaly Detection with Self-Healing",
            "Multi-Objective Route Optimization",
            "Federated Learning",
            "NLP Event Extraction",
            "Predictive Incident Detection"
        ]
    }

if __name__ == "__main__":
    # Railway provides PORT env var, fall back to ML_SERVICE_PORT, then 8001
    port = int(os.getenv("PORT", os.getenv("ML_SERVICE_PORT", 8001)))
    uvicorn.run(app, host="0.0.0.0", port=port)
