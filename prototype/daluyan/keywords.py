"""Fixed keyword router. Keyword-only by design - no NLP (Phase 1 guardrail).
Unknown replies are logged raw, never dropped."""
import re

ALIASES = {
    "SAFE":     ["SAFE", "LIGTAS", "OK", "OKAY", "AYOS", "LUWAS"],
    "EVAC":     ["EVAC", "LIKAS", "BAKWIT", "EVACUATE", "LUMIKAS"],
    "HELP":     ["HELP", "TULONG", "SAKLOLO", "TABANG"],
    "MEDICINE": ["MEDICINE", "GAMOT", "TAMBAL", "MEDISINA", "MED", "MEDS"],
    "STRANDED": ["STRANDED", "NAIPIT", "NAIIPIT", "NASTRANDED", "TRAPPED", "NAIPIT KAMI"],
}
_LOOKUP = {a: k for k, al in ALIASES.items() for a in al}

def parse(text: str):
    """Return canonical keyword or None. Tolerant: case, punctuation, extra words."""
    if not text:
        return None
    up = re.sub(r"[^A-Z0-9\s]", " ", text.upper())
    tokens = up.split()
    if not tokens:
        return None
    if tokens[0] in _LOOKUP:            # first word wins
        return _LOOKUP[tokens[0]]
    for t in tokens:                     # otherwise any recognized token
        if t in _LOOKUP:
            return _LOOKUP[t]
    return None
