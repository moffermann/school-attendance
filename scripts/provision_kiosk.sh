#!/bin/bash
#
# Kiosk Provisioning Script
#
# This script provisions a new kiosk device by:
# 1. Generating/retrieving the device API key
# 2. Downloading initial data (students, tags, teachers)
# 3. Configuring the kiosk with backend connectivity
#
# Usage:
#   ./provision_kiosk.sh --api-url http://localhost:8000 --device-id DEV-01 --gate-id GATE-1 --output ./kiosk-config
#
# Environment variables (alternative to flags):
#   API_BASE_URL - Backend API URL
#   DEVICE_API_KEY - Pre-configured device key (optional, will prompt if not set)
#   ADMIN_EMAIL - Admin email for JWT login
#   ADMIN_PASSWORD - Admin password for JWT login

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
OUTPUT_DIR="./kiosk-data"
DEVICE_ID="DEV-01"
GATE_ID="GATE-1"
SCHOOL_NAME="Colegio Demo"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --api-url)
            API_BASE_URL="$2"
            shift 2
            ;;
        --device-id)
            DEVICE_ID="$2"
            shift 2
            ;;
        --gate-id)
            GATE_ID="$2"
            shift 2
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --school-name)
            SCHOOL_NAME="$2"
            shift 2
            ;;
        --device-key)
            DEVICE_API_KEY="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --api-url URL        Backend API URL (default: http://localhost:8000)"
            echo "  --device-id ID       Device identifier (default: DEV-01)"
            echo "  --gate-id ID         Gate identifier (default: GATE-1)"
            echo "  --output DIR         Output directory for config files (default: ./kiosk-data)"
            echo "  --school-name NAME   School name for display (default: Colegio Demo)"
            echo "  --device-key KEY     Device API key (optional, will use env or prompt)"
            echo "  --help               Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Kiosk Provisioning Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "API URL:     ${YELLOW}$API_BASE_URL${NC}"
echo -e "Device ID:   ${YELLOW}$DEVICE_ID${NC}"
echo -e "Gate ID:     ${YELLOW}$GATE_ID${NC}"
echo -e "Output Dir:  ${YELLOW}$OUTPUT_DIR${NC}"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR/data"

# Check if we have a device API key
if [ -z "$DEVICE_API_KEY" ]; then
    echo -e "${YELLOW}No DEVICE_API_KEY found in environment.${NC}"
    echo "Please enter the device API key (from backend .env file):"
    read -r DEVICE_API_KEY

    if [ -z "$DEVICE_API_KEY" ]; then
        echo -e "${RED}Error: Device API key is required${NC}"
        exit 1
    fi
fi

# Function to make authenticated requests
api_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"

    curl -s -X "$method" \
        -H "Content-Type: application/json" \
        -H "X-Device-Key: $DEVICE_API_KEY" \
        ${data:+-d "$data"} \
        "${API_BASE_URL}/api/v1${endpoint}"
}

# Test API connectivity
echo -e "${YELLOW}Testing API connectivity...${NC}"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE_URL}/api/v1/health" || echo "000")

if [ "$HEALTH_RESPONSE" != "200" ]; then
    echo -e "${RED}Error: Cannot connect to API at $API_BASE_URL (HTTP $HEALTH_RESPONSE)${NC}"
    echo -e "${YELLOW}Continuing with offline provisioning (mock data)...${NC}"
    OFFLINE_MODE=true
else
    echo -e "${GREEN}API connection successful${NC}"
    OFFLINE_MODE=false
fi

if [ "$OFFLINE_MODE" = true ]; then
    echo ""
    echo -e "${YELLOW}Running in offline mode - generating mock data${NC}"

    # Generate mock students.json
    cat > "$OUTPUT_DIR/data/students.json" << 'STUDENTS_EOF'
[
  {"id": 1, "full_name": "Juan Pérez González", "course_id": 1, "photo_ref": null, "photo_pref_opt_in": true},
  {"id": 2, "full_name": "María García López", "course_id": 1, "photo_ref": null, "photo_pref_opt_in": true},
  {"id": 3, "full_name": "Pedro Rodríguez Soto", "course_id": 2, "photo_ref": null, "photo_pref_opt_in": false},
  {"id": 4, "full_name": "Ana Martínez Díaz", "course_id": 2, "photo_ref": null, "photo_pref_opt_in": true},
  {"id": 5, "full_name": "Carlos Silva Mora", "course_id": 3, "photo_ref": null, "photo_pref_opt_in": true}
]
STUDENTS_EOF
    echo -e "  ${GREEN}✓${NC} Generated mock students.json"

    # Generate mock tags.json
    cat > "$OUTPUT_DIR/data/tags.json" << 'TAGS_EOF'
[
  {"token": "nfc_001", "student_id": 1, "status": "ACTIVE"},
  {"token": "nfc_002", "student_id": 2, "status": "ACTIVE"},
  {"token": "nfc_003", "student_id": 3, "status": "ACTIVE"},
  {"token": "nfc_004", "student_id": 4, "status": "ACTIVE"},
  {"token": "nfc_005", "student_id": 5, "status": "ACTIVE"},
  {"token": "qr_011", "student_id": 1, "status": "ACTIVE"},
  {"token": "qr_012", "student_id": 2, "status": "ACTIVE"},
  {"token": "nfc_teacher_001", "teacher_id": 1, "status": "ACTIVE"},
  {"token": "nfc_teacher_002", "teacher_id": 2, "status": "ACTIVE"},
  {"token": "qr_teacher_003", "teacher_id": 3, "status": "ACTIVE"}
]
TAGS_EOF
    echo -e "  ${GREEN}✓${NC} Generated mock tags.json"

    # Generate mock teachers.json
    cat > "$OUTPUT_DIR/data/teachers.json" << 'TEACHERS_EOF'
[
  {"id": 1, "full_name": "María González López"},
  {"id": 2, "full_name": "Pedro Ramírez Castro"},
  {"id": 3, "full_name": "Carmen Silva Morales"}
]
TEACHERS_EOF
    echo -e "  ${GREEN}✓${NC} Generated mock teachers.json"

else
    echo ""
    echo -e "${YELLOW}Downloading data from API...${NC}"

    # Try bootstrap endpoint first (single request for all data)
    echo -n "  Trying bootstrap endpoint... "
    BOOTSTRAP=$(api_request GET "/kiosk/bootstrap" 2>/dev/null || echo "")

    if echo "$BOOTSTRAP" | grep -q '"students"'; then
        echo -e "${GREEN}✓${NC}"

        # Extract and save each section using python
        echo -n "  Extracting students... "
        echo "$BOOTSTRAP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['students'], indent=2))" > "$OUTPUT_DIR/data/students.json" 2>/dev/null
        COUNT=$(grep -c '"id"' "$OUTPUT_DIR/data/students.json" 2>/dev/null || echo "0")
        echo -e "${GREEN}✓${NC} ($COUNT students)"

        echo -n "  Extracting tags... "
        echo "$BOOTSTRAP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['tags'], indent=2))" > "$OUTPUT_DIR/data/tags.json" 2>/dev/null
        COUNT=$(grep -c '"token"' "$OUTPUT_DIR/data/tags.json" 2>/dev/null || echo "0")
        echo -e "${GREEN}✓${NC} ($COUNT tags)"

        echo -n "  Extracting teachers... "
        echo "$BOOTSTRAP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['teachers'], indent=2))" > "$OUTPUT_DIR/data/teachers.json" 2>/dev/null
        COUNT=$(grep -c '"id"' "$OUTPUT_DIR/data/teachers.json" 2>/dev/null || echo "0")
        echo -e "${GREEN}✓${NC} ($COUNT teachers)"

    else
        echo -e "${YELLOW}Bootstrap failed, trying individual endpoints...${NC}"

        # Download students
        echo -n "  Downloading students... "
        STUDENTS=$(api_request GET "/kiosk/students" 2>/dev/null || echo "[]")
        if [ "$STUDENTS" != "[]" ] && [ -n "$STUDENTS" ]; then
            echo "$STUDENTS" > "$OUTPUT_DIR/data/students.json"
            COUNT=$(echo "$STUDENTS" | grep -o '"id"' | wc -l)
            echo -e "${GREEN}✓${NC} ($COUNT students)"
        else
            echo -e "${YELLOW}No data - using empty array${NC}"
            echo "[]" > "$OUTPUT_DIR/data/students.json"
        fi

        # Download tags
        echo -n "  Downloading tags... "
        TAGS=$(api_request GET "/kiosk/tags" 2>/dev/null || echo "[]")
        if [ "$TAGS" != "[]" ] && [ -n "$TAGS" ]; then
            echo "$TAGS" > "$OUTPUT_DIR/data/tags.json"
            COUNT=$(echo "$TAGS" | grep -o '"token"' | wc -l)
            echo -e "${GREEN}✓${NC} ($COUNT tags)"
        else
            echo -e "${YELLOW}No data - using empty array${NC}"
            echo "[]" > "$OUTPUT_DIR/data/tags.json"
        fi

        # Download teachers
        echo -n "  Downloading teachers... "
        TEACHERS=$(api_request GET "/kiosk/teachers" 2>/dev/null || echo "[]")
        if [ "$TEACHERS" != "[]" ] && [ -n "$TEACHERS" ]; then
            echo "$TEACHERS" > "$OUTPUT_DIR/data/teachers.json"
            COUNT=$(echo "$TEACHERS" | grep -o '"id"' | wc -l)
            echo -e "${GREEN}✓${NC} ($COUNT teachers)"
        else
            echo -e "${YELLOW}No data - using empty array${NC}"
            echo "[]" > "$OUTPUT_DIR/data/teachers.json"
        fi
    fi
fi

# Generate device.json
echo ""
echo -e "${YELLOW}Generating device configuration...${NC}"
cat > "$OUTPUT_DIR/data/device.json" << EOF
{
  "gate_id": "$GATE_ID",
  "device_id": "$DEVICE_ID",
  "version": "1.0.0",
  "battery_pct": 100,
  "online": true
}
EOF
echo -e "  ${GREEN}✓${NC} Generated device.json"

# Generate config.json
cat > "$OUTPUT_DIR/data/config.json" << EOF
{
  "photoEnabled": true,
  "highContrast": false,
  "schoolName": "$SCHOOL_NAME",
  "autoResumeDelay": 5000,
  "apiBaseUrl": "$API_BASE_URL/api/v1",
  "deviceApiKey": "$DEVICE_API_KEY"
}
EOF
echo -e "  ${GREEN}✓${NC} Generated config.json"

# Generate empty queue
cat > "$OUTPUT_DIR/data/queue.json" << EOF
[]
EOF
echo -e "  ${GREEN}✓${NC} Generated queue.json"

# Register device with heartbeat
if [ "$OFFLINE_MODE" = false ]; then
    echo ""
    echo -e "${YELLOW}Registering device with backend...${NC}"

    HEARTBEAT_PAYLOAD=$(cat << EOF
{
  "device_id": "$DEVICE_ID",
  "gate_id": "$GATE_ID",
  "firmware_version": "1.0.0",
  "battery_pct": 100,
  "pending_events": 0,
  "online": true
}
EOF
)

    HEARTBEAT_RESPONSE=$(api_request POST "/devices/heartbeat" "$HEARTBEAT_PAYLOAD" 2>/dev/null || echo "error")

    if echo "$HEARTBEAT_RESPONSE" | grep -q '"id"'; then
        DEVICE_DB_ID=$(echo "$HEARTBEAT_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
        echo -e "  ${GREEN}✓${NC} Device registered (DB ID: $DEVICE_DB_ID)"
    else
        echo -e "  ${YELLOW}!${NC} Could not register device (may already exist)"
    fi
fi

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Provisioning Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Generated files in $OUTPUT_DIR/data/:"
ls -la "$OUTPUT_DIR/data/"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Copy the contents of $OUTPUT_DIR/data/ to src/kiosk-app/data/"
echo "2. Open the kiosk app in a browser"
echo "3. The kiosk will automatically sync with the backend"
echo ""
echo -e "${YELLOW}To copy files:${NC}"
echo "  cp -r $OUTPUT_DIR/data/* src/kiosk-app/data/"
echo ""
