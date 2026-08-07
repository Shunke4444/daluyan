// allow: SIZE_OK — single page component orchestrating Active/Archive/Mass-Send tabs + details panel + 2 modals
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive, ChevronDown, FileImage, Image, Info, Languages, Link2, MessageCircle, MoreHorizontal,
  Paperclip, Phone, Plus, Search, Send, Trash2, UserRound, Video, X,
} from "lucide-react";
import { get, post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

type Message = {
  id: number;
  text: string;
  direction: "in" | "out";
  timestamp?: string;
  status?: string;
  keyword?: string;
  handled?: number;
};

type Contact = {
  id: number;
  name: string;
  phone: string;
  zone: string;
  language: string;
  flags: string;
  unread: number;
  last_message: string;
  last_timestamp?: string;
  messages: Message[];
  contact_details: { email: string; alternate_phone: string; address: string; notes: string };
  relatives: { id: number; name: string; relationship: string; phone: string }[];
  archived: boolean;
  flood_status?: string | null;
};

type Template = { id: number; code: string; language: string; body: string };

type StatusMeta = {
  label: string;
  color: string;
  textColor: string;
  phase: "before" | "during" | "after";
  description: string;
};

const time = (value?: string) => value ? value.slice(11, 16) : "";
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

const STATUS_META: Record<string, StatusMeta> = {
  monitoring:    { label: "Monitoring",        color: "#6b7280", textColor: "#fff", phase: "before",  description: "Ongoing observation, no immediate threat" },
  preparing:     { label: "Preparing",         color: "#eab308", textColor: "#111", phase: "before",  description: "Gathering supplies and planning evacuation" },
  sheltering:    { label: "Sheltering",        color: "#a855f7", textColor: "#fff", phase: "before",  description: "In a designated shelter or safe structure" },
  evacuating:    { label: "Evacuating",        color: "#3b82f6", textColor: "#fff", phase: "during",  description: "Currently moving to safer ground" },
  safe:          { label: "Safe",              color: "#22c55e", textColor: "#fff", phase: "during",  description: "Accounted for and out of immediate danger" },
  needs_help:    { label: "Needs help",        color: "#ef4444", textColor: "#fff", phase: "during",  description: "Requires urgent assistance" },
  medical:       { label: "Medical emergency", color: "#e11d48", textColor: "#fff", phase: "during",  description: "Medical attention needed immediately" },
  relocated:     { label: "Relocated",         color: "#06b6d4", textColor: "#fff", phase: "during",  description: "Moved to a different zone or area" },
  stranded:      { label: "Stranded",          color: "#d97706", textColor: "#fff", phase: "during",  description: "Unable to evacuate, stuck in place" },
  unreachable:   { label: "Unreachable",       color: "#374151", textColor: "#fff", phase: "during",  description: "No contact or response received" },
  recovery:      { label: "Recovery",          color: "#14b8a6", textColor: "#fff", phase: "after",   description: "Needs assessment or recovery support" },
};

const STATUS_PHASES: Array<{ phase: string; key: "before" | "during" | "after"; help: string; items: Array<[string, string]> }> = [
  { phase: "Before flood", key: "before", help: "Readiness and early-warning state", items: [["monitoring", "Monitoring"], ["preparing", "Preparing to evacuate"], ["sheltering", "Sheltering"]] },
  { phase: "During flood", key: "during", help: "Live safety and response state", items: [["evacuating", "Evacuating"], ["safe", "Safe / accounted for"], ["needs_help", "Needs urgent help"], ["medical", "Medical emergency"], ["relocated", "Relocated"], ["stranded", "Stranded"], ["unreachable", "Unreachable"]] },
  { phase: "After flood", key: "after", help: "Return, recovery, and follow-up", items: [["recovery", "Recovery / needs assessment"]] },
];

const SEVERITY_OPTIONS = [
  { value: "info", label: "Info", color: "#3b82f6" },
  { value: "warning", label: "Warning", color: "#eab308" },
  { value: "critical", label: "Critical", color: "#ef4444" },
] as const;

const LANGUAGES = [
  { value: "fil", label: "Filipino" },
  { value: "ceb", label: "Cebuano" },
  { value: "en", label: "English" },
] as const;

export default function MessagesPage() {
  const { lang, setLang } = useI18n();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState<"active" | "archive" | "mass">("active");
  const [customFilters, setCustomFilters] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("daluyan_message_filters") || "[]"); } catch { return []; }
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [newFilter, setNewFilter] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaTab, setMediaTab] = useState<"media" | "images" | "links">("media");
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState("");
  const [newContact, setNewContact] = useState({ first_name: "", last_name: "", phone: "", alternate_phone: "", email: "", address: "", zone: "", language: "fil", notes: "" });
  const [relatives, setRelatives] = useState([{ name: "", relationship: "", phone: "" }]);

  // --- Mass-Send state ---
  const [massZones, setMassZones] = useState<string[]>([]);
  const [massTemplateCode, setMassTemplateCode] = useState("");
  const [massSeverity, setMassSeverity] = useState<string>("info");
  const [massSource, setMassSource] = useState("");
  const [massCenter, setMassCenter] = useState("");
  const [massRoute, setMassRoute] = useState("");
  const [massPreviewLang, setMassPreviewLang] = useState<"fil" | "ceb" | "en">("fil");
  const [massShowPreview, setMassShowPreview] = useState(false);

  const load = useCallback(async () => {
    const data = await get<{ contacts: Contact[]; templates: Template[] }>("/api/messages");
    setContacts(data.contacts);
    setTemplates(data.templates);
    setSelectedId((current) => current ?? data.contacts[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);

  const selected = contacts.find((contact) => contact.id === selectedId) ?? contacts[0];

  const visible = useMemo(() => contacts.filter((contact) => {
    const matches = `${contact.name} ${contact.phone}`.toLowerCase().includes(search.toLowerCase());
    const modeMatch = mode === "archive" ? contact.archived : !contact.archived;
    const filterMatch = filter === "all" || (filter === "unread" && contact.unread > 0) ||
      (filter === "sent" && contact.messages.some((m) => m.direction === "out")) ||
      (filter === "missed" && /missed call/i.test(contact.last_message)) ||
      (customFilters.includes(filter) && `${contact.name} ${contact.zone} ${contact.flags} ${contact.last_message}`.toLowerCase().includes(filter.toLowerCase()));
    return matches && mode !== "mass" && modeMatch && filterMatch;
  }), [contacts, customFilters, filter, mode, search]);

  const nextVisibleContact = useCallback((currentContacts: Contact[], excludeId: number): Contact | null => {
    const list = currentContacts.filter((c) => {
      const modeMatch = mode === "archive" ? c.archived : !c.archived;
      const filterMatch = filter === "all" || (filter === "unread" && c.unread > 0) ||
        (filter === "sent" && c.messages.some((m) => m.direction === "out")) ||
        (filter === "missed" && /missed call/i.test(c.last_message)) ||
        (customFilters.includes(filter) && `${c.name} ${c.zone} ${c.flags} ${c.last_message}`.toLowerCase().includes(filter.toLowerCase()));
      return modeMatch && filterMatch;
    });
    const idx = list.findIndex((c) => c.id === excludeId);
    if (idx >= 0 && idx + 1 < list.length) return list[idx + 1];
    if (list.length > 0) return list[0];
    return null;
  }, [mode, filter, customFilters]);

  const mutateContact = useCallback(async (action: string, values: Record<string, unknown>) => {
    if (!selected) return;
    const archiveAction = action === "archive";
    const previousId = selected.id;
    await post("/api/messages", { action, resident_id: selected.id, ...values });
    const data = await get<{ contacts: Contact[]; templates: Template[] }>("/api/messages");
    setContacts(data.contacts);
    setTemplates(data.templates);
    if (archiveAction) {
      const next = nextVisibleContact(data.contacts, previousId);
      setSelectedId(next?.id ?? null);
    } else {
      setSelectedId((current) => current ?? data.contacts[0]?.id ?? null);
    }
    setLoading(false);
  }, [selected, nextVisibleContact]);

  const useTemplate = (body: string) => {
    if (!selected) return;
    const address = selected.contact_details.address || `Zone ${selected.zone}`;
    let complete = body.replaceAll("{address}", address).replaceAll("{zone}", selected.zone).replaceAll("{zones}", selected.zone);
    if (!body.includes("{address}")) complete += `\n\nDestination: ${address}`;
    setDraft(complete);
  };

  const addCustomFilter = () => {
    const value = newFilter.trim();
    if (!value || customFilters.includes(value)) return;
    const next = [...customFilters, value];
    setCustomFilters(next);
    localStorage.setItem("daluyan_message_filters", JSON.stringify(next));
    setFilter(value);
    setNewFilter("");
    setFilterOpen(false);
  };

  const removeCustomFilter = (value: string) => {
    const next = customFilters.filter((f) => f !== value);
    setCustomFilters(next);
    localStorage.setItem("daluyan_message_filters", JSON.stringify(next));
    if (filter === value) setFilter("all");
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !draft.trim() || sending) return;
    setSending(true);
    try {
      const message = await post<Message>("/api/messages", { resident_id: selected.id, text: draft });
      setContacts((rows) => rows.map((contact) => contact.id === selected.id
        ? { ...contact, messages: [...contact.messages, message], last_message: message.text, last_timestamp: message.timestamp }
        : contact));
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  const addContact = async (event: FormEvent) => {
    event.preventDefault();
    setAddError("");
    try {
      const result = await post<{ resident_id: number }>("/api/messages", { action: "add_contact", ...newContact, relatives });
      await load();
      setSelectedId(result.resident_id);
      setAddOpen(false);
      setNewContact({ first_name: "", last_name: "", phone: "", alternate_phone: "", email: "", address: "", zone: "", language: "fil", notes: "" });
      setRelatives([{ name: "", relationship: "", phone: "" }]);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Unable to add contact.");
    }
  };

  // --- Mass-Send derived data ---
  const massActiveContacts = useMemo(() => contacts.filter((c) => !c.archived), [contacts]);
  const massFilteredContacts = useMemo(() => {
    if (massZones.length === 0) return massActiveContacts;
    return massActiveContacts.filter((c) => massZones.includes(c.zone));
  }, [massActiveContacts, massZones]);
  const massAvailableZones = useMemo(() => {
    const set = new Set<string>();
    massActiveContacts.forEach((c) => { if (c.zone) set.add(c.zone); });
    return Array.from(set).sort();
  }, [massActiveContacts]);
  const massSelectedTemplate = useMemo(() => templates.find((t) => t.code === massTemplateCode), [templates, massTemplateCode]);
  const massPreviewText = useMemo(() => {
    if (!massSelectedTemplate) return "";
    const sample = massFilteredContacts[0];
    const zone = massZones.length === 1 ? massZones[0] : (massZones.join(", ") || "all zones");
    const address = massCenter || sample?.contact_details.address || `Zone ${zone}`;
    let text = massSelectedTemplate.body
      .replaceAll("{address}", address)
      .replaceAll("{zone}", zone)
      .replaceAll("{zones}", zone);
    if (!massSelectedTemplate.body.includes("{address}") && massCenter) {
      text += `\n\nDestination: ${massCenter}`;
    }
    if (massRoute) {
      text += `\n\nRoute: ${massRoute}`;
    }
    return text;
  }, [massSelectedTemplate, massFilteredContacts, massZones, massCenter, massRoute]);

  const statusMeta = (status: string): StatusMeta => STATUS_META[status] ?? { label: status.replaceAll("_", " "), color: "#6b7280", textColor: "#fff", phase: "before", description: "" };

  if (loading) return <div className="messages-loading">Loading messages…</div>;

  return (
    <section className={cn("messages-workspace", detailsOpen && "is-details-open")}>
      <div className="messages-list-panel">
        <header className="messages-panel-heading">
          <h1>Messages</h1>
          <div className="messages-heading-actions">
            <button onClick={() => setAddOpen(true)}><Plus size={17} /> Add</button>
            <button onClick={() => setLang(lang === "en" ? "fil" : "en")} aria-label="Change interface language"><Languages size={16} /> {lang === "en" ? "ENG" : "FIL"}</button>
          </div>
        </header>

        <div className="messages-mode-tabs">
          <button className={cn(mode === "active" && "is-active")} onClick={() => setMode("active")}>Active</button>
          <button className={cn(mode === "archive" && "is-active")} onClick={() => setMode("archive")}>Archive</button>
          <button className={cn(mode === "mass" && "is-active")} onClick={() => setMode("mass")}>Mass-Send</button>
        </div>
        <label className="messages-search"><Search size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Number or Name" /></label>
        <div className="messages-filter-row">
          <button className={cn(filter === "all" && "is-active")} onClick={() => setFilter("all")}>All</button>
          <button className={cn(filter === "sent" && "is-active")} onClick={() => setFilter("sent")}>Sent</button>
          <button className={cn(filter === "unread" && "is-active")} onClick={() => setFilter("unread")}>Unread · {contacts.reduce((n, c) => n + c.unread, 0)}</button>
          <button className={cn(filter === "missed" && "is-active")} onClick={() => setFilter("missed")}>Missed Call</button>
          {customFilters.map((item) => (
            <span key={item} className={cn("messages-filter-chip-custom", filter === item && "is-active")}>
              <button onClick={() => setFilter(item)}>{item}</button>
              <button className="messages-filter-chip-remove" onClick={() => removeCustomFilter(item)} aria-label={`Remove filter ${item}`}><X size={10} /></button>
            </span>
          ))}
          <button aria-label="Create custom filter" onClick={() => setFilterOpen((open) => !open)}><Plus size={15} /></button>
        </div>
        {filterOpen && <div className="messages-filter-builder"><input autoFocus value={newFilter} onChange={(e) => setNewFilter(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomFilter()} placeholder="Keyword, zone, or flag" /><button onClick={addCustomFilter}>Save filter</button></div>}

        <div className="messages-contact-list">
          {visible.map((contact) => {
            const sm = statusMeta(contact.flood_status ?? "monitoring");
            return (
              <button key={contact.id} className={cn("messages-contact", selected?.id === contact.id && "is-selected")} onClick={() => setSelectedId(contact.id)}>
                <span className="messages-avatar">{initials(contact.name)}</span>
                <span className="messages-contact-copy"><strong>{contact.name}</strong><span>{contact.last_message}</span></span>
                <span className="messages-contact-meta">
                  {time(contact.last_timestamp)}
                  {contact.unread > 0 && <i />}
                </span>
              </button>
            );
          })}
          {visible.length === 0 && <div className="messages-empty">No matching conversations.</div>}
        </div>
      </div>

      <div className="messages-thread-panel">
        {mode === "mass" ? (
          <div className="messages-mass-panel">
            <header className="messages-mass-header">
              <h2>Mass-Send</h2>
              <p>Compose a bulk SMS alert. Preview before sending — this scaffold does not fire live messages.</p>
            </header>

            <div className="messages-mass-grid">
              <div className="messages-mass-section">
                <h3>Zones</h3>
                <p className="messages-mass-hint">Select zones to include. No selection = all active contacts.</p>
                <div className="messages-mass-zones">
                  {massAvailableZones.map((zone) => (
                    <button key={zone} className={cn("messages-mass-zone", massZones.includes(zone) && "is-active")} onClick={() => setMassZones((prev) => prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone])}>
                      Zone {zone}
                    </button>
                  ))}
                  {massAvailableZones.length === 0 && <span className="messages-mass-empty-text">No zones available.</span>}
                </div>
                <div className="messages-mass-recipient-count">
                  {massFilteredContacts.length} recipient{massFilteredContacts.length !== 1 ? "s" : ""} will receive this message
                </div>
              </div>

              <div className="messages-mass-section">
                <h3>Template</h3>
                <select value={massTemplateCode} onChange={(e) => setMassTemplateCode(e.target.value)}>
                  <option value="">Choose a template…</option>
                  {templates.map((t) => <option key={t.id} value={t.code}>{t.code} ({LANGUAGES.find((l) => l.value === t.language)?.label ?? t.language})</option>)}
                </select>
              </div>

              <div className="messages-mass-section">
                <h3>Severity</h3>
                <div className="messages-mass-severity">
                  {SEVERITY_OPTIONS.map((opt) => (
                    <button key={opt.value} className={cn("messages-mass-severity-btn", massSeverity === opt.value && "is-active")} onClick={() => setMassSeverity(opt.value)} style={massSeverity === opt.value ? { borderColor: opt.color, background: `${opt.color}11` } : undefined}>
                      <span className="messages-mass-severity-dot" style={{ background: opt.color }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="messages-mass-section messages-mass-fields">
                <label><span>Source / Sender</span><input value={massSource} onChange={(e) => setMassSource(e.target.value)} placeholder="e.g. Brgy Mahogany" /></label>
                <label><span>Command Center</span><input value={massCenter} onChange={(e) => setMassCenter(e.target.value)} placeholder="e.g. Municipal Hall" /></label>
                <label className="is-wide"><span>Evacuation Route</span><input value={massRoute} onChange={(e) => setMassRoute(e.target.value)} placeholder="e.g. Riverside-Chapel path" /></label>
              </div>
            </div>

            <div className="messages-mass-preview-area">
              <div className="messages-mass-preview-tabs">
                {(["fil", "ceb", "en"] as const).map((l) => (
                  <button key={l} className={cn(massPreviewLang === l && "is-active")} onClick={() => setMassPreviewLang(l)}>
                    {LANGUAGES.find((item) => item.value === l)?.label ?? l}
                  </button>
                ))}
                <button className={cn("messages-mass-preview-toggle", massShowPreview && "is-active")} onClick={() => setMassShowPreview((open) => !open)}>
                  {massShowPreview ? "Hide preview" : "Show preview"}
                </button>
              </div>
              {massShowPreview && (
                <div className="messages-mass-preview-content">
                  {massPreviewText ? (
                    <>
                      <div className="messages-mass-preview-label">Preview ({LANGUAGES.find((l) => l.value === massPreviewLang)?.label ?? massPreviewLang})</div>
                      <div className="messages-mass-preview-text">{massPreviewText}</div>
                      <div className="messages-mass-preview-meta">{massPreviewText.length} chars · {Math.ceil(massPreviewText.length / 160)} SMS segment{Math.ceil(massPreviewText.length / 160) !== 1 ? "s" : ""}</div>
                    </>
                  ) : (
                    <div className="messages-mass-preview-empty">Select a template above to see the preview.</div>
                  )}
                </div>
              )}
            </div>

            <div className="messages-mass-actions">
              <div className="messages-mass-send-guard">
                <button className="messages-mass-send-btn" disabled>
                  <Send size={16} /> Send Wave
                </button>
                <span className="messages-mass-send-note">Preview is ready. Live sending is not enabled in this scaffold.</span>
              </div>
            </div>
          </div>
        ) : selected ? (
          <>
            <header className="messages-thread-header">
              <span className="messages-avatar messages-avatar--small">{initials(selected.name)}</span>
              <strong>{selected.name}</strong><span>Zone {selected.zone}</span>
              <button className={cn("messages-info-button", detailsOpen && "is-active")} onClick={() => setDetailsOpen((open) => !open)} aria-label={detailsOpen ? "Hide contact information" : "Show contact information"}><Info /></button>
            </header>
            <div className="messages-thread">
              {selected.messages.length === 0 && <div className="messages-thread-empty"><MessageCircle /><strong>No messages yet</strong><span>Send a demo message to begin this conversation.</span></div>}
              {selected.messages.map((message) => (
                <article key={`${message.direction}-${message.id}`} className={cn("messages-bubble-wrap", message.direction === "out" && "is-outgoing")}>
                  <div className="messages-bubble-meta">{message.direction === "out" ? "You" : selected.name} · {time(message.timestamp)}</div>
                  <div className="messages-bubble">{message.text}</div>
                </article>
              ))}
            </div>
            <form className="messages-composer" onSubmit={sendMessage}>
              <button type="button" aria-label="Add attachment"><Plus /></button>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type here" />
              <button className="messages-send" disabled={!draft.trim() || sending} aria-label="Send message"><Send /></button>
            </form>
          </>
        ) : (
          <div className="messages-thread-empty"><MessageCircle /><strong>Select a conversation</strong></div>
        )}
      </div>

      {detailsOpen && selected && (
        <aside className="messages-details-panel">
          <div className="messages-profile">
            <span className="messages-profile-avatar"><UserRound /></span>
            <h2>{selected.name}</h2><p>{selected.phone}</p>
            <div className="messages-profile-actions">
              <button onClick={() => window.location.href = `tel:${selected.phone}`}><Phone /><span>Voice</span></button>
              <button title="Video calls require a connected provider"><Video /><span>Video</span></button>
              <button onClick={() => setManageOpen(true)}><MoreHorizontal /><span>Manage</span></button>
            </div>
            <button className="messages-status" onClick={() => setStatusOpen((open) => !open)}>
              <span className="messages-status-strip" style={{ background: statusMeta(selected.flood_status ?? "monitoring").color }} />
              <ChevronDown />
              <span>{statusMeta(selected.flood_status ?? "monitoring").label}</span>
              <span className="messages-status-label"> · Change Status</span>
            </button>
            {statusOpen && (
              <div className="messages-status-menu">
                {STATUS_PHASES.map((group) => (
                  <section key={group.phase}>
                    <strong>{group.phase}</strong>
                    <small>{group.help}</small>
                    {group.items.map(([value, label]) => {
                      const meta = STATUS_META[value];
                      return (
                        <button key={value} className={cn(selected.flood_status === value && "is-active")} onClick={() => { mutateContact("status", { status: value }); setStatusOpen(false); }}>
                          <span className="messages-status-item-strip" style={{ background: meta?.color ?? "#6b7280" }} />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </section>
                ))}
              </div>
            )}
            <button className="messages-archive" onClick={() => mutateContact("archive", { archived: !selected.archived })}><Archive />{selected.archived ? "Restore to active" : "Archive conversation"}</button>
          </div>
          <div className="messages-details-section">
            <h3>Operations</h3>
            {templates.filter((item) => item.language === selected.language).slice(0, showAllTemplates ? undefined : 2).map((template) => (
              <button key={template.id} className="messages-template" onClick={() => useTemplate(template.body)}>
                <span><strong>{template.code}</strong><small>{template.body}</small></span><Send />
              </button>
            ))}
            {templates.filter((item) => item.language === selected.language).length > 2 && <button className="messages-see-more" onClick={() => setShowAllTemplates((show) => !show)}><ChevronDown /> {showAllTemplates ? "Show less" : "See more"}</button>}
          </div>
          <button className="messages-media" onClick={() => setMediaOpen((open) => !open)}><FileImage /> Media, Images, and Links</button>
          {mediaOpen && <div className="messages-media-panel"><div className="messages-media-tabs"><button className={cn(mediaTab === "media" && "is-active")} onClick={() => setMediaTab("media")}><Paperclip/>Media</button><button className={cn(mediaTab === "images" && "is-active")} onClick={() => setMediaTab("images")}><Image/>Images</button><button className={cn(mediaTab === "links" && "is-active")} onClick={() => setMediaTab("links")}><Link2/>Links</button></div><div className="messages-media-empty">No {mediaTab} shared in this conversation yet.</div></div>}
          <div className="messages-details-section messages-resident-info">
            <h3>Resident details</h3>
            <p><strong>Zone</strong><span>{selected.zone}</span></p>
            <p><strong>Language</strong><span>{selected.language.toUpperCase()}</span></p>
            <p><strong>Flags</strong><span>{selected.flags || "None"}</span></p>
            {selected.contact_details.email && <p><strong>Email</strong><span>{selected.contact_details.email}</span></p>}
            {selected.contact_details.alternate_phone && <p><strong>Other phone</strong><span>{selected.contact_details.alternate_phone}</span></p>}
            {selected.contact_details.address && <p><strong>Address</strong><span>{selected.contact_details.address}</span></p>}
          </div>
          {selected.relatives.length > 0 && <div className="messages-details-section messages-relatives"><h3>Relatives</h3>{selected.relatives.map((relative) => <div key={relative.id}><span className="messages-avatar messages-avatar--relative">{initials(relative.name)}</span><p><strong>{relative.name}</strong><small>{relative.relationship || "Relative"} · {relative.phone || "No phone"}</small></p></div>)}</div>}
        </aside>
      )}

      {manageOpen && selected && <div className="contact-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setManageOpen(false)}>
        <form className="contact-modal contact-modal--manage" onSubmit={async (event) => {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(event.currentTarget).entries());
          await mutateContact("update_contact", values); setManageOpen(false);
        }}>
          <header><div><h2>Manage resident</h2><p>Update contact, location, language, and vulnerability context.</p></div><button type="button" onClick={() => setManageOpen(false)} aria-label="Close"><X /></button></header>
          <div className="contact-form-grid">
            <label className="is-wide"><span>Full name *</span><input name="name" required defaultValue={selected.name}/></label>
            <label><span>Phone *</span><input name="phone" required defaultValue={selected.phone}/></label>
            <label><span>Other phone</span><input name="alternate_phone" defaultValue={selected.contact_details.alternate_phone}/></label>
            <label><span>Email</span><input name="email" type="email" defaultValue={selected.contact_details.email}/></label>
            <label><span>Zone</span><input name="zone" defaultValue={selected.zone}/></label>
            <label className="is-wide"><span>Complete address</span><input name="address" defaultValue={selected.contact_details.address}/></label>
            <label><span>Language</span><select name="language" defaultValue={selected.language}><option value="fil">Filipino</option><option value="ceb">Cebuano</option><option value="en">English</option></select></label>
            <label><span>Vulnerability flags</span><input name="flags" defaultValue={selected.flags}/></label>
            <label className="is-wide"><span>Operator notes</span><textarea name="notes" rows={3} defaultValue={selected.contact_details.notes}/></label>
          </div>
          <footer><button type="button" onClick={() => setManageOpen(false)}>Cancel</button><button className="is-primary" type="submit">Save changes</button></footer>
        </form>
      </div>}

      {addOpen && <div className="contact-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAddOpen(false)}>
        <form className="contact-modal" onSubmit={addContact}>
          <header><div><h2>Add contact</h2><p>Create a resident conversation using the existing Daluyan database.</p></div><button type="button" onClick={() => setAddOpen(false)} aria-label="Close"><X /></button></header>
          <div className="contact-form-grid">
            <label><span>First name *</span><input required value={newContact.first_name} onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })} /></label>
            <label><span>Last name *</span><input required value={newContact.last_name} onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })} /></label>
            <label><span>Phone number *</span><input required value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} placeholder="09…" /></label>
            <label><span>Other phone</span><input value={newContact.alternate_phone} onChange={(e) => setNewContact({ ...newContact, alternate_phone: e.target.value })} /></label>
            <label><span>Email</span><input type="email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} /></label>
            <label><span>Zone</span><input value={newContact.zone} onChange={(e) => setNewContact({ ...newContact, zone: e.target.value })} /></label>
            <label className="is-wide"><span>Address</span><input value={newContact.address} onChange={(e) => setNewContact({ ...newContact, address: e.target.value })} /></label>
            <label><span>Language</span><select value={newContact.language} onChange={(e) => setNewContact({ ...newContact, language: e.target.value })}><option value="fil">Filipino</option><option value="ceb">Cebuano</option><option value="en">English</option></select></label>
            <label className="is-wide"><span>Other contact information</span><textarea value={newContact.notes} onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })} rows={3} /></label>
          </div>
          <section className="contact-relatives"><div className="contact-relatives-heading"><div><h3>Possible relatives</h3><p>Add people operators may contact on this resident's behalf.</p></div><button type="button" onClick={() => setRelatives([...relatives, { name: "", relationship: "", phone: "" }])}><Plus /> Add relative</button></div>
            {relatives.map((relative, index) => <div className="contact-relative-row" key={index}>
              <input value={relative.name} onChange={(e) => setRelatives(relatives.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} placeholder="Full name" />
              <input value={relative.relationship} onChange={(e) => setRelatives(relatives.map((item, i) => i === index ? { ...item, relationship: e.target.value } : item))} placeholder="Relationship" />
              <input value={relative.phone} onChange={(e) => setRelatives(relatives.map((item, i) => i === index ? { ...item, phone: e.target.value } : item))} placeholder="Phone" />
              <button type="button" onClick={() => setRelatives(relatives.filter((_, i) => i !== index))} aria-label="Remove relative"><Trash2 /></button>
            </div>)}
          </section>
          {addError && <p className="contact-form-error">{addError}</p>}
          <footer><button type="button" onClick={() => setAddOpen(false)}>Cancel</button><button className="is-primary" type="submit">Add contact</button></footer>
        </form>
      </div>}
    </section>
  );
}
