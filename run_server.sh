#!/bin/bash
# Starts the Font AI Flask server
# Open http://localhost:5001 after running this

set -e
cd "$(dirname "$0")"

# Use system python3 (avoids broken .venv)
PYTHON=/usr/bin/python3

echo ""
echo "================================="
echo "  Font AI Server"
echo "  http://localhost:5001"
echo "================================="
echo ""

$PYTHON server.py
