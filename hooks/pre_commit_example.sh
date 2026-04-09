#!/usr/bin/env bash
set -euo pipefail

python scripts/validate_bundle.py
python scripts/validate_prompt_references.py
python scripts/validate_metric_units.py
echo "Todos los checks han pasado."
