#!/bin/bash

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
IMAGE_NAME="deliveryhub"
CONTAINER_NAME="deliveryhub"
MONGO_CONTAINER_NAME="mongo"
MONGO_NETWORK="delivery-network"
MONGO_URL="mongodb://admin:secretpassword@host.docker.internal:27017/delivery?authSource=admin"

DOCS_SITE_NAME="delivery"
DOCS_FOLDER="docs"

# ─────────────────────────────────────────────
# Functions
# ─────────────────────────────────────────────

function show_help() {
  echo "Usage: ./run.sh [COMMAND] [OPTIONS]"
  echo ""
  echo "Commands:"
  echo "  (none)       Build (if needed) and run the DeliveryHub web app"
  echo "  mongo        Start the MongoDB container"
  echo "  docinit         Initial Netlify setup: login, create site and link to it"
  echo "  docs            Build the MkDocs site and deploy it to Netlify production"
  echo ""
  echo "Options:"
  echo "  --rebuild, -r    Force delete and rebuild the DeliveryHub Docker image"
  echo "  --help,    -h    Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./run.sh              # Run DeliveryHub"
  echo "  ./run.sh -r           # Force rebuild and run DeliveryHub"
  echo "  ./run.sh mongo        # Start MongoDB"
  echo "  ./run.sh docinit      # Initial Netlify docs setup (site: $DOCS_SITE_NAME, folder: $DOCS_FOLDER)"
  echo "  ./run.sh docs         # Build and deploy docs to Netlify"
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

function docs_setup() {
  # Check dependencies
  if ! command -v netlify &>/dev/null; then
    echo "❌ Netlify CLI not found. Install it with: npm install -g netlify-cli"
    exit 1
  fi
  if ! command -v mkdocs &>/dev/null; then
    echo "❌ mkdocs not found. Install it with: pip install mkdocs"
    exit 1
  fi
  if [[ ! -f "${DOCS_FOLDER}/mkdocs.yml" ]]; then
    echo "❌ mkdocs.yml not found in '${DOCS_FOLDER}/'. Are you in the repo root?"
    exit 1
  fi

  echo "🔐 Logging in to Netlify..."
  netlify login || { echo "❌ Login failed"; exit 1; }

  echo "🌐 Creating Netlify site: ${DOCS_SITE_NAME}..."
  netlify sites:create --name "${DOCS_SITE_NAME}" || { echo "❌ Site creation failed"; exit 1; }

  echo "🔗 Linking project to site: ${DOCS_SITE_NAME}..."
  netlify link --name "${DOCS_SITE_NAME}" || { echo "❌ Linking failed"; exit 1; }

  echo ""
  echo "✅ Setup complete!"
  echo "   Site URL : https://${DOCS_SITE_NAME}.netlify.app"
  echo "   Run './run.sh docs' whenever you want to publish your docs."
}

function docs_deploy() {
  local docs_dir="${1:-docs}"

  # Check dependencies
  if ! command -v netlify &>/dev/null; then
    echo "❌ Netlify CLI not found. Install it with: npm install -g netlify-cli"
    exit 1
  fi
  if ! command -v mkdocs &>/dev/null; then
    echo "❌ mkdocs not found. Install it with: pip install mkdocs"
    exit 1
  fi
  if [[ ! -f "${docs_dir}/mkdocs.yml" ]]; then
    echo "❌ mkdocs.yml not found in '${docs_dir}/'. Are you in the repo root?"
    exit 1
  fi
  if [[ ! -f ".netlify/state.json" ]]; then
    echo "❌ No linked Netlify site found. Run './run.sh docinit <site-name>' first."
    exit 1
  fi

  echo "🔨 Building docs from '${docs_dir}'..."
  mkdocs build --config-file "${docs_dir}/mkdocs.yml" --site-dir "${docs_dir}/site" \
    || { echo "❌ Build failed"; exit 1; }

  echo "🚀 Deploying to Netlify (production)..."
  netlify deploy --dir="${docs_dir}/site" --prod \
    || { echo "❌ Deployment failed"; exit 1; }

  echo ""
  echo "✅ Docs deployed successfully!"
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
    docinit)
      COMMAND="docinit"
      ;;
    docs)
      COMMAND="docs"
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
  docinit)
    docs_setup
    ;;
  docs)
    docs_deploy
    ;;
  *)
    start_deliveryhub "$FORCE_REBUILD"
    ;;
esac