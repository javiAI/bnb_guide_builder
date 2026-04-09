#!/usr/bin/env python3
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
patterns = [r"\binch(?:es)?\b", r"\bft\b", r"\bfeet\b", r"\byards?\b", r"\bmiles?\b", r"\bpounds?\b", r"\blbs?\b"]
errors = []

EXCLUDED_DIRS = {"node_modules", ".next", ".git", "out", "build", "dist"}

for path in ROOT.rglob("*"):
    if path.is_dir() or path.suffix.lower() not in {".md", ".json", ".py", ".txt", ".sh"}:
        continue
    if any(part in EXCLUDED_DIRS for part in path.relative_to(ROOT).parts):
        continue
    text = path.read_text(encoding="utf-8", errors="ignore")
    for pattern in patterns:
        if re.search(pattern, text, flags=re.IGNORECASE):
            errors.append(f"{path.relative_to(ROOT)} contiene unidad imperial: {pattern}")

if errors:
    print("METRIC UNIT VALIDATION FAILED")
    for error in errors:
        print(f"- ERROR: {error}")
    sys.exit(1)

print("METRIC UNIT VALIDATION OK")
