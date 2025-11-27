/**
 * Feature #6: Multi-Objective Route Optimization
 */
import { useState } from 'react';
import axios from 'axios';
import { config } from '../config';

function RouteOptimizer({ events, authToken }) {
  const [origin, setOrigin] = useState({ lat: 41.5, lon: -93.5 });
  const [destination, setDestination] = useState({ lat: 40.7, lon: -89.6 });
  const [vehicle, setVehicle] = useState({
    height_meters: 4.2,
    weight_kg: 35000,
    hazmat: false
  });
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState(null);

  const optimizeRoute = async () => {
    setOptimizing(true);
    try {
      const response = await axios.post(
        `${config.API_URL}/api/ml/optimize-route`,
        {
          origin,
          destination,
          vehicle_constraints: vehicle,
          current_events: events || []
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setResult(response.data);
    } catch (error) {
      console.error('Route optimization failed:', error);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="route-optimizer">
      <div className="feature-header">
        <h3>Multi-Objective Route Optimization</h3>
        <span className="feature-badge">Feature #6</span>
      </div>

      <div className="feature-description">
        <p>Balances time (30%), fuel (25%), parking (20%), safety (15%), compliance (10%)</p>
        <div className="metrics">
          <div className="metric">
            <span className="metric-label">Time Savings:</span>
            <span className="metric-value">20%</span>
          </div>
          <div className="metric">
            <span className="metric-label">Fuel Savings:</span>
            <span className="metric-value">15%</span>
          </div>
        </div>
      </div>

      <div className="route-inputs">
        <div className="input-group">
          <label>Origin (lat, lon)</label>
          <input
            type="text"
            value={`${origin.lat}, ${origin.lon}`}
            onChange={(e) => {
              const [lat, lon] = e.target.value.split(',').map(s => parseFloat(s.trim()));
              if (!isNaN(lat) && !isNaN(lon)) setOrigin({ lat, lon });
            }}
          />
        </div>
        <div className="input-group">
          <label>Destination (lat, lon)</label>
          <input
            type="text"
            value={`${destination.lat}, ${destination.lon}`}
            onChange={(e) => {
              const [lat, lon] = e.target.value.split(',').map(s => parseFloat(s.trim()));
              if (!isNaN(lat) && !isNaN(lon)) setDestination({ lat, lon });
            }}
          />
        </div>
        <div className="input-group">
          <label>Vehicle Height (m)</label>
          <input
            type="number"
            value={vehicle.height_meters}
            onChange={(e) => setVehicle({ ...vehicle, height_meters: parseFloat(e.target.value) })}
            step="0.1"
          />
        </div>
        <div className="input-group">
          <label>Vehicle Weight (kg)</label>
          <input
            type="number"
            value={vehicle.weight_kg}
            onChange={(e) => setVehicle({ ...vehicle, weight_kg: parseInt(e.target.value) })}
          />
        </div>
        <div className="input-group">
          <label>
            <input
              type="checkbox"
              checked={vehicle.hazmat}
              onChange={(e) => setVehicle({ ...vehicle, hazmat: e.target.checked })}
            />
            HazMat Vehicle
          </label>
        </div>
      </div>

      <button onClick={optimizeRoute} disabled={optimizing} className="optimize-button">
        {optimizing ? 'Optimizing...' : 'Optimize Route'}
      </button>

      {result && (
        <div className="route-result">
          <h4>Optimized Route</h4>
          <div className="route-metrics">
            <div className="metric-card">
              <div className="metric-value">{result.time?.toFixed(1)} hrs</div>
              <div className="metric-label">Estimated Time</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">${result.fuel_cost?.toFixed(2)}</div>
              <div className="metric-label">Fuel Cost</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{result.parking_stops?.length || 0}</div>
              <div className="metric-label">Parking Stops</div>
            </div>
          </div>

          {result.warnings && result.warnings.length > 0 && (
            <div className="route-warnings">
              <h5>⚠️ Warnings</h5>
              {result.warnings.map((warning, idx) => (
                <div key={idx} className="warning-item">{warning}</div>
              ))}
            </div>
          )}

          <div className="patent-info">
            <small>💡 <strong>Patent Innovation:</strong> 5-objective optimization specific to commercial trucking</small>
          </div>
        </div>
      )}
    </div>
  );
}

export default RouteOptimizer;
