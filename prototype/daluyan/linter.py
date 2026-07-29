"""Template/content linter encoding NTC MO 005-04-2023 + aggregator content rules
+ Daluyan safety guardrails. Hard-fails block sending."""
import re

URL_RE = re.compile(r"(https?://|www\.|bit\.ly|tinyurl|\w+\.(com|ph|net|org|io|co)\b)", re.I)
PHONE_RE = re.compile(r"\d{7,}")
BANNED = [r"\ball\s*clear\b", r"\bligtas\s+na\s+ang\s+lahat\b", r"\bwalang?\s+panganib\b", r"\bsafe\s+na\s+ang\s+lahat\b"]

def lint(body: str, filled: bool = False):
    """Returns (errors, warnings). Errors block send (NTC filtering / safety guardrails).
    filled=False lints a raw template (placeholders required);
    filled=True lints a ready-to-send body (placeholders must be resolved)."""
    errors, warnings = [], []
    if URL_RE.search(body):
        errors.append("Contains a link/URL - telcos block or filter these (NTC MO 005-04-2023).")
    if PHONE_RE.search(body):
        errors.append("Contains a phone-number-like digit run - filtered by aggregator rules. Use 'reply HELP' instead.")
    for pat in BANNED:
        if re.search(pat, body, re.I):
            errors.append("Banned phrase: never send 'all clear'-type copy (safety guardrail).")
    if filled:
        import re as _re
        if _re.search(r"\{\w+\}", body):
            errors.append("Unresolved placeholder left in message body.")
    else:
        if "{source}" not in body or "{asof}" not in body:
            errors.append("Template must cite {source} and {asof} (trust design vs scam-SMS era).")
    if len(body) > 306:
        warnings.append("Body may exceed 2 SMS segments after fill - consider shortening (cost + comprehension).")
    return errors, warnings
