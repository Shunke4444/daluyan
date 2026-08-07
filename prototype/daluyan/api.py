"""JSON API for the React console (shadcn UI). Mounted under /api/*.
Legacy server-rendered pages remain available under their original routes."""
import json, os, datetime
import tornado.web
from . import db, linter

def register(app_handlers, ctx):
    """ctx provides: C (db conn), fill, route_text, GATEWAY getter, gateway_balance, queue_send."""
    class Base(tornado.web.RequestHandler):
        def set_default_headers(self):
            self.set_header("Access-Control-Allow-Origin", "*")
            self.set_header("Access-Control-Allow-Headers", "Content-Type")
            self.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        def options(self, *a):
            self.set_status(204); self.finish()
        def json(self, obj, status=200):
            self.set_status(status)
            self.set_header("Content-Type", "application/json")
            self.finish(json.dumps(obj, default=str))
        def body(self):
            try:
                return json.loads(self.request.body or b"{}")
            except Exception:
                return {}

    C = ctx["C"]

    def alert_counts(alert_id):
        row = C().execute("""SELECT
            SUM(CASE WHEN kind='alert' THEN 1 ELSE 0 END) total,
            SUM(CASE WHEN kind='alert' AND status='sent' THEN 1 ELSE 0 END) sent,
            SUM(CASE WHEN kind='alert' AND status IN ('queued','failed') THEN 1 ELSE 0 END) pending,
            SUM(CASE WHEN kind='alert' AND status='unreached' THEN 1 ELSE 0 END) unreached
            FROM sends WHERE alert_id=?""", (alert_id,)).fetchone()
        return {k: row[k] or 0 for k in ("total", "sent", "pending", "unreached")}

    class Summary(Base):
        def get(self):
            c = C()
            zones = [dict(r) for r in c.execute("SELECT zone, COUNT(*) c FROM residents GROUP BY zone ORDER BY zone")]
            latest = c.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 1").fetchone()
            active = None
            if latest:
                age_h = (datetime.datetime.now() - datetime.datetime.strptime(latest["created_at"], "%Y-%m-%d %H:%M:%S")).total_seconds() / 3600
                if age_h < 12:
                    active = dict(latest) | {"counts": alert_counts(latest["id"]),
                        "replies": c.execute("SELECT COUNT(*) c FROM replies WHERE alert_id=?", (latest["id"],)).fetchone()["c"]}
            self.json({
                "residents": c.execute("SELECT COUNT(*) c FROM residents").fetchone()["c"],
                "consented": c.execute("SELECT COUNT(*) c FROM residents WHERE consent_at IS NOT NULL").fetchone()["c"],
                "zones": zones,
                "triage": c.execute("SELECT COUNT(*) c FROM replies WHERE keyword IN ('HELP','MEDICINE','STRANDED') AND handled=0").fetchone()["c"],
                "gateway": ctx["gateway_name"](),
                "balance": ctx["gateway_balance"](),
                "active_alert": active,
            })

    class Residents(Base):
        def get(self):
            self.json([dict(r) for r in C().execute("SELECT * FROM residents ORDER BY zone, name")])
        def post(self):
            b = self.body()
            if not b.get("consent"):
                self.json({"error": "Consent is required (recorded at enrollment, Data Privacy Act)."}, 400); return
            try:
                C().execute("INSERT INTO residents(name,phone,zone,language,flags,consent_at,created_at) VALUES(?,?,?,?,?,?,?)",
                            (b.get("name","").strip(), b.get("phone","").strip(), str(b.get("zone","")).strip(),
                             b.get("language","fil"), ",".join(b.get("flags", [])) if isinstance(b.get("flags"), list) else b.get("flags",""),
                             db.now(), db.now()))
                C().commit()
            except Exception as e:
                self.json({"error": str(e)}, 400); return
            self.json({"ok": True})

    class Templates(Base):
        def get(self):
            out = []
            for r in C().execute("SELECT * FROM alert_templates ORDER BY code, language"):
                errs, warns = linter.lint(r["body"])
                out.append(dict(r) | {"lint_errors": errs, "lint_warnings": warns})
            self.json(out)

        def post(self):
            body = self.body()
            try:
                template_id = int(body.get("id"))
            except (TypeError, ValueError):
                self.json({"error": "A template is required."}, 400); return
            text = str(body.get("body", "")).strip()
            if not text:
                self.json({"error": "Template body cannot be empty."}, 400); return
            c = C()
            row = c.execute("SELECT * FROM alert_templates WHERE id=?", (template_id,)).fetchone()
            if not row:
                self.json({"error": "Template not found."}, 404); return
            c.execute("UPDATE alert_templates SET body=?, approved_by=?, approved_at=NULL WHERE id=?",
                      (text, "DRAFT - operator edited, needs validation", template_id))
            c.commit()
            updated = c.execute("SELECT * FROM alert_templates WHERE id=?", (template_id,)).fetchone()
            errs, warns = linter.lint(updated["body"])
            self.json(dict(updated) | {"lint_errors": errs, "lint_warnings": warns})

    class Alerts(Base):
        def get(self):
            out = []
            for a in C().execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 30"):
                out.append(dict(a) | {"counts": alert_counts(a["id"])})
            self.json(out)

    class Preview(Base):
        def post(self):
            b = self.body()
            stub = {"zones": b.get("zones",""), "center": b.get("center",""), "route_status": b.get("route_status","open"),
                    "route_note": b.get("route_note",""), "source": b.get("source",""), "created_at": db.now()}
            out, blocked = [], False
            for t in C().execute("SELECT * FROM alert_templates WHERE code=? ORDER BY language", (b.get("template_code",""),)):
                body = ctx["fill"](t["body"], stub, t["language"])
                errs, warns = linter.lint(body, filled=True)
                n = C().execute("SELECT COUNT(*) c FROM residents WHERE language=? AND (','||?||',') LIKE ('%,'||zone||',%') AND consent_at IS NOT NULL",
                                (t["language"], stub["zones"])).fetchone()["c"]
                blocked = blocked or bool(errs)
                out.append({"language": t["language"], "body": body, "chars": len(body),
                            "segments": 1 + (len(body) - 1) // 153 if len(body) > 160 else 1,
                            "recipients": n, "errors": errs, "warnings": warns})
            self.json({"previews": out, "blocked": blocked})

    class Send(Base):
        def post(self):
            b = self.body()
            code = b.get("template_code","")
            stub = {"zones": b.get("zones",""), "center": b.get("center",""), "route_status": b.get("route_status","open"),
                    "route_note": b.get("route_note",""), "source": b.get("source",""), "created_at": db.now()}
            c = C()
            for t in c.execute("SELECT * FROM alert_templates WHERE code=?", (code,)):
                errs, _ = linter.lint(ctx["fill"](t["body"], stub, t["language"]), filled=True)
                if errs:
                    self.json({"error": "Blocked by linter: " + "; ".join(errs)}, 400); return
            c.execute("INSERT INTO alerts(template_code,severity,zones,center,route_status,route_note,source,created_at) VALUES(?,?,?,?,?,?,?,?)",
                      (code, b.get("severity","normal"), stub["zones"], stub["center"], stub["route_status"], stub["route_note"], stub["source"], db.now()))
            alert_id = c.execute("SELECT last_insert_rowid() i").fetchone()["i"]; c.commit()
            alert = c.execute("SELECT * FROM alerts WHERE id=?", (alert_id,)).fetchone()
            zone_list = [z.strip() for z in stub["zones"].split(",") if z.strip()]
            q = ",".join("?" * len(zone_list))
            for r in c.execute("SELECT * FROM residents WHERE zone IN (%s) AND consent_at IS NOT NULL" % q, zone_list).fetchall():
                t = c.execute("SELECT * FROM alert_templates WHERE code=? AND language=? ORDER BY version DESC LIMIT 1", (code, r["language"])).fetchone() or \
                    c.execute("SELECT * FROM alert_templates WHERE code=? AND language='fil' ORDER BY version DESC LIMIT 1", (code,)).fetchone()
                ctx["queue_send"](alert_id, r, ctx["fill"](t["body"], alert, r["language"]))
            self.json({"ok": True, "alert_id": alert_id})

    class Audit(Base):
        def get(self):
            c = C()
            self.json({
                "sends": [dict(r) for r in c.execute("SELECT s.*, res.name FROM sends s LEFT JOIN residents res ON res.id=s.resident_id ORDER BY s.id DESC LIMIT 200")],
                "replies": [dict(r) for r in c.execute("SELECT r.*, res.name FROM replies r LEFT JOIN residents res ON res.id=r.resident_id ORDER BY r.id DESC LIMIT 200")],
            })

    class Messages(Base):
        """Conversation-shaped view over the existing residents/sends/replies tables."""
        def get(self):
            c = C()
            contacts = []
            residents = c.execute("SELECT * FROM residents ORDER BY name").fetchall()
            for resident in residents:
                outgoing = [dict(row) | {"direction": "out"} for row in c.execute(
                    "SELECT id, body AS text, status, created_at AS timestamp, alert_id FROM sends WHERE resident_id=? ORDER BY created_at, id",
                    (resident["id"],)).fetchall()]
                incoming = [dict(row) | {"direction": "in"} for row in c.execute(
                    "SELECT id, raw_text AS text, keyword, handled, received_at AS timestamp, alert_id FROM replies WHERE resident_id=? ORDER BY received_at, id",
                    (resident["id"],)).fetchall()]
                thread = sorted(outgoing + incoming, key=lambda item: (item.get("timestamp") or "", item["id"]))
                unread = sum(1 for item in incoming if not item.get("handled"))
                last = thread[-1] if thread else None
                details = c.execute("SELECT * FROM resident_contact_details WHERE resident_id=?", (resident["id"],)).fetchone()
                state = c.execute("SELECT archived, flood_status FROM resident_message_state WHERE resident_id=?", (resident["id"],)).fetchone()
                relatives = [dict(row) for row in c.execute(
                    "SELECT id, name, relationship, phone FROM resident_relatives WHERE resident_id=? ORDER BY id", (resident["id"],))]
                contacts.append(dict(resident) | {
                    "messages": thread,
                    "unread": unread,
                    "last_message": last["text"] if last else "No messages yet",
                    "last_timestamp": last["timestamp"] if last else resident["created_at"],
                    "contact_details": dict(details) if details else {"email": "", "alternate_phone": "", "address": "", "notes": ""},
                    "relatives": relatives,
                    "archived": bool(state["archived"]) if state else False,
                    "flood_status": (state["flood_status"] if state else None) or "monitoring",
                })
            contacts.sort(key=lambda item: (bool(item["messages"]), item.get("last_timestamp") or ""), reverse=True)
            templates = [dict(row) for row in c.execute(
                "SELECT id, code, language, body FROM alert_templates ORDER BY code, language")]
            self.json({"contacts": contacts, "templates": templates})

        def post(self):
            body = self.body()
            if body.get("action") in ("archive", "status", "update_contact"):
                try:
                    resident_id = int(body.get("resident_id"))
                except (TypeError, ValueError):
                    self.json({"error": "A resident is required."}, 400); return
                c = C()
                if not c.execute("SELECT 1 FROM residents WHERE id=?", (resident_id,)).fetchone():
                    self.json({"error": "Resident not found."}, 404); return
                if body["action"] == "archive":
                    c.execute("""INSERT INTO resident_message_state(resident_id,archived,updated_at) VALUES(?,?,?)
                                 ON CONFLICT(resident_id) DO UPDATE SET archived=excluded.archived,updated_at=excluded.updated_at""",
                              (resident_id, 1 if body.get("archived") else 0, db.now()))
                elif body["action"] == "status":
                    allowed = {"monitoring", "preparing", "sheltering", "evacuating", "safe", "needs_help", "medical", "relocated", "stranded", "unreachable", "recovery"}
                    status = str(body.get("status", ""))
                    if status not in allowed:
                        self.json({"error": "Invalid flood status."}, 400); return
                    c.execute("""INSERT INTO resident_message_state(resident_id,flood_status,updated_at) VALUES(?,?,?)
                                 ON CONFLICT(resident_id) DO UPDATE SET flood_status=excluded.flood_status,updated_at=excluded.updated_at""",
                              (resident_id, status, db.now()))
                else:
                    name, phone = str(body.get("name", "")).strip(), str(body.get("phone", "")).strip()
                    if not name or not phone:
                        self.json({"error": "Name and phone are required."}, 400); return
                    c.execute("UPDATE residents SET name=?,phone=?,zone=?,language=?,flags=? WHERE id=?",
                              (name, phone, str(body.get("zone", "")).strip(), body.get("language", "fil"), str(body.get("flags", "")).strip(), resident_id))
                    c.execute("""INSERT INTO resident_contact_details(resident_id,email,alternate_phone,address,notes) VALUES(?,?,?,?,?)
                                 ON CONFLICT(resident_id) DO UPDATE SET email=excluded.email,alternate_phone=excluded.alternate_phone,address=excluded.address,notes=excluded.notes""",
                              (resident_id, str(body.get("email", "")).strip(), str(body.get("alternate_phone", "")).strip(), str(body.get("address", "")).strip(), str(body.get("notes", "")).strip()))
                c.commit(); self.json({"ok": True}); return
            if body.get("action") == "add_contact":
                first_name = str(body.get("first_name", "")).strip()
                last_name = str(body.get("last_name", "")).strip()
                phone = str(body.get("phone", "")).strip()
                if not first_name or not last_name or not phone:
                    self.json({"error": "First name, last name, and phone number are required."}, 400); return
                c = C()
                try:
                    c.execute("""INSERT INTO residents(name,phone,zone,language,flags,consent_at,created_at)
                                 VALUES(?,?,?,?,?,?,?)""",
                              (f"{first_name} {last_name}", phone, str(body.get("zone", "Unassigned")),
                               body.get("language", "fil"), "", db.now(), db.now()))
                    resident_id = c.execute("SELECT last_insert_rowid() id").fetchone()["id"]
                    c.execute("""INSERT INTO resident_contact_details(resident_id,email,alternate_phone,address,notes)
                                 VALUES(?,?,?,?,?)""",
                              (resident_id, str(body.get("email", "")).strip(), str(body.get("alternate_phone", "")).strip(),
                               str(body.get("address", "")).strip(), str(body.get("notes", "")).strip()))
                    for relative in body.get("relatives", []):
                        name = str(relative.get("name", "")).strip()
                        if name:
                            c.execute("INSERT INTO resident_relatives(resident_id,name,relationship,phone) VALUES(?,?,?,?)",
                                      (resident_id, name, str(relative.get("relationship", "")).strip(), str(relative.get("phone", "")).strip()))
                    c.commit()
                except Exception as error:
                    c.rollback(); self.json({"error": str(error)}, 400); return
                self.json({"ok": True, "resident_id": resident_id}); return
            try:
                resident_id = int(body.get("resident_id"))
            except (TypeError, ValueError):
                self.json({"error": "A resident is required."}, 400); return
            text = str(body.get("text", "")).strip()
            if not text:
                self.json({"error": "Message cannot be empty."}, 400); return
            c = C()
            resident = c.execute("SELECT * FROM residents WHERE id=?", (resident_id,)).fetchone()
            if not resident:
                self.json({"error": "Resident not found."}, 404); return
            timestamp = db.now()
            c.execute("""INSERT INTO sends(
                alert_id,resident_id,phone,body,kind,status,attempts,gateway,created_at,updated_at
                ) VALUES(NULL,?,?,?,'message','sent',1,'demo',?,?)""",
                (resident_id, resident["phone"], text, timestamp, timestamp))
            c.commit()
            message_id = c.execute("SELECT last_insert_rowid() id").fetchone()["id"]
            self.json({"id": message_id, "text": text, "direction": "out", "status": "sent", "timestamp": timestamp})

    app_handlers.extend([
        (r"/api/summary", Summary), (r"/api/residents", Residents), (r"/api/templates", Templates),
        (r"/api/alerts", Alerts), (r"/api/preview", Preview), (r"/api/send", Send), (r"/api/audit", Audit),
        (r"/api/messages", Messages),
    ])
