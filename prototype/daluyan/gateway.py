"""SMS gateway adapters - REAL providers, selected via env. No mock required for production.

  SMS_PROVIDER = mock | semaphore | unisms | philsms      (default: semaphore if key set, else mock)
  SMS_FALLBACK = <second provider>                        (optional hot-standby, tried if primary fails)

Provider env:
  SEMAPHORE_API_KEY + SEMAPHORE_SENDER      (semaphore.co - outbound only, PHP0.56/SMS, priority route)
  UNISMS_API_KEY   + UNISMS_SENDER          (unismsapi.com - outbound only, PHP0.50/0.35 VAT-inc,
                                             Basic auth: key as username, empty password)
  PHILSMS_API_TOKEN + PHILSMS_SENDER        (app.philsms.com - outbound, Bearer token, from PHP0.35)

All PH providers require a REGISTERED alphanumeric sender ID (telcos hard-block unregistered
IDs since Apr 2025). Register the sender name FIRST - it is the critical path (2-3 days claimed
on PhilSMS, up to weeks elsewhere). Inbound stays on the Android SIM gateway webhook (POST /inbound);
none of these outbound providers has a documented inbound webhook (verified 2026-07-15).
"""
import os, hashlib

TIMEOUT = 20

def _require(var):
    """Fetch a required credential, treating blank/placeholder values as missing."""
    val = (os.environ.get(var) or "").strip()
    if not val or val.lower() in ("changeme", "your_key_here", "none"):
        raise SystemExit(
            "SMS provider needs %s but it is empty.\n"
            "  Edit prototype/.env so the line reads e.g.  %s=abc123def456\n"
            "  (no quotes, no spaces around '=', and no trailing comment)" % (var, var))
    return val

class MockGateway:
    name = "mock"
    def send(self, phone, body, priority=False, attempt=0):
        h = int(hashlib.md5(("%s:%s" % (phone, attempt)).encode()).hexdigest(), 16) % 100
        if h < 8 and not priority:
            return False, "MOCK_NETWORK_TIMEOUT (simulated congestion - retry queue will pick this up)"
        return True, ""
    def balance(self):
        return "unlimited (mock)"

class SemaphoreGateway:
    """semaphore.co - verified outbound-only (Jul 2026). Priority route = 2 credits, bypasses queue."""
    name = "semaphore"
    BASE = "https://api.semaphore.co/api/v4"
    def __init__(self):
        self.key = _require("SEMAPHORE_API_KEY")
        self.sender = os.environ.get("SEMAPHORE_SENDER", "").strip()
        self.last = None          # parsed API response of the most recent send
    def send(self, phone, body, priority=False, attempt=0):
        import requests
        data = {"apikey": self.key, "number": phone, "message": body}
        if self.sender:
            data["sendername"] = self.sender
        try:
            r = requests.post(self.BASE + ("/priority" if priority else "/messages"), data=data, timeout=TIMEOUT)
            if r.status_code == 200:
                try:
                    j = r.json()
                except Exception:
                    self.last = None
                    return False, ("semaphore returned HTTP 200 but the body is not JSON - "
                                   "usually an invalid or empty API key. Body: %s" % r.text[:160])
                self.last = j[0] if isinstance(j, list) and j else j
                if not (isinstance(self.last, dict) and self.last.get("message_id")):
                    return False, ("semaphore accepted the request but returned no message_id "
                                   "(check API key / sender name). Body: %s" % str(j)[:160])
                return True, ""
            return False, "semaphore HTTP %s: %s" % (r.status_code, r.text[:160])
        except Exception as e:
            return False, "semaphore %s: %s" % (type(e).__name__, e)
    def balance(self):
        import requests
        try:
            r = requests.get(self.BASE + "/account", params={"apikey": self.key}, timeout=TIMEOUT)
            j = r.json()
            if isinstance(j, list):
                j = j[0] if j else {}
            bal = j.get("credit_balance", j.get("credits"))
            return "%s credits" % bal if bal is not None else None
        except Exception:
            return None

class UniSMSGateway:
    """unismsapi.com - documented REST API (docs fetched 2026-07-15).
    Auth: HTTP Basic, API secret key as username, EMPTY password.
    Single send POST /api/sms; per-recipient statuses: pending|retrying|sent|failed.
    NOTE: 'sent' = submitted to carrier (no handset DLR). Outbound only. Failed sends refunded."""
    name = "unisms"
    BASE = "https://unismsapi.com/api"
    def __init__(self):
        self.key = _require("UNISMS_API_KEY")
        self.sender = _require("UNISMS_SENDER")   # sender_id is REQUIRED on every send
    def send(self, phone, body, priority=False, attempt=0):
        import requests
        payload = {"content": body, "sender_id": self.sender, "recipient": phone,
                   "metadata": {"app": "daluyan", "priority": bool(priority)}}
        try:
            r = requests.post(self.BASE + "/sms", json=payload, auth=(self.key, ""), timeout=TIMEOUT)
            if r.status_code in (200, 201):
                msg = (r.json() or {}).get("message", {})
                if msg.get("status") == "failed":
                    return False, "unisms failed: %s" % msg.get("fail_reason")
                return True, ""
            return False, "unisms HTTP %s: %s" % (r.status_code, r.text[:120])
        except Exception as e:
            return False, "unisms %s: %s" % (type(e).__name__, e)
    def balance(self):
        import requests
        try:
            r = requests.get(self.BASE + "/account", auth=(self.key, ""), timeout=TIMEOUT)
            return "%s credits" % r.json().get("sms_credits", "?")
        except Exception:
            return None

class PhilSMSGateway:
    """app.philsms.com - documented REST API (docs fetched 2026-07-15).
    Auth: Authorization: Bearer <token>. Bulk = comma-separated recipients (single call).
    Two-way is marketed but undocumented - treat as outbound only."""
    name = "philsms"
    BASE = "https://app.philsms.com/api/v3"
    def __init__(self):
        self.token = _require("PHILSMS_API_TOKEN")
        self.sender = os.environ.get("PHILSMS_SENDER", "PhilSMS")
    def _headers(self):
        return {"Authorization": "Bearer %s" % self.token, "Accept": "application/json",
                "Content-Type": "application/json"}
    def send(self, phone, body, priority=False, attempt=0):
        import requests
        # PhilSMS expects 63-prefixed numbers
        to = "63" + phone[1:] if phone.startswith("09") else phone.lstrip("+")
        payload = {"recipient": to, "sender_id": self.sender, "type": "plain", "message": body}
        try:
            r = requests.post(self.BASE + "/sms/send", json=payload, headers=self._headers(), timeout=TIMEOUT)
            j = {}
            try:
                j = r.json()
            except Exception:
                pass
            if r.status_code == 200 and j.get("status") == "success":
                return True, ""
            return False, "philsms HTTP %s: %s" % (r.status_code, str(j.get("message") or r.text)[:120])
        except Exception as e:
            return False, "philsms %s: %s" % (type(e).__name__, e)
    def balance(self):
        import requests
        try:
            r = requests.get(self.BASE + "/balance", headers=self._headers(), timeout=TIMEOUT)
            j = r.json()
            return str(j.get("data") or j)[:60]
        except Exception:
            return None

class ChainGateway:
    """Failover: try primary; if it fails, immediately try the standby on the same attempt.
    The retry worker still handles transient retries with backoff on top of this."""
    def __init__(self, primary, standby):
        self.primary, self.standby = primary, standby
        self.name = "%s->%s" % (primary.name, standby.name)
    def send(self, phone, body, priority=False, attempt=0):
        ok, err = self.primary.send(phone, body, priority=priority, attempt=attempt)
        if ok:
            return True, ""
        ok2, err2 = self.standby.send(phone, body, priority=priority, attempt=attempt)
        if ok2:
            return True, "primary failed (%s); delivered via standby %s" % (err, self.standby.name)
        return False, "%s | standby %s" % (err, err2)
    def balance(self):
        b1, b2 = self.primary.balance(), self.standby.balance()
        return "%s: %s / %s: %s" % (self.primary.name, b1, self.standby.name, b2)


class SmsGateGateway:
    """SMS Gateway for Android (SMSGate, capcom6) - docs.sms-gate.app, verified 2026-07-15.
    A spare Android phone + its SIM becomes the gateway: effectively FREE with an unli-text
    promo (~PHP15). Two modes, same API shape:
      - Local:  SMSGATE_URL=http://<phone-ip>:8080          (phone + server on same Wi-Fi)
      - Cloud:  SMSGATE_URL=https://api.sms-gate.app/3rdparty/v1   (default; works anywhere)
    Auth: Basic (login/password shown in the app). Bonus: the same app webhooks incoming
    SMS to POST /inbound (sms:received) - this is also the pilot's two-way channel.
    Limits: consumer SIM; keep bursts small (the app rate-limits; priority>=100 expedites).
    Suitable for <=30-50 recipient validation tests, NOT for full-barangay production waves."""
    name = "smsgate"
    def __init__(self):
        self.base = os.environ.get("SMSGATE_URL", "https://api.sms-gate.app/3rdparty/v1").rstrip("/")
        if not self.base.endswith("/3rdparty/v1") and "sms-gate.app" not in self.base:
            self.base += "/3rdparty/v1"   # local mode: http://<phone-ip>:8080 -> .../3rdparty/v1
        self.auth = (os.environ["SMSGATE_LOGIN"], os.environ["SMSGATE_PASSWORD"])
    def send(self, phone, body, priority=False, attempt=0):
        import requests
        to = "+63" + phone[1:] if phone.startswith("09") else phone
        payload = {"textMessage": {"text": body}, "phoneNumbers": [to],
                   "priority": 100 if priority else 0, "ttl": 3600}
        try:
            r = requests.post(self.base + "/messages", json=payload, auth=self.auth, timeout=TIMEOUT)
            if 200 <= r.status_code < 300:
                return True, ""
            return False, "smsgate HTTP %s: %s" % (r.status_code, r.text[:120])
        except Exception as e:
            return False, "smsgate %s: %s" % (type(e).__name__, e)
    def balance(self):
        return "SIM promo (unmetered)"


class TraccarGateway:
    """Traccar SMS Gateway (Play Store: org.traccar.gateway, by Tananaev Solutions/Traccar,
    open-source since 2009). Verified 2026-07-15 at traccar.org/http-sms-api.
    The SAFE no-sideload option: install from Google Play, open app, copy the cloud TOKEN.
      Cloud:  TRACCAR_TOKEN=<token from app>                     (default URL traccar.org/sms/)
      Local:  TRACCAR_URL=http://<phone-ip>:8082  TRACCAR_TOKEN=<API key from app>  (same Wi-Fi)
    SEND-ONLY: no inbound webhook - use for outbound validation; replies need SMSGate
    (sideload) or the paid inbound path. Consumer SIM: keep tests <=30-50 recipients."""
    name = "traccar"
    def __init__(self):
        self.url = os.environ.get("TRACCAR_URL", "https://www.traccar.org/sms/")
        self.token = _require("TRACCAR_TOKEN")
    def send(self, phone, body, priority=False, attempt=0):
        import requests
        to = "+63" + phone[1:] if phone.startswith("09") else phone
        try:
            r = requests.post(self.url, json={"to": to, "message": body},
                              headers={"Authorization": self.token}, timeout=TIMEOUT)
            if 200 <= r.status_code < 300:
                return True, ""
            return False, "traccar HTTP %s: %s" % (r.status_code, r.text[:120])
        except Exception as e:
            return False, "traccar %s: %s" % (type(e).__name__, e)
    def balance(self):
        return "SIM plan (phone gateway)"


class IprogGateway:
    """IPROG SMS (iprogsms.com, IPROG TECH) - verified 2026: PHP1/SMS, packages from PHP100,
    credits never expire, free KYC trial credits. Docs fetched 2026-07-22.
    CHEAPEST pay-per-use entry point for small drills. LIMIT: shared sender 'iprogSMS'
    reaches Globe/TM/DITO/GOMO only - Smart/TNT recipients need your own approved sender
    name (free to request). Use their /phone_numbers/detect endpoint to audit the registry.
    Env: IPROG_API_TOKEN"""
    name = "iprog"
    BASE = "https://www.iprogsms.com/api/v1"
    def __init__(self):
        self.token = _require("IPROG_API_TOKEN")
    def send(self, phone, body, priority=False, attempt=0):
        import requests
        payload = {"api_token": self.token, "phone_number": phone, "message": body}
        try:
            r = requests.post(self.BASE + "/sms_messages", json=payload, timeout=TIMEOUT)
            j = {}
            try:
                j = r.json()
            except Exception:
                pass
            if r.status_code == 200 and str(j.get("status")) in ("200", "success"):
                return True, ""
            return False, "iprog HTTP %s: %s" % (r.status_code, str(j.get("message") or r.text)[:120])
        except Exception as e:
            return False, "iprog %s: %s" % (type(e).__name__, e)
    def balance(self):
        import requests
        try:
            r = requests.get(self.BASE + "/account/sms_credits", params={"api_token": self.token}, timeout=TIMEOUT)
            return "%s credits" % r.json().get("data", {}).get("load_balance", "?")
        except Exception:
            return None

_REGISTRY = {"mock": MockGateway, "semaphore": SemaphoreGateway,
             "unisms": UniSMSGateway, "philsms": PhilSMSGateway,
             "smsgate": SmsGateGateway, "android": SmsGateGateway, "traccar": TraccarGateway,
             "iprog": IprogGateway}

def _make(name):
    name = name.strip().lower()
    if name not in _REGISTRY:
        raise SystemExit("Unknown SMS_PROVIDER '%s' (choose: %s)" % (name, ", ".join(_REGISTRY)))
    try:
        return _REGISTRY[name]()
    except KeyError as e:
        raise SystemExit("SMS provider '%s' selected but env var %s is not set" % (name, e))

def get_gateway():
    prov = os.environ.get("SMS_PROVIDER", "").strip().lower()
    if not prov:
        prov = "semaphore" if os.environ.get("SEMAPHORE_API_KEY") else "mock"
    gw = _make(prov)
    fb = os.environ.get("SMS_FALLBACK", "").strip().lower()
    if fb and fb != prov:
        gw = ChainGateway(gw, _make(fb))
    return gw
