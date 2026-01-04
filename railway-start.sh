#!/bin/sh
# Railway startup script - ensures sensors are initialized on deployment

echo "🚂 Railway startup - initializing system..."

# Initialize volume data (includes sensor initialization)
echo "📦 Initializing volume data and sensors..."
node scripts/init_volume_data.js

if [ $? -eq 0 ]; then
  echo "✅ Initialization complete!"
else
  echo "⚠️  Initialization had warnings, continuing anyway..."
fi

# Start the backend server
echo "🚀 Starting backend server..."
exec node backend_proxy_server.js
