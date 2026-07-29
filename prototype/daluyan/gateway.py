"""SMS gateway adapters.
- MockGateway (default): full loop with zero SMS spend; deterministic ~8% transient failures
  so the retry queue and unreached list are demonstrable.
- SemaphoreGateway: real outbound via api.semaphore.co (OUTBOUND ONLY - verified Jul 2026).
  Inbound always arrives via POST /inbound webhook (Android SIM gateway in the pilot,
  engageSPARK toll-free number at graduation). Semaphore cannot receive SMS.
"""
import os, hashlib

class MockGateway:
    name = "mock"
    def send(self, phone: str, body: str, priority: bool = False, attempt: int = 0):
        # Deterministic pseudo-failure: same phone+attempt always behaves the same (demoable).
        h = int(hashlib.md5(f"{phone}:{attempt}".encode()).hexdigest(), 16) % 100
        if h < 8 and not priority:
            return False, "MOCK_NETWORK_TIMEOUT (simulated congestion - retry queue will pick this up)"
        return True, ""

class SemaphoreGateway:
    name = "semaphore"
    BASE = "https://api.semaphore.co/api/v4"
    def __init__(self):
        self.key = os.environ["SEMAPHORE_API_KEY"]
        self.sender = os.environ.get("SEMAPHORE_SENDER", "")
    def send(self, phone, body, priority=False, attempt=0):
        import requests
        ep = "/priority" if priority else "/messages"   # priority = 2 credits, bypasses queue
        data = {"apikey": self.key, "number": phone, "message": body}
        if self.sender:
            data["sendername"] = self.sender
        try:
            r = requests.post(self.BASE + ep, data=data, timeout=20)
            if r.status_code == 200:
                return True, ""
            return False, f"HTTP {r.status_code}: {r.text[:120]}"
        except Exception as e:
            return False, f"{type(e).__name__}: {e}"

def get_gateway():
    if os.environ.get("SEMAPHORE_API_KEY"):
        return SemaphoreGateway()
    return MockGateway()
