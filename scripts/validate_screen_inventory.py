#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
screen_map = json.loads((ROOT / "screen_map.json").read_text(encoding="utf-8"))
screen_inventory = json.loads((ROOT / "screen_inventory.json").read_text(encoding="utf-8"))

errors = []

map_ids = {item["screen_id"] for item in screen_map}
inventory_ids = {item["screen_id"] for item in screen_inventory}

if map_ids != inventory_ids:
    errors.append("screen_map.json y screen_inventory.json no tienen los mismos screen_id")

routes = set()
for item in screen_map:
    route = item["route"]
    if route in routes:
        errors.append(f"Ruta duplicada en screen_map.json: {route}")
    routes.add(route)

required_keys = {
    "screen_id",
    "route",
    "title",
    "purpose",
    "entry_points",
    "layout",
    "components",
    "states",
    "primary_actions",
    "secondary_actions",
    "empty_state",
    "error_state",
    "success_state",
}

for item in screen_inventory:
    missing = required_keys - set(item.keys())
    if missing:
        errors.append(f"{item.get('screen_id', '<sin id>')} sin claves requeridas: {sorted(missing)}")

if errors:
    print("SCREEN INVENTORY VALIDATION FAILED")
    for error in errors:
        print(f"- ERROR: {error}")
    sys.exit(1)

print("SCREEN INVENTORY VALIDATION OK")
