"""Single-number SMS smoke test. Bypasses the registry, zones and outbox entirely -
sends ONE message straight through the configured gateway, then prints the result.

  python smstest.py 09XXXXXXXXX ["custom message"]

Provider comes from the same env vars the app uses (SMS_PROVIDER + that provider's keys),
so a green result here proves the exact path a real alert will take.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from daluyan import gateway as gw, env

env.load()

DEFAULT_MSG = ("DALUYAN TEST: Ito ay pagsubok ng sistema ng babala ng barangay. "
               "Walang aksyon na kailangan. Mula sa Daluyan pilot.")

def main():
    if len(sys.argv) < 2:
        print("usage: python smstest.py 09XXXXXXXXX [\"message\"]")
        print("       (reads .env for SMS_PROVIDER + keys; env vars override)")
        return 2
    phone = sys.argv[1].strip()
    msg = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_MSG

    if not (phone.startswith("09") and len(phone) == 11 and phone.isdigit()) and not phone.startswith("+63"):
        print("! Phone should look like 09171234567 (or +639171234567). Got: %r" % phone)
        return 2
    if msg.strip().upper().startswith("TEST"):
        print("! Messages starting with the word TEST are silently dropped by PH networks.")
        print("  Using a safe prefix instead.")
        msg = "DALUYAN: " + msg

    try:
        g = gw.get_gateway()
    except SystemExit as e:
        print("! %s" % e); return 1

    print("Provider   : %s" % g.name)
    bal = None
    try:
        bal = g.balance()
    except Exception:
        pass
    print("Balance    : %s" % (bal if bal is not None else "(unavailable)"))
    if bal is not None and str(bal).strip().startswith("0 "):
        print("! Balance looks like zero - buy credits first or the send will fail.")
    print("Recipient  : %s" % phone)
    print("Message    : %s" % msg)
    print("Length     : %d chars (%d SMS segment(s))" % (len(msg), 1 if len(msg) <= 160 else (len(msg) + 152) // 153))
    if g.name == "mock":
        print("\n! MOCK provider - nothing real will be sent.")
        print("  Set SMS_PROVIDER (semaphore | iprog | philsms | unisms | traccar) + its key first,")
        print("  or use one of the run-*.bat launchers which set them for you.")
    print("\nSending...")
    ok, err = g.send(phone, msg, priority=False)
    if ok:
        print("RESULT     : ACCEPTED by %s%s" % (g.name, (" (%s)" % err) if err else ""))
        detail = getattr(g, "last", None)
        if isinstance(detail, dict):
            for label, key in (("Message ID ", "message_id"), ("Status     ", "status"),
                               ("Sender     ", "sender_name"), ("Network    ", "network")):
                if detail.get(key) not in (None, ""):
                    print("%s: %s" % (label, detail[key]))
            if detail.get("status", "").lower() in ("queued", "pending"):
                print("\n'Queued'/'Pending' is normal - it means the network has it.")
        print("\nThe gateway took the message. Watch the handset - PH delivery is usually")
        print("2-3 minutes. If nothing arrives, the blocker is downstream (sender ID not")
        print("approved, no credits, or network filtering), not your code.")
        bal2 = None
        try:
            bal2 = g.balance()
        except Exception:
            pass
        if bal2 is not None:
            print("Balance now: %s  (was %s - a drop of 1 confirms the send was billed)" % (bal2, bal))
        return 0
    print("RESULT     : FAILED")
    print("Error      : %s" % err)
    print("\nCommon causes: unapproved/blank sender name, zero credits, malformed number,")
    print("or content filtering (no links, no phone numbers, must not start with 'TEST').")
    return 1

if __name__ == "__main__":
    sys.exit(main())
