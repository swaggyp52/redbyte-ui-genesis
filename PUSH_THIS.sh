#!/usr/bin/env bash
set -euo pipefail

branch="${1:-main}"

echo "[push] branch status"
git status -sb

echo "[push] recent commits"
git log --oneline -20

echo "[push] repository checks"
pnpm repo:status
pnpm gates:import-roundtrip
pnpm -s rc:d2:basys3-bundle-gate

echo "[push] pushing to origin/${branch}"
git push origin "${branch}"
