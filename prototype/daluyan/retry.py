"""Outbox retry worker: exponential backoff, max 5 attempts, then 'unreached'
(first-class output -> tanod door-knock list). DEMO_FAST=1 uses seconds not minutes."""
import threading, time, datetime, os
from . import db

MAX_ATTEMPTS = 5

def _backoff(attempt: int) -> int:
    unit = 5 if os.environ.get("DEMO_FAST") else 60
    return unit * (2 ** attempt)          # 5s,10s,20s,40s (demo) / 1,2,4,8 min (prod)

def process_once(c, gateway):
    now = db.now()
    rows = c.execute(
        "SELECT * FROM sends WHERE status IN ('queued','failed') AND attempts < ? "
        "AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY id LIMIT 200",
        (MAX_ATTEMPTS, now)).fetchall()
    for s in rows:
        alert = c.execute("SELECT severity FROM alerts WHERE id=?", (s["alert_id"],)).fetchone()
        priority = bool(alert and alert["severity"] == "critical")
        ok, err = gateway.send(s["phone"], s["body"], priority=priority, attempt=s["attempts"])
        attempts = s["attempts"] + 1
        if ok:
            c.execute("UPDATE sends SET status='sent', attempts=?, gateway=?, error='', updated_at=? WHERE id=?",
                      (attempts, gateway.name, db.now(), s["id"]))
        else:
            if attempts >= MAX_ATTEMPTS:
                # Exhausted: mark unreached + flag manual/native-carrier fallback (pilot procedure).
                c.execute("UPDATE sends SET status='unreached', attempts=?, error=?, updated_at=? WHERE id=?",
                          (attempts, err + " | FALLBACK_REQUIRED: use native-carrier phone / door-knock", db.now(), s["id"]))
            else:
                nxt = (datetime.datetime.now() + datetime.timedelta(seconds=_backoff(attempts))).strftime("%Y-%m-%d %H:%M:%S")
                c.execute("UPDATE sends SET status='failed', attempts=?, next_attempt_at=?, error=?, updated_at=? WHERE id=?",
                          (attempts, nxt, err, db.now(), s["id"]))
    c.commit()
    return len(rows)

def start(gateway):
    def loop():
        c = db.conn()
        while True:
            try:
                process_once(c, gateway)
            except Exception as e:
                print("retry worker error:", e)
            time.sleep(2 if os.environ.get("DEMO_FAST") else 15)
    t = threading.Thread(target=loop, daemon=True)
    t.start()
    return t
