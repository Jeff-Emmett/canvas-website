#!/bin/bash
# Open Mapping Backend Setup Script
# Run on Netcup RS 8000 to prepare routing data
#
# Usage: ./open-mapping.setup.sh [region]
# Example: ./open-mapping.setup.sh germany
#          ./open-mapping.setup.sh europe

set -e

REGION=${1:-germany}
DATA_DIR="/opt/apps/open-mapping/data"

echo "=== Open Mapping Setup ==="
echo "Region: $REGION"
echo "Data directory: $DATA_DIR"
echo ""

# Create directories
mkdir -p "$DATA_DIR/osrm"
mkdir -p "$DATA_DIR/valhalla"
mkdir -p "$DATA_DIR/tiles"

cd "$DATA_DIR"

# =========================================================================
# Download OSM Data
# =========================================================================
echo "=== Downloading OSM data ==="

case $REGION in
  germany)
    OSM_URL="https://download.geofabrik.de/europe/germany-latest.osm.pbf"
    OSM_FILE="germany-latest.osm.pbf"
    ;;
  europe)
    OSM_URL="https://download.geofabrik.de/europe-latest.osm.pbf"
    OSM_FILE="europe-latest.osm.pbf"
    ;;
  *)
    echo "Unknown region: $REGION"
    echo "Supported: germany, europe"
    exit 1
    ;;
esac

if [ ! -f "osrm/$OSM_FILE" ]; then
  echo "Downloading $OSM_URL..."
  wget -O "osrm/$OSM_FILE" "$OSM_URL"
else
  echo "OSM file already exists, skipping download"
fi

# =========================================================================
# Process OSRM Data
# =========================================================================
echo "=== Processing OSRM routing data ==="
echo "This may take several hours for large regions..."

cd osrm

# Extract
if [ ! -f "${OSM_FILE%.osm.pbf}.osrm" ]; then
  echo "Running osrm-extract..."
  docker run -t -v "${PWD}:/data" osrm/osrm-backend:v5.27.1 \
    osrm-extract -p /opt/car.lua /data/$OSM_FILE
else
  echo "OSRM extract already done, skipping"
fi

# Partition (for MLD algorithm)
if [ ! -f "${OSM_FILE%.osm.pbf}.osrm.partition" ]; then
  echo "Running osrm-partition..."
  docker run -t -v "${PWD}:/data" osrm/osrm-backend:v5.27.1 \
    osrm-partition /data/${OSM_FILE%.osm.pbf}.osrm
else
  echo "OSRM partition already done, skipping"
fi

# Customize
if [ ! -f "${OSM_FILE%.osm.pbf}.osrm.mldgr" ]; then
  echo "Running osrm-customize..."
  docker run -t -v "${PWD}:/data" osrm/osrm-backend:v5.27.1 \
    osrm-customize /data/${OSM_FILE%.osm.pbf}.osrm
else
  echo "OSRM customize already done, skipping"
fi

cd ..

# =========================================================================
# Download Vector Tiles (optional, can use Valhalla built-in)
# =========================================================================
echo "=== Setting up vector tiles ==="

# Option 1: Use OpenMapTiles pre-built (requires license for commercial)
# Option 2: Generate from OSM data (time consuming)
# Option 3: Use free tile providers with attribution

# For now, create a config to use external tile providers
cat > tiles/config.json << 'EOF'
{
  "options": {
    "paths": {
      "fonts": "fonts",
      "sprites": "sprites",
      "styles": "styles",
      "mbtiles": ""
    }
  },
  "styles": {
    "osm-bright": {
      "style": "osm-bright/style.json"
    }
  }
}
EOF

echo "Tile server configured to use styles from ./tiles/"
echo "Download MBTiles from OpenMapTiles or generate from OSM for offline use"

# =========================================================================
# Verify Setup
# =========================================================================
echo ""
echo "=== Setup Complete ==="
echo ""
echo "Directory structure:"
ls -la "$DATA_DIR"
echo ""
echo "OSRM files:"
ls -la "$DATA_DIR/osrm/"
echo ""
echo "Next steps:"
echo "1. Copy docker-compose file to /opt/apps/open-mapping/"
echo "2. Run: docker compose up -d"
echo "3. Test OSRM: curl 'http://localhost:5000/route/v1/driving/13.388860,52.517037;13.397634,52.529407?overview=false'"
echo "4. Add to Cloudflare tunnel if needed"
