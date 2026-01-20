-- Insert sample geometry data for I-76 Pennsylvania Turnpike to demonstrate map rendering
-- This is a simplified version with just a few key points along the route

UPDATE corridors
SET
    geometry = '{"type":"LineString","coordinates":[[-80.519, 40.443],[-80.0, 40.4],[-79.5, 40.35],[-79.0, 40.3],[-78.5, 40.2],[-78.0, 40.1],[-77.5, 40.0],[-77.0, 39.95],[-76.5, 39.9],[-76.0, 39.85],[-75.5, 39.95],[-75.2, 40.05],[-75.0, 40.1],[-74.75, 40.2]]}'::jsonb,
    bounds = '{"west":-80.519,"east":-74.75,"south":39.85,"north":40.443}'::jsonb
WHERE id = 'I76_PA';

-- Also add a simple line for I-95 Eastern corridor to show multiple corridors
UPDATE corridors
SET
    geometry = '{"type":"LineString","coordinates":[[-77.0, 38.8],[-77.0, 39.5],[-76.5, 40.0],[-76.0, 40.5],[-75.5, 41.0],[-75.0, 41.5],[-74.5, 42.0],[-74.0, 42.5],[-73.5, 43.0],[-73.0, 43.5],[-72.5, 44.0],[-72.0, 44.5],[-71.5, 45.0]]}'::jsonb,
    bounds = '{"west":-77.0,"east":-71.5,"south":38.8,"north":45.0}'::jsonb
WHERE id = 'I95_CORRIDOR';
