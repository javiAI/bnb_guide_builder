#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAX = ROOT / "taxonomies"
errors = []

required = [
    "property_types.json",
    "room_types.json",
    "policy_taxonomy.json",
    "access_methods.json",
    "amenity_taxonomy.json",
    "amenity_subtypes.json",
    "troubleshooting_taxonomy.json",
    "messaging_touchpoints.json",
    "guide_outputs.json",
    "visibility_levels.json",
    "media_requirements.json",
    "space_types.json",
    "dynamic_field_rules.json",
    "automation_channels.json",
    "media_asset_roles.json",
    "review_reasons.json",
]

for name in required:
    path = TAX / name
    if not path.exists():
        errors.append(f"Falta taxonomía requerida: {name}")
        continue
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("locale") != "es-ES":
        errors.append(f"{name}: locale debe ser es-ES")
    if data.get("units_system") != "metric":
        errors.append(f"{name}: units_system debe ser metric")
    ids = set()
    for collection_key in ["items", "groups", "subtypes"]:
        if isinstance(data.get(collection_key), list):
            for item in data[collection_key]:
                if "id" in item:
                    if item["id"] in ids:
                        errors.append(f"{name}: ID duplicado {item['id']}")
                    ids.add(item["id"])
                required_keys = ["label", "description"]
                if name == "dynamic_field_rules.json":
                    required_keys = ["rationale"]
                for key in required_keys:
                    if key not in item:
                        errors.append(f"{name}: falta {key} en {item.get('id', '<sin id>')}")

if errors:
    print("TAXONOMY RUNTIME VALIDATION FAILED")
    for error in errors:
        print(f"- ERROR: {error}")
    sys.exit(1)

print("TAXONOMY RUNTIME VALIDATION OK")
