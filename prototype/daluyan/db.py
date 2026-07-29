"""SQLite storage - five flat tables, no ORM, no client sync. Boring on purpose."""
import sqlite3, os, datetime

DB_PATH = os.environ.get("DALUYAN_DB", os.path.join(os.path.dirname(__file__), "..", "daluyan.db"))

def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def conn():
    c = sqlite3.connect(DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    return c

SCHEMA = """
CREATE TABLE IF NOT EXISTS residents(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL,
  zone TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'fil',
  flags TEXT DEFAULT '', consent_at TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS alert_templates(
  id INTEGER PRIMARY KEY, code TEXT NOT NULL, language TEXT NOT NULL,
  body TEXT NOT NULL, version INTEGER DEFAULT 1,
  approved_by TEXT, approved_at TEXT, UNIQUE(code, language, version));
CREATE TABLE IF NOT EXISTS alerts(
  id INTEGER PRIMARY KEY, template_code TEXT NOT NULL, severity TEXT NOT NULL,
  zones TEXT NOT NULL, center TEXT DEFAULT '', route_status TEXT DEFAULT 'open',
  route_note TEXT DEFAULT '', source TEXT NOT NULL, created_at TEXT);
CREATE TABLE IF NOT EXISTS sends(
  id INTEGER PRIMARY KEY, alert_id INTEGER, resident_id INTEGER, phone TEXT NOT NULL,
  body TEXT NOT NULL, kind TEXT DEFAULT 'alert',            -- alert | auto_reply
  status TEXT DEFAULT 'queued',                             -- queued|sent|failed|unreached
  attempts INTEGER DEFAULT 0, next_attempt_at TEXT, gateway TEXT DEFAULT '',
  error TEXT DEFAULT '', created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS replies(
  id INTEGER PRIMARY KEY, phone TEXT NOT NULL, resident_id INTEGER,
  keyword TEXT, raw_text TEXT NOT NULL, alert_id INTEGER,
  handled INTEGER DEFAULT 0, received_at TEXT);
"""

# Seed templates. DRAFT copy: must be native-speaker validated + captain-approved before live use.
# Linter-safe: no links, no phone numbers, no personal names. Every body cites {source} and {asof}.
TEMPLATES = [
 ("HEADSUP","fil","BABALA BAHA ({brgy}): May paparating na malakas na ulan/bagyo sa susunod na 24 oras. Zone {zones}. Ihanda ang inyong pamilya. Mula: {source}, {asof}."),
 ("HEADSUP","ceb","PASIDAAN BAHA ({brgy}): Adunay umaabot nga kusog nga ulan/bagyo sulod sa 24 ka oras. Zone {zones}. Andama ang inyong pamilya. Gikan: {source}, {asof}."),
 ("PREPARE","fil","PAGHANDA ({brgy}) Zone {zones}: I-CHARGE ANG CELLPHONE AT POWERBANK. Ihanda ang mahahalagang dokumento at gamot. Kung may matanda o maysakit sa bahay, maghanda nang lumikas nang maaga. Mula: {source}, {asof}."),
 ("PREPARE","ceb","PANGANDAM ({brgy}) Zone {zones}: I-CHARGE ANG CELLPHONE UG POWERBANK. Andama ang importanteng dokumento ug tambal. Kung adunay tigulang o masakiton sa balay, pangandam na molikas og sayo. Gikan: {source}, {asof}."),
 ("EVACUATE","fil","LUMIKAS NA ({brgy}) Zone {zones}: Pumunta sa {center}. Daan: {route_text}. Dalhin ang gamot at dokumento. I-reply ang EVAC para sa kalagayan ng daan, HELP kung naiipit, SAFE kung nakalikas na. Mula: {source}, {asof}."),
 ("EVACUATE","ceb","BAKWIT NA ({brgy}) Zone {zones}: Adto sa {center}. Agianan: {route_text}. Dad-a ang tambal ug dokumento. I-reply ang EVAC para sa kahimtang sa dalan, HELP kung na-ipit, SAFE kung nakabakwit na. Gikan: {source}, {asof}."),
]

RESIDENTS = [
 ("Rosa Delacruz","09171000001","1","fil","elderly","y"),("Ben Santos","09171000002","1","fil","","y"),
 ("Maria Lopez","09171000003","1","fil","infant","y"),("Jun Ramos","09171000004","1","fil","pwd","y"),
 ("Lita Garcia","09181000005","2","fil","elderly,chronic_illness","y"),("Carlo Reyes","09181000006","2","fil","","y"),
 ("Nena Cruz","09181000007","2","fil","pregnant","y"),("Paolo Mendoza","09181000008","2","fil","","y"),
 ("Divina Flores","09191000009","3","fil","elderly","y"),("Ramon Aquino","09191000010","3","fil","","y"),
 ("Grace Villanueva","09191000011","3","fil","infant","y"),("Edgar Torres","09191000012","3","fil","chronic_illness","y"),
 ("Inday Uy","09201000013","3","ceb","elderly","y"),("Bong Cabahug","09201000014","2","ceb","","y"),
]

def init():
    c = conn()
    c.executescript(SCHEMA)
    if c.execute("SELECT COUNT(*) FROM alert_templates").fetchone()[0] == 0:
        for code, lang, body in TEMPLATES:
            c.execute("INSERT INTO alert_templates(code,language,body,version,approved_by,approved_at) VALUES(?,?,?,1,'DRAFT - needs native-speaker validation',NULL)", (code, lang, body))
    if c.execute("SELECT COUNT(*) FROM residents").fetchone()[0] == 0:
        for n, ph, z, lang, fl, cons in RESIDENTS:
            c.execute("INSERT INTO residents(name,phone,zone,language,flags,consent_at,created_at) VALUES(?,?,?,?,?,?,?)",
                      (n, ph, z, lang, fl, now() if cons == "y" else None, now()))
    c.commit()
    return c
