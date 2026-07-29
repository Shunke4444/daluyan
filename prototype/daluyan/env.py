"""Minimal .env loader - no dependencies. Real environment variables always win,
so `SMS_PROVIDER=mock python -m daluyan.main` can override the file for one run."""
import os

def load(path=None):
    if path is None:
        path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.isfile(path):
        return {}
    loaded = {}
    with open(path, "r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key, val = key.strip(), val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val
                loaded[key] = val
    return loaded
