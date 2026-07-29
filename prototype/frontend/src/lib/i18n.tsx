import { createContext, useContext, useState, ReactNode } from "react";

const dict = {
  en: {
    ready: "Ready", households: "households", gatewayOk: "gateway OK",
    sendAlert: "Send a flood alert", sendAlertSub: "3 questions, then send. Templates are pre-approved.",
    enroll: "Register a household", enrollSub: "Add a family to the alert list.",
    history: "History and reports", overview: "Overview", registry: "Households",
    templates: "Templates", audit: "Audit log", simulator: "Phone simulator",
    activeAlert: "Active alert", delivered: "delivered", retrying: "queued / retrying",
    unreached: "unreached — door-knock", repliesIn: "replies in", liveReplies: "Live replies",
    noRepliesYet: "None yet — replies land here live.",
    unreachedList: "Unreached (delivery failed after retries)", noReplyList: "Delivered but no reply yet",
    perHousehold: "Per-household delivery", markHandled: "Mark handled",
    stepOf: "Step", whatWarning: "What kind of warning?", whichZones: "Which zones?",
    routeQ: "How is the road to the evacuation center?",
    routeOpen: "Road is open", routeOpenSub: "Safe to pass",
    routeAffected: "Open but road affected", routeAffectedSub: "Add a note, e.g. use the Riverside–Chapel path",
    routeClosed: "Road is closed", routeClosedSub: "Residents will be told to wait for a tanod",
    center: "Evacuation center", source: "Source of the warning", severity: "Severity",
    normal: "Normal", critical: "Critical — priority route", routeNote: "Route note (optional)",
    back: "Back", next: "Next", previewSms: "Preview the exact SMS", sendWave: "Send to",
    recipients: "recipients", segments: "segment(s)", linterPass: "Linter pass", blocked: "Blocked",
    name: "Contact name", phone: "Phone (09…)", zone: "Zone", language: "Language",
    flags: "Vulnerability flags", consent: "Consent read and given", enrollBtn: "Register household",
    consentNote: "Flags are visible to operators only and never automate decisions. Consent is recorded (Data Privacy Act).",
    lastDrill: "Last drill", needsAttention: "needs attention", unhandledReplies: "unhandled replies",
    sendTest: "Act as this resident and reply:", exportCsv: "Export CSV",
    templatesNote: "Seed copy is DRAFT — needs native-speaker validation and captain approval before live use.",
    zonesHint: "Comma-separated, e.g. 1,3", registered: "registered", consented: "with consent",
  },
  fil: {
    ready: "Handa", households: "sambahayan", gatewayOk: "OK ang gateway",
    sendAlert: "Magpadala ng babala", sendAlertSub: "3 tanong, tapos send. Aprubado na ang mga template.",
    enroll: "Idagdag ang pamilya", enrollSub: "Irehistro ang sambahayan sa alert list.",
    history: "Kasaysayan at mga ulat", overview: "Pangkalahatan", registry: "Mga sambahayan",
    templates: "Mga template", audit: "Audit log", simulator: "Phone simulator",
    activeAlert: "Aktibong babala", delivered: "naipadala", retrying: "nakapila / inuulit",
    unreached: "hindi naabot — katukin", repliesIn: "mga sagot", liveReplies: "Mga sagot (live)",
    noRepliesYet: "Wala pa — dito lalabas ang mga sagot.",
    unreachedList: "Hindi naabot (palpak ang padala)", noReplyList: "Naipadala pero walang sagot",
    perHousehold: "Padala kada sambahayan", markHandled: "Tapos na",
    stepOf: "Hakbang", whatWarning: "Anong klaseng babala?", whichZones: "Aling mga zone?",
    routeQ: "Kumusta ang daan papunta sa evacuation center?",
    routeOpen: "Bukas ang daan", routeOpenSub: "Ligtas dumaan",
    routeAffected: "Bukas pero apektado", routeAffectedSub: "Maglagay ng paalala, hal. daanan ang Riverside–Chapel",
    routeClosed: "Sarado ang daan", routeClosedSub: "Sasabihan ang residente na hintayin ang tanod",
    center: "Evacuation center", source: "Pinagmulan ng babala", severity: "Bigat",
    normal: "Normal", critical: "Kritikal — priority route", routeNote: "Paalala sa ruta (opsyonal)",
    back: "Bumalik", next: "Susunod", previewSms: "Silipin ang eksaktong SMS", sendWave: "Ipadala sa",
    recipients: "tatanggap", segments: "segment", linterPass: "Pasado sa linter", blocked: "Hinarang",
    name: "Pangalan ng kontak", phone: "Numero (09…)", zone: "Zone", language: "Wika",
    flags: "Mga flag ng kahinaan", consent: "Nabasa at pumayag sa consent", enrollBtn: "Irehistro",
    consentNote: "Ang mga flag ay para sa operator lang at hindi awtomatikong ginagamit. Naitatala ang consent (Data Privacy Act).",
    lastDrill: "Huling drill", needsAttention: "kailangan ng aksyon", unhandledReplies: "sagot na di pa natutugunan",
    sendTest: "Sumagot bilang residenteng ito:", exportCsv: "I-export ang CSV",
    templatesNote: "DRAFT pa ang mga template — kailangan ng native-speaker validation at pirma ng kapitan bago gamitin.",
    zonesHint: "Hiwalay ng kuwit, hal. 1,3", registered: "nakarehistro", consented: "may consent",
  },
};

type Lang = keyof typeof dict;
type Key = keyof typeof dict.en;

const Ctx = createContext<{ lang: Lang; t: (k: Key) => string; setLang: (l: Lang) => void }>({
  lang: "en", t: (k) => k as string, setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("daluyan_lang") as Lang) || "fil");
  const setLang = (l: Lang) => { localStorage.setItem("daluyan_lang", l); setLangState(l); };
  const t = (k: Key) => dict[lang][k] || dict.en[k] || (k as string);
  return <Ctx.Provider value={{ lang, t, setLang }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
