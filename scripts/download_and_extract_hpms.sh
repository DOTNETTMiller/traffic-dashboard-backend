#!/bin/bash

# HPMS I-90 Download and Extraction Script
# This script downloads the HPMS 2023 geodatabase and extracts I-90 using GDAL

set -e  # Exit on error

echo "🚀 HPMS I-90 Extraction Workflow"
echo "================================"
echo ""

# Check if GDAL is installed
if ! command -v ogr2ogr &> /dev/null; then
    echo "❌ GDAL is not installed"
    echo ""
    echo "Install with:"
    echo "  macOS: brew install gdal"
    echo "  Linux: sudo apt install gdal-bin"
    echo ""
    exit 1
fi

echo "✓ GDAL is installed"
echo ""

# Set paths
DOWNLOAD_DIR="$HOME/Downloads/HPMS"
GDB_PATH="$DOWNLOAD_DIR/HPMS_2023.gdb"
OUTPUT_SHP="$DOWNLOAD_DIR/i90_segments.shp"

# Create download directory
mkdir -p "$DOWNLOAD_DIR"

# Check if geodatabase exists
if [ ! -d "$GDB_PATH" ]; then
    echo "❌ HPMS geodatabase not found at: $GDB_PATH"
    echo ""
    echo "Please download from:"
    echo "  https://geodata.bts.gov/datasets/usdot::beta-highway-performance-monitoring-system-hpms-2023/about"
    echo ""
    echo "Extract the .gdb file to: $DOWNLOAD_DIR"
    echo ""
    exit 1
fi

echo "✓ Found geodatabase at: $GDB_PATH"
echo ""

# List available layers
echo "📋 Available layers in geodatabase:"
ogrinfo -so "$GDB_PATH" | grep "1:" | head -20
echo ""

# Try to extract I-90 from the main table
echo "🔍 Extracting I-90 segments..."
echo ""

# Attempt 1: Try "All_Sections" table
if ogrinfo -so "$GDB_PATH" All_Sections &> /dev/null; then
    echo "Using All_Sections table..."
    ogr2ogr -f "ESRI Shapefile" "$OUTPUT_SHP" \
      "$GDB_PATH" \
      -sql "SELECT * FROM All_Sections WHERE F_SYSTEM = 1 AND Route_Numb = '90'" \
      -nlt MULTILINESTRING \
      -progress
else
    echo "⚠️  All_Sections not found, trying alternative layer names..."

    # Attempt 2: Try state-by-state extraction
    STATES=("WA" "ID" "MT" "WY" "SD" "MN" "WI" "IL" "IN" "OH" "PA" "NY" "MA")

    for STATE in "${STATES[@]}"; do
        LAYER="${STATE}_Sections"

        if ogrinfo -so "$GDB_PATH" "$LAYER" &> /dev/null; then
            echo "  Extracting from $LAYER..."

            if [ -f "$OUTPUT_SHP" ]; then
                # Append to existing shapefile
                ogr2ogr -f "ESRI Shapefile" -append "$OUTPUT_SHP" \
                  "$GDB_PATH" "$LAYER" \
                  -where "F_SYSTEM = 1 AND Route_Numb = '90'" \
                  -nlt MULTILINESTRING
            else
                # Create new shapefile
                ogr2ogr -f "ESRI Shapefile" "$OUTPUT_SHP" \
                  "$GDB_PATH" "$LAYER" \
                  -where "F_SYSTEM = 1 AND Route_Numb = '90'" \
                  -nlt MULTILINESTRING
            fi
        else
            echo "  ⚠️  Layer $LAYER not found"
        fi
    done
fi

echo ""

# Verify output
if [ -f "$OUTPUT_SHP" ]; then
    echo "✅ Extraction complete!"
    echo ""
    echo "Output shapefile: $OUTPUT_SHP"
    echo ""

    # Show feature count
    FEATURE_COUNT=$(ogrinfo -so "$OUTPUT_SHP" i90_segments | grep "Feature Count" | awk '{print $3}')
    echo "Feature count: $FEATURE_COUNT"
    echo ""

    # Show field names
    echo "Fields:"
    ogrinfo -so "$OUTPUT_SHP" i90_segments | grep ":" | grep -v "Feature Count" | grep -v "Extent" | grep -v "Layer name"
    echo ""

    echo "📝 Next step: Update the shapefile path in scripts/import_hpms_with_lrs.js"
    echo "   Set: const HPMS_SHAPEFILE = '$OUTPUT_SHP';"
    echo ""
else
    echo "❌ Extraction failed - no output file created"
    exit 1
fi
