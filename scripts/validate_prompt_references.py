#!/usr/bin/env python3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROMPTS = ROOT / "prompts"
SKILLS = ROOT / "skills"

errors = []
corpus = ""
for path in list(PROMPTS.glob("*.md")) + [ROOT / "AGENTS.md", ROOT / "CLAUDE.md"]:
    corpus += path.read_text(encoding="utf-8") + "\n"

for prompt in PROMPTS.glob("*.md"):
    if prompt.name == "ORDER.md":
        continue
    text = prompt.read_text(encoding="utf-8")
    if "skills/" not in text:
        errors.append(f"{prompt.name}: no referencia skills")
    if "docs/" not in text and "taxonomies/" not in text:
        errors.append(f"{prompt.name}: no referencia docs o taxonomías")

for skill in SKILLS.glob("*/SKILL.md"):
    rel = str(skill.relative_to(ROOT))
    if rel not in corpus:
        errors.append(f"Skill no referenciada: {rel}")

if errors:
    print("PROMPT REF VALIDATION FAILED")
    for error in errors:
        print(f"- ERROR: {error}")
    sys.exit(1)

print("PROMPT REF VALIDATION OK")
