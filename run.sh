#!/bin/bash

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
IMAGE_NAME="deliveryhub"
CONTAINER_NAME="deliveryhub"
MONGO_CONTAINER_NAME="mongo"
MONGO_NETWORK="delivery-network"
MONGO_URL="mongodb://admin:secretpassword@host.docker.internal:27017/delivery?authSource=admin"

# ─────────────────────────────────────────────
# Functions
# ─────────────────────────────────────────────

function show_help() {
  echo "Usage: ./run.sh [COMMAND] [OPTIONS]"
  echo ""
  echo "Commands:"
  echo "  (none)       Build (if needed) and run the DeliveryHub web app"
  echo "  mongo        Start the MongoDB container"
  echo ""
  echo "Options:"
  echo "  --rebuild, -r    Force delete and rebuild the DeliveryHub Docker image"
  echo "  --help,    -h    Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./run.sh              # Run DeliveryHub"
  echo "  ./run.sh -r           # Force rebuild and run DeliveryHub"
  echo "  ./run.sh mongo        # Start MongoDB"
}

function ensure_network() {
  if ! docker network inspect "$MONGO_NETWORK" > /dev/null 2>&1; then
    echo "🌐 Creating Docker network '$MONGO_NETWORK'..."
    docker network create "$MONGO_NETWORK"
    echo "✅ Network '$MONGO_NETWORK' created."
  else
    echo "✅ Network '$MONGO_NETWORK' already exists. Skipping."
  fi
}

function start_mongo() {
  ensure_network

  # Check if container is already running
  if docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER_NAME}$"; then
    echo "✅ MongoDB container '$MONGO_CONTAINER_NAME' is already running."
    return
  fi

  # Check if container exists but is stopped — restart it
  if docker ps -a --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER_NAME}$"; then
    echo "♻️  Restarting existing MongoDB container '$MONGO_CONTAINER_NAME'..."
    docker start "$MONGO_CONTAINER_NAME"
    echo "✅ MongoDB restarted."
    return
  fi

  # Create and start a fresh container
  echo "🚀 Starting fresh MongoDB container..."
  docker run -d \
    --name "$MONGO_CONTAINER_NAME" \
    --restart unless-stopped \
    -p 27017:27017 \
    -v mongo-data:/data/db \
    -e MONGO_INITDB_ROOT_USERNAME=admin \
    -e MONGO_INITDB_ROOT_PASSWORD=secretpassword \
    --network "$MONGO_NETWORK" \
    mongo:latest

  if [ $? -ne 0 ]; then
    echo "❌ Failed to start MongoDB. Exiting."
    exit 1
  fi
  echo "✅ MongoDB is running on port 27017."
}

function start_deliveryhub() {
  local FORCE_REBUILD=$1

  # Force rebuild: remove existing image
  if [ "$FORCE_REBUILD" = true ]; then
    echo "🗑️  Removing existing image '$IMAGE_NAME'..."
    docker rmi -f "$IMAGE_NAME" 2>/dev/null && echo "✅ Image removed." || echo "⚠️  No existing image to remove."
  fi

  # Build image only if it doesn't exist
  if ! docker image inspect "$IMAGE_NAME" > /dev/null 2>&1; then
    echo "🔨 Building Docker image '$IMAGE_NAME'..."
    docker build -t "$IMAGE_NAME" . --no-cache
    if [ $? -ne 0 ]; then
      echo "❌ Docker build failed. Exiting."
      exit 1
    fi
    echo "✅ Image built successfully."
  else
    echo "✅ Image '$IMAGE_NAME' already exists. Skipping build."
  fi

  # Remove any existing stopped container with the same name
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "🗑️  Removing existing container '$CONTAINER_NAME'..."
    docker rm -f "$CONTAINER_NAME"
  fi

  # Run the container
  echo "🚀 Starting DeliveryHub on http://localhost:3000 ..."
  docker run --name "$CONTAINER_NAME" \
    -p 3000:3000 \
    --env-file .env.local \
    -e MONGO_URL="$MONGO_URL" \
    -e OPENAI_API_KEY="${OPENAI_API_KEY}" \
    -e GEMINI_API_KEY="${GEMINI_API_KEY}" \
    -e OPENROUTER_API_KEY="${OPENROUTER_API_KEY}" \
    -e AI_DEFAULT_PROVIDER=OPEN_ROUTER \
    -e AUTO_BOOTSTRAP_BASELINE=true \
    "$IMAGE_NAME"
}

# ─────────────────────────────────────────────
# Argument parsing
# ─────────────────────────────────────────────
COMMAND=""
FORCE_REBUILD=false

for arg in "$@"; do
  case $arg in
    mongo)
      COMMAND="mongo"
      ;;
    --rebuild|-r)
      FORCE_REBUILD=true
      ;;
    --help|-h)
      show_help
      exit 0
      ;;
    *)
      echo "⚠️  Unknown argument: $arg"
      show_help
      exit 1
      ;;
  esac
done

# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
case $COMMAND in
  mongo)
    start_mongo
    ;;
  *)
    start_deliveryhub "$FORCE_REBUILD"
    ;;
esac