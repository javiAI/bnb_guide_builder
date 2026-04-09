# VALIDATION_REPORT

## Bundle validators

### validate_bundle.py

- exit_code: 0
- stdout:
```
VALIDATION OK
```

### validate_prompt_references.py

- exit_code: 0
- stdout:
```
PROMPT REF VALIDATION OK
```

### validate_metric_units.py

- exit_code: 0
- stdout:
```
METRIC UNIT VALIDATION OK
```

### validate_screen_inventory.py

- exit_code: 0
- stdout:
```
SCREEN INVENTORY VALIDATION OK
```

### validate_taxonomy_runtime.py

- exit_code: 0
- stdout:
```
TAXONOMY RUNTIME VALIDATION OK
```

### validate_phase_bundle.py

- exit_code: 0
- stdout:
```
PHASE BUNDLE VALIDATION OK
```

## Repo-level checks

### npm run lint

- exit_code: 0

### npm run typecheck

- exit_code: 0

### npm run test

- exit_code: 0
- note: `23` test files, `57` tests passed

### python3 tools/check_doc_links.py

- exit_code: 0
- stdout:
```
All markdown references resolved.
```

### python3 tools/repo_sanity.py

- exit_code: 1
- note: fallo por residuo previo ajeno a `version_3`
- stderr/stdout:
```
Found macOS junk files/directories:
  - version_2/.DS_Store
```
