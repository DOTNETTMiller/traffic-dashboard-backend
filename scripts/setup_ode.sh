#!/bin/bash
#
# ODE (Operational Data Environment) Setup Script
#
# Deploys USDOT ITS JPO ODE for V2X TIM broadcasting
#
# Usage:
#   ./scripts/setup_ode.sh [local|docker|aws]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "════════════════════════════════════════════════════════════════"
echo "  USDOT ITS JPO ODE Setup - V2X TIM Broadcasting"
echo "════════════════════════════════════════════════════════════════"
echo -e "${NC}"

# Detect deployment type
DEPLOYMENT_TYPE="${1:-local}"

case $DEPLOYMENT_TYPE in
  local)
    echo -e "${YELLOW}Deployment Type: Local Docker${NC}\n"
    ;;
  docker)
    echo -e "${YELLOW}Deployment Type: Docker Production${NC}\n"
    ;;
  aws)
    echo -e "${YELLOW}Deployment Type: AWS Cloud${NC}\n"
    ;;
  *)
    echo -e "${RED}Invalid deployment type: $DEPLOYMENT_TYPE${NC}"
    echo "Usage: $0 [local|docker|aws]"
    exit 1
    ;;
esac

# Check prerequisites
echo -e "${BLUE}Checking Prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found${NC}"
    echo "  Install: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✓ Docker installed${NC}"

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found${NC}"
    echo "  Install: https://docs.docker.com/compose/install/"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose installed${NC}"

if ! command -v git &> /dev/null; then
    echo -e "${RED}✗ Git not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Git installed${NC}"

echo ""

# Clone ODE repository
ODE_DIR="../jpo-ode"

if [ -d "$ODE_DIR" ]; then
    echo -e "${YELLOW}ODE repository already exists at $ODE_DIR${NC}"
    read -p "Do you want to update it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$ODE_DIR"
        git pull
        cd -
    fi
else
    echo -e "${BLUE}Cloning USDOT ITS JPO ODE...${NC}"
    git clone https://github.com/usdot-jpo-ode/jpo-ode.git "$ODE_DIR"
    echo -e "${GREEN}✓ ODE repository cloned${NC}\n"
fi

# Navigate to ODE directory
cd "$ODE_DIR"

# Create custom configuration
echo -e "${BLUE}Creating ODE Configuration...${NC}"

cat > .env << 'EOF'
# ODE Configuration
DOCKER_HOST_IP=127.0.0.1

# Kafka
KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092

# ODE API
ODE_EXTERNAL_IPV4=127.0.0.1
ODE_EXTERNAL_IPV6=::1

# Security (change these in production!)
ODE_SECURITY_SVCS_SIGNATURE_URI=
ODE_RSU_USERNAME=
ODE_RSU_PASSWORD=

# Logging
SPRING_LOG_LEVEL=INFO

# Redis
REDIS_HOSTNAME=redis
EOF

echo -e "${GREEN}✓ Configuration created${NC}\n"

# Start ODE
echo -e "${BLUE}Starting ODE Services...${NC}"
echo -e "${YELLOW}This may take several minutes on first run...${NC}\n"

docker-compose up -d

# Wait for services to be ready
echo -e "\n${BLUE}Waiting for ODE to be ready...${NC}"
sleep 10

MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s http://localhost:8080/tim/count > /dev/null 2>&1; then
        echo -e "${GREEN}✓ ODE is ready!${NC}\n"
        break
    fi

    ATTEMPT=$((ATTEMPT+1))
    echo -n "."
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "\n${RED}✗ ODE failed to start within expected time${NC}"
    echo "Check logs: docker-compose logs"
    exit 1
fi

# Display ODE information
echo -e "${GREEN}"
echo "════════════════════════════════════════════════════════════════"
echo "  ODE Successfully Started!"
echo "════════════════════════════════════════════════════════════════"
echo -e "${NC}"

echo -e "${BLUE}ODE Endpoints:${NC}"
echo "  • API:        http://localhost:8080"
echo "  • TIM:        http://localhost:8080/tim"
echo "  • Web UI:     http://localhost:8080 (if available)"
echo ""

echo -e "${BLUE}Kafka:${NC}"
echo "  • Bootstrap:  localhost:9092"
echo "  • Topics:     topic.OdeTIMJson (outbound TIMs)"
echo ""

echo -e "${BLUE}Test ODE:${NC}"
echo "  curl http://localhost:8080/tim/count"
echo ""

# Create .env file for Corridor Communicator
cd - > /dev/null
ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
    if grep -q "ODE_BASE_URL" "$ENV_FILE"; then
        echo -e "${YELLOW}ODE_BASE_URL already exists in $ENV_FILE${NC}"
    else
        echo "" >> "$ENV_FILE"
        echo "# ODE Configuration" >> "$ENV_FILE"
        echo "ODE_BASE_URL=http://localhost:8080" >> "$ENV_FILE"
    fi
else
    cat > "$ENV_FILE" << EOF
# ODE Configuration
ODE_BASE_URL=http://localhost:8080
# ODE_API_KEY=your-api-key-if-required
EOF
fi

echo -e "${GREEN}✓ Environment file updated${NC}\n"

# Display next steps
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Start DOT Corridor Communicator:"
echo "     ${GREEN}npm start${NC}"
echo ""
echo "  2. Verify ODE connection in logs:"
echo "     Look for: ${GREEN}✅ Connected to ODE: http://localhost:8080${NC}"
echo ""
echo "  3. Test TIM generation:"
echo "     ${GREEN}curl -X POST http://localhost:3001/api/sensors/poll${NC}"
echo ""
echo "  4. Monitor ODE TIM count:"
echo "     ${GREEN}curl http://localhost:8080/tim/count${NC}"
echo ""

echo -e "${BLUE}Useful Commands:${NC}"
echo "  • Stop ODE:        ${YELLOW}cd $ODE_DIR && docker-compose down${NC}"
echo "  • View ODE logs:   ${YELLOW}cd $ODE_DIR && docker-compose logs -f${NC}"
echo "  • Restart ODE:     ${YELLOW}cd $ODE_DIR && docker-compose restart${NC}"
echo ""

echo -e "${GREEN}Setup Complete!${NC}"
