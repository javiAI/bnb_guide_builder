#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
order_text = (ROOT / "prompts" / "ORDER.md").read_text(encoding="utf-8")
errors = []

for rel in manifest.get("required_prompts", []):
    if Path(rel).name == "ORDER.md":
        continue
    if Path(rel).name not in order_text:
        errors.append(f"Prompt no incluido en ORDER.md: {rel}")

for rel in manifest.get("required_skills", []):
    if not (ROOT / rel).exists():
        errors.append(f"Skill requerida ausente: {rel}")

if errors:
    print("PHASE BUNDLE VALIDATION FAILED")
    for error in errors:
        print(f"- ERROR: {error}")
    sys.exit(1)

print("PHASE BUNDLE VALIDATION OK")
