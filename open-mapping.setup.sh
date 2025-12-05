#!/bin/bash
# Open Mapping Backend Setup Script
# Run on Netcup RS 8000 to prepare routing data

set -e

REGION=${1:-germany}
DATA_DIR="/opt/apps/open-mapping/data"

echo "=== Open Mapping Setup ==="
echo "Region: $REGION"

mkdir -p "$DATA_DIR/osrm" "$DATA_DIR/valhalla" "$DATA_DIR/tiles"
cd "$DATA_DIR"

# Download OSM data
case $REGION in
  germany) OSM_URL="https://download.geofabrik.de/europe/germany-latest.osm.pbf"; OSM_FILE="germany-latest.osm.pbf" ;;
  europe) OSM_URL="https://download.geofabrik.de/europe-latest.osm.pbf"; OSM_FILE="europe-latest.osm.pbf" ;;
  *) echo "Unknown region: $REGION"; exit 1 ;;
esac

[ ! -f "osrm/$OSM_FILE" ] && wget -O "osrm/$OSM_FILE" "$OSM_URL"

# Process OSRM data
cd osrm
[ ! -f "${OSM_FILE%.osm.pbf}.osrm" ] && docker run -t -v "${PWD}:/data" osrm/osrm-backend:v5.27.1 osrm-extract -p /opt/car.lua /data/$OSM_FILE
[ ! -f "${OSM_FILE%.osm.pbf}.osrm.partition" ] && docker run -t -v "${PWD}:/data" osrm/osrm-backend:v5.27.1 osrm-partition /data/${OSM_FILE%.osm.pbf}.osrm
[ ! -f "${OSM_FILE%.osm.pbf}.osrm.mldgr" ] && docker run -t -v "${PWD}:/data" osrm/osrm-backend:v5.27.1 osrm-customize /data/${OSM_FILE%.osm.pbf}.osrm

echo "=== Setup Complete ==="
echo "Next: docker compose up -d"
