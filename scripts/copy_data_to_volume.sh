#!/bin/bash
# Copy data files from git build to persistent volume if needed

DATA_DIR="/app/data"
VOLUME_FILE="$DATA_DIR/truck_parking_patterns.json"

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"

# Check if file exists on volume
if [ ! -f "$VOLUME_FILE" ]; then
  echo "📦 Data file not found on volume, checking git build..."
  
  # The git files might be in a different location during build
  # Try to find the bundled data file
  if [ -f "./data/truck_parking_patterns.json" ]; then
    echo "✅ Found data file in git build, copying to volume..."
    cp -v "./data/truck_parking_patterns.json" "$VOLUME_FILE"
  else
    echo "❌ Could not find data file in git build"
    exit 1
  fi
fi

echo "✅ Data file ready on volume"
ls -lh "$VOLUME_FILE"
