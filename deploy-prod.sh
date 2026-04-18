#!/bin/bash
# ============================================================
# Orion + UI-Engine Production Deployment Wrapper
# ============================================================

set -e

# Configuration
UI_ENGINE_DIR="/home/guest/Desktop/Code/SPAR-UI-Engine"
ORION_PORTAL_DIR="/home/guest/Desktop/Code/SPAR-ORION-Portal"

echo "=== Starting Production Deployment Preparation ==="

# 1. Inject Orion into UI-Engine
echo "--- Injecting Orion Module ---"
cd "$ORION_PORTAL_DIR"
bash deploy.sh "$UI_ENGINE_DIR"

# 2. Build the Docker Image
echo "--- Building SPAR-UI-Engine Production Image ---"
cd "$UI_ENGINE_DIR"
docker compose -f docker-compose.prod.yml build spar-ui-engine

echo "--- Deployment Preparation Complete ---"
echo "To start the application, run:"
echo "docker compose -f docker-compose.prod.yml up -d"
