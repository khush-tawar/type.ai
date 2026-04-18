#!/bin/bash
# Starts the Font AI Flask server
# Open http://localhost:5001 after running this

set -e
cd "$(dirname "$0")"

# Prefer project venv for consistent dependencies, fallback to system python3
if [ -x "./.venv/bin/python" ] && "./.venv/bin/python" -c "import flask" >/dev/null 2>&1; then
	PYTHON="./.venv/bin/python"
else
	PYTHON="/usr/bin/python3"
fi

echo ""
echo "================================="
echo "  Font AI Server"
echo "  http://localhost:5001"
echo "================================="
echo ""

"$PYTHON" server.py
