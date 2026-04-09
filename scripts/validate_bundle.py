#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "manifest.json"

errors = []

if not MANIFEST.exists():
    errors.append("Falta manifest.json")
else:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for section in [
        "required_docs",
        "required_taxonomies",
        "required_prompts",
        "required_skills",
        "required_scripts",
        "required_checks",
    ]:
      for rel in data.get(section, []):
        if not (ROOT / rel).exists():
          errors.append(f"manifest.json referencia archivo inexistente: {rel}")

for required_dir in ["docs", "prompts", "skills", "scripts", "taxonomies", "checks"]:
    if not (ROOT / required_dir).exists():
        errors.append(f"Falta directorio requerido: {required_dir}")

if errors:
    print("VALIDATION FAILED")
    for error in errors:
        print(f"- ERROR: {error}")
    sys.exit(1)

print("VALIDATION OK")
