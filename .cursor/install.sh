#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f package.json ]; then
  echo "No Node.js project on this revision; skipping npm install"
  exit 0
fi

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
