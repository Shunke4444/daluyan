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

def show_senders(g):
    fn = getattr(g, "senders", None)
    if not fn:
        print("(%s has no sender-name lookup)" % g.name); return None
    rows = fn()
    if rows is None:
        print("Could not read sender names (API error or rate limit)."); return None
    if not rows:
        print("No Sender Names registered on this account.")
        print("  Semaphore refuses sends without one. Register at semaphore.co/account -")
        print("  up to 11 alphanumeric chars, tied to your org, approval up to 5 business days.")
        return None
    print("Registered Sender Names:")
    active = []
    for row in rows:
        name, status = row.get("name", "?"), row.get("status", "?")
        print("  - %-12s %s" % (name, status))
        if str(status).lower() in ("active", "approved"):
            active.append(name)
    return active

def main():
    # --provider X  overrides SMS_PROVIDER for this run only
    argv = sys.argv[1:]
    if argv and argv[0] in ("--provider", "-p") and len(argv) > 1:
        os.environ["SMS_PROVIDER"] = argv[1]
        argv = argv[2:]
    sys.argv = ["smstest.py"] + argv
    if argv and argv[0] in ("--senders", "-s"):
        try:
            g = gw.get_gateway()
        except SystemExit as e:
            print("CONFIG ERROR\n%s" % e); return 1
        print("Provider   : %s" % g.name)
        show_senders(g)
        return 0
    if not argv:
        print("usage: python smstest.py [--provider NAME] 09XXXXXXXXX [\"message\"]")
        print("       python smstest.py [--provider NAME] --senders")
        print("       providers: semaphore | iprog | philsms | unisms | traccar | mock")
        print("       (reads .env for SMS_PROVIDER + keys; flags and env vars override)")
        return 2
    phone = argv[0].strip()
    msg = argv[1] if len(argv) > 1 else DEFAULT_MSG

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
        print("CONFIG ERROR\n%s" % e); return 1

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
    if "sendername" in err.lower():
        print()
        active = show_senders(g)
        if active:
            print("\nRetrying with an active Sender Name: %s" % active[0])
            g.sender = active[0]
            ok2, err2 = g.send(phone, msg)
            if ok2:
                print("RESULT     : ACCEPTED using sender %s" % active[0])
                print("Put this in prototype/.env:  SEMAPHORE_SENDER=%s" % active[0])
                return 0
            print("Still failing: %s" % err2)
    print("\nCommon causes: unapproved/blank sender name, zero credits, malformed number,")
    print("or content filtering (no links, no phone numbers, must not start with 'TEST').")
    return 1

if __name__ == "__main__":
    sys.exit(main())
