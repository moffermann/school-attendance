
#!/usr/bin/env python3
import json, shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
shared = root / "data" / "shared"
targets = {
    "web-app": root / "data" / "web-app",
    "kiosk-app": root / "data" / "kiosk-app",
    "teacher-pwa": root / "data" / "teacher-pwa",
}

# Map of shared files to per-app copies (only when names match).
# You can extend this mapping if you want to transform or filter fields per app.
for app, dst in targets.items():
    for f in shared.glob("*.json"):
        # Only copy if the destination already has a file with the same name (we treat shared as source of truth for that file)
        dest_file = dst / f.name
        if dest_file.exists():
            shutil.copy2(f, dest_file)
            print(f"Copied {f.name} -> {app}/data")

print("Done. Shared data synchronized to apps where filenames matched.")
