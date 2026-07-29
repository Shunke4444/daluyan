"""Daluyan Phase 1 prototype - barangay operator console + SMS core (Tornado + Jinja2).
Run:  python -m daluyan.main          (DEMO_FAST=1 for quick retry cycles; port 8787)
Gateway: MOCK by default; set SEMAPHORE_API_KEY (+SEMAPHORE_SENDER) for live outbound.
Inbound webhook: POST /inbound  (Android SIM gateway / engageSPARK / phone simulator all land here).
Note: the brief allows Node/Express or Python; Tornado was chosen for the prototype because it is
pure-Python (installs anywhere, no compilers) - porting to FastAPI later is mechanical: routes are thin.
"""
import os, csv, io, json
import tornado.ioloop, tornado.web
from jinja2 import Environment, FileSystemLoader
from . import db, keywords, linter, retry, gateway as gw

BRGY = os.environ.get("DALUYAN_BRGY", "Brgy Mahogany, Marilao")
PORT = int(os.environ.get("PORT", "8787"))
HERE = os.path.dirname(__file__)
env = Environment(loader=FileSystemLoader(os.path.join(HERE, "..", "templates")), autoescape=True)

C = None
GATEWAY = None

ROUTE_TEXT = {
    "open":     {"fil": "BUKAS ang pangunahing daan", "ceb": "ABLI ang dakong dalan"},
    "affected": {"fil": "BUKAS pero APEKTADO ng baha ang bahagi ng daan - mag-ingat, sundan ang bandilyo", "ceb": "ABLI apan APEKTADO sa baha ang bahin sa dalan - pag-amping"},
    "closed":   {"fil": "SARADO ang pangunahing daan - HINTAYIN ang tanod o bandilyo para sa alternatibong ruta", "ceb": "SIRADO ang dakong dalan - HULATA ang tanod para sa laing agianan"},
}

def route_text(alert, lang):
    base = ROUTE_TEXT.get(alert["route_status"], ROUTE_TEXT["open"]).get(lang, ROUTE_TEXT["open"]["fil"])
    note = (" (" + alert["route_note"] + ")") if alert["route_note"] else ""
    return base + note

def fill(body, alert, lang):
    return (body.replace("{brgy}", BRGY)
                .replace("{zones}", alert["zones"])
                .replace("{center}", alert["center"] or "Barangay Hall")
                .replace("{route_text}", route_text(alert, lang))
                .replace("{source}", alert["source"])
                .replace("{asof}", alert["created_at"][11:16]))

def latest_alert_for(resident):
    row = C.execute("SELECT * FROM alerts WHERE (','||zones||',') LIKE ? ORDER BY id DESC LIMIT 1",
                    ("%," + resident["zone"] + ",%",)).fetchone()
    return row or C.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 1").fetchone()

def queue_send(alert_id, resident, body, kind="alert"):
    C.execute("INSERT INTO sends(alert_id,resident_id,phone,body,kind,status,created_at,updated_at) VALUES(?,?,?,?,?,'queued',?,?)",
              (alert_id, resident["id"] if resident else None,
               resident["phone"] if resident else "", body, kind, db.now(), db.now()))
    C.commit()

class Base(tornado.web.RequestHandler):
    def render_tpl(self, name, **kw):
        kw.setdefault("brgy", BRGY)
        self.finish(env.get_template(name).render(**kw))
    def json(self, obj, status=200):
        self.set_status(status)
        self.set_header("Content-Type", "application/json")
        self.finish(json.dumps(obj, default=str))

class Dashboard(Base):
    def get(self):
        s = {"residents": C.execute("SELECT COUNT(*) c FROM residents").fetchone()["c"],
             "consented": C.execute("SELECT COUNT(*) c FROM residents WHERE consent_at IS NOT NULL").fetchone()["c"],
             "zones": C.execute("SELECT zone, COUNT(*) c FROM residents GROUP BY zone ORDER BY zone").fetchall()}
        alerts = C.execute("""SELECT a.*,
            (SELECT COUNT(*) FROM sends x WHERE x.alert_id=a.id AND x.kind='alert') AS total,
            (SELECT COUNT(*) FROM sends x WHERE x.alert_id=a.id AND x.kind='alert' AND x.status='sent') AS sent,
            (SELECT COUNT(*) FROM sends x WHERE x.alert_id=a.id AND x.kind='alert' AND x.status='unreached') AS unreached
            FROM alerts a ORDER BY a.id DESC LIMIT 8""").fetchall()
        triage = C.execute("""SELECT r.*, res.name, res.zone, res.flags FROM replies r
            LEFT JOIN residents res ON res.id=r.resident_id
            WHERE r.keyword IN ('HELP','MEDICINE','STRANDED') AND r.handled=0
            ORDER BY r.id DESC LIMIT 20""").fetchall()
        self.render_tpl("dashboard.html", s=s, alerts=alerts, triage=triage, gateway=GATEWAY.name)

class Residents(Base):
    def get(self):
        self.render_tpl("residents.html", rows=C.execute("SELECT * FROM residents ORDER BY zone, name").fetchall())
    def post(self):
        if not self.get_body_argument("consent", None):
            self.set_status(400); self.finish("Consent is required (Data Privacy Act - recorded at enrollment)."); return
        try:
            C.execute("INSERT INTO residents(name,phone,zone,language,flags,consent_at,created_at) VALUES(?,?,?,?,?,?,?)",
                      (self.get_body_argument("name").strip(), self.get_body_argument("phone").strip(),
                       self.get_body_argument("zone").strip(), self.get_body_argument("language", "fil"),
                       self.get_body_argument("flags", "").strip(), db.now(), db.now()))
            C.commit()
        except Exception as e:
            self.set_status(400); self.finish("Error: %s" % e); return
        self.redirect("/residents")

class TemplatesPage(Base):
    def get(self):
        rows = []
        for r in C.execute("SELECT * FROM alert_templates ORDER BY code, language").fetchall():
            errs, warns = linter.lint(r["body"])
            rows.append({"row": r, "errors": errs, "warnings": warns})
        self.render_tpl("templates_page.html", rows=rows)

def _alert_stub(self):
    return {"zones": self.get_body_argument("zones"), "center": self.get_body_argument("center", ""),
            "route_status": self.get_body_argument("route_status", "open"),
            "route_note": self.get_body_argument("route_note", ""),
            "source": self.get_body_argument("source"), "created_at": db.now()}

class SendPage(Base):
    def get(self):
        codes = [r["code"] for r in C.execute("SELECT DISTINCT code FROM alert_templates ORDER BY code")]
        zones = [r["zone"] for r in C.execute("SELECT DISTINCT zone FROM residents ORDER BY zone")]
        self.render_tpl("send.html", codes=codes, zones=zones)
    def post(self):
        code, stub = self.get_body_argument("template_code"), _alert_stub(self)
        for t in C.execute("SELECT * FROM alert_templates WHERE code=?", (code,)):
            errs, _ = linter.lint(fill(t["body"], stub, t["language"]), filled=True)
            if errs:
                self.set_status(400); self.finish("BLOCKED by linter: " + "; ".join(errs)); return
        C.execute("INSERT INTO alerts(template_code,severity,zones,center,route_status,route_note,source,created_at) VALUES(?,?,?,?,?,?,?,?)",
                  (code, self.get_body_argument("severity", "normal"), stub["zones"], stub["center"],
                   stub["route_status"], stub["route_note"], stub["source"], db.now()))
        alert_id = C.execute("SELECT last_insert_rowid() i").fetchone()["i"]; C.commit()
        alert = C.execute("SELECT * FROM alerts WHERE id=?", (alert_id,)).fetchone()
        zone_list = [z.strip() for z in stub["zones"].split(",") if z.strip()]
        q = ",".join("?" * len(zone_list))
        for r in C.execute("SELECT * FROM residents WHERE zone IN (%s) AND consent_at IS NOT NULL" % q, zone_list).fetchall():
            t = C.execute("SELECT * FROM alert_templates WHERE code=? AND language=? ORDER BY version DESC LIMIT 1",
                          (code, r["language"])).fetchone() or \
                C.execute("SELECT * FROM alert_templates WHERE code=? AND language='fil' ORDER BY version DESC LIMIT 1", (code,)).fetchone()
            queue_send(alert_id, r, fill(t["body"], alert, r["language"]))
        self.redirect("/alerts/%d" % alert_id)

class Preview(Base):
    def post(self):
        code, stub = self.get_body_argument("template_code"), _alert_stub(self)
        out, blocked = [], False
        for t in C.execute("SELECT * FROM alert_templates WHERE code=? ORDER BY language", (code,)):
            body = fill(t["body"], stub, t["language"])
            errs, warns = linter.lint(body, filled=True)
            n = C.execute("SELECT COUNT(*) c FROM residents WHERE language=? AND (','||?||',') LIKE ('%,'||zone||',%') AND consent_at IS NOT NULL",
                          (t["language"], stub["zones"])).fetchone()["c"]
            blocked = blocked or bool(errs)
            out.append({"language": t["language"], "body": body, "chars": len(body),
                        "segments": 1 + (len(body) - 1) // 153 if len(body) > 160 else 1,
                        "recipients": n, "errors": errs, "warnings": warns})
        self.json({"previews": out, "blocked": blocked})

class AlertPage(Base):
    def get(self, alert_id):
        self.render_tpl("alert_detail.html", alert=C.execute("SELECT * FROM alerts WHERE id=?", (alert_id,)).fetchone())

class AlertData(Base):
    def get(self, alert_id):
        sends = [dict(r) for r in C.execute("""SELECT s.*, res.name, res.zone, res.flags FROM sends s
            LEFT JOIN residents res ON res.id=s.resident_id
            WHERE s.alert_id=? AND s.kind='alert' ORDER BY res.zone, res.name""", (alert_id,))]
        replies = [dict(r) for r in C.execute("""SELECT r.*, res.name, res.zone, res.flags FROM replies r
            LEFT JOIN residents res ON res.id=r.resident_id WHERE r.alert_id=? ORDER BY r.id DESC""", (alert_id,))]
        replied = set(r["resident_id"] for r in replies if r["resident_id"])
        unreached = [s for s in sends if s["status"] == "unreached"]
        pending = [s for s in sends if s["status"] in ("queued", "failed")]
        no_reply = [s for s in sends if s["status"] == "sent" and s["resident_id"] not in replied]
        self.json({"sends": sends, "replies": replies, "unreached": unreached, "pending": pending,
                   "no_reply": no_reply,
                   "counts": {"total": len(sends), "sent": sum(1 for s in sends if s["status"] == "sent"),
                              "unreached": len(unreached), "pending": len(pending)}})

class HandleReply(Base):
    def post(self, reply_id):
        C.execute("UPDATE replies SET handled=1 WHERE id=?", (reply_id,)); C.commit()
        self.json({"ok": True})

class Inbound(Base):
    def post(self):
        ct = self.request.headers.get("Content-Type", "")
        if "json" in ct:
            j = json.loads(self.request.body or b"{}")
            if "payload" in j:  # capcom6 android-sms-gateway webhook shape
                phone = str(j["payload"].get("phoneNumber", "")); text = j["payload"].get("message", "")
            else:
                phone = str(j.get("from", "")); text = j.get("message", "")
        else:
            phone, text = self.get_body_argument("from", ""), self.get_body_argument("message", "")
        phone = phone.strip().replace("+63", "0")
        res = C.execute("SELECT * FROM residents WHERE phone=?", (phone,)).fetchone()
        kw = keywords.parse(text)
        alert = latest_alert_for(res) if res else C.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 1").fetchone()
        C.execute("INSERT INTO replies(phone,resident_id,keyword,raw_text,alert_id,received_at) VALUES(?,?,?,?,?,?)",
                  (phone, res["id"] if res else None, kw, text, alert["id"] if alert else None, db.now()))
        C.commit()
        if res and kw:  # conservative auto-replies; unknown -> logged only, no reply loop
            lang = res["language"] if res["language"] in ("fil", "ceb") else "fil"
            if kw == "EVAC" and alert:
                body = {"fil": "RUTA/CENTER UPDATE ({brgy}): {center}. {route}. Mula sa barangay, {asof}.",
                        "ceb": "RUTA/CENTER UPDATE ({brgy}): {center}. {route}. Gikan sa barangay, {asof}."}[lang]
                body = (body.replace("{brgy}", BRGY).replace("{center}", alert["center"] or "Barangay Hall")
                            .replace("{route}", route_text(alert, lang)).replace("{asof}", db.now()[11:16]))
                queue_send(alert["id"], res, body, kind="auto_reply")
            elif kw == "SAFE":
                body = {"fil": "Salamat, naitala na LIGTAS ang inyong sambahayan. - {brgy}",
                        "ceb": "Salamat, natala na LUWAS ang inyong panimalay. - {brgy}"}[lang].replace("{brgy}", BRGY)
                queue_send(alert["id"] if alert else None, res, body, kind="auto_reply")
            else:
                body = {"fil": "Natanggap ang inyong {kw}. Ipapaalam sa tanod/BDRRMC ngayon din. - {brgy}",
                        "ceb": "Nadawat ang inyong {kw}. Ipahibalo dayon sa tanod/BDRRMC. - {brgy}"}[lang]
                queue_send(alert["id"] if alert else None, res, body.replace("{kw}", kw).replace("{brgy}", BRGY), kind="auto_reply")
        self.json({"ok": True, "matched_resident": bool(res), "keyword": kw})

class Simulator(Base):
    def get(self):
        self.render_tpl("simulator.html", rows=C.execute("SELECT * FROM residents ORDER BY zone, name").fetchall())

class SimThread(Base):
    def get(self, resident_id):
        r = C.execute("SELECT * FROM residents WHERE id=?", (resident_id,)).fetchone()
        outgoing = [dict(x, dir="out") for x in C.execute(
            "SELECT * FROM sends WHERE resident_id=? ORDER BY id", (resident_id,))]
        incoming = [dict(x, dir="in") for x in C.execute(
            "SELECT * FROM replies WHERE resident_id=? ORDER BY id", (resident_id,))]
        thread = sorted(outgoing + incoming, key=lambda m: m.get("created_at") or m.get("received_at") or "")
        self.json({"resident": dict(r), "thread": thread})

class Audit(Base):
    def get(self):
        self.render_tpl("audit.html",
            sends=C.execute("SELECT s.*, res.name FROM sends s LEFT JOIN residents res ON res.id=s.resident_id ORDER BY s.id DESC LIMIT 300").fetchall(),
            replies=C.execute("SELECT r.*, res.name FROM replies r LEFT JOIN residents res ON res.id=r.resident_id ORDER BY r.id DESC LIMIT 300").fetchall())

class AuditCsv(Base):
    def get(self):
        buf = io.StringIO(); w = csv.writer(buf)
        w.writerow(["type","id","alert_id","phone","name","kind_or_keyword","status","attempts","body_or_raw","error","timestamp"])
        for s in C.execute("SELECT s.*, res.name FROM sends s LEFT JOIN residents res ON res.id=s.resident_id ORDER BY s.id"):
            w.writerow(["send", s["id"], s["alert_id"], s["phone"], s["name"], s["kind"], s["status"], s["attempts"], s["body"], s["error"], s["created_at"]])
        for r in C.execute("SELECT r.*, res.name FROM replies r LEFT JOIN residents res ON res.id=r.resident_id ORDER BY r.id"):
            w.writerow(["reply", r["id"], r["alert_id"], r["phone"], r["name"], r["keyword"], "received", "", r["raw_text"], "", r["received_at"]])
        self.set_header("Content-Type", "text/csv")
        self.set_header("Content-Disposition", "attachment; filename=daluyan_audit.csv")
        self.finish(buf.getvalue())

def make_app():
    return tornado.web.Application([
        (r"/", Dashboard), (r"/residents", Residents), (r"/templates", TemplatesPage),
        (r"/send", SendPage), (r"/preview", Preview),
        (r"/alerts/([0-9]+)", AlertPage), (r"/alerts/([0-9]+)/data", AlertData),
        (r"/replies/([0-9]+)/handle", HandleReply), (r"/inbound", Inbound),
        (r"/simulator", Simulator), (r"/simulator/([0-9]+)/thread", SimThread),
        (r"/audit", Audit), (r"/audit\.csv", AuditCsv),
    ])

def main():
    global C, GATEWAY
    C = db.init()
    GATEWAY = gw.get_gateway()
    retry.start(GATEWAY)
    app = make_app()
    app.listen(PORT)
    print("Daluyan prototype up on http://127.0.0.1:%d  gateway=%s  db=%s" % (PORT, GATEWAY.name, db.DB_PATH))
    tornado.ioloop.IOLoop.current().start()

if __name__ == "__main__":
    main()
