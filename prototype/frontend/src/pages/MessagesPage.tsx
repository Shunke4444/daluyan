import { FormEvent, useEffect, useMemo, useState } from "react";
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

const time = (value?: string) => value ? value.slice(11, 16) : "";
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

export default function MessagesPage() {
  const { lang, setLang } = useI18n();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState<"active" | "archive" | "mass">("active");
  const [customFilters, setCustomFilters] = useState<string[]>(() => JSON.parse(localStorage.getItem("daluyan_message_filters") || "[]"));
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

  const load = async () => {
    const data = await get<{ contacts: Contact[]; templates: Template[] }>("/api/messages");
    setContacts(data.contacts);
    setTemplates(data.templates);
    setSelectedId((current) => current ?? data.contacts[0]?.id ?? null);
    setLoading(false);
  };

  useEffect(() => { load().catch(() => setLoading(false)); }, []);

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

  const mutateContact = async (action: string, values: Record<string, unknown>) => {
    if (!selected) return;
    await post("/api/messages", { action, resident_id: selected.id, ...values });
    await load();
  };

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
    setCustomFilters(next); localStorage.setItem("daluyan_message_filters", JSON.stringify(next));
    setFilter(value); setNewFilter(""); setFilterOpen(false);
  };

  const statusGroups = [
    { phase: "Before flood", help: "Readiness and early-warning state", items: [["monitoring", "Monitoring"], ["preparing", "Preparing to evacuate"]] },
    { phase: "During flood", help: "Live safety and response state", items: [["evacuating", "Evacuating"], ["safe", "Safe / accounted for"], ["needs_help", "Needs urgent help"]] },
    { phase: "After flood", help: "Return, recovery, and follow-up", items: [["recovery", "Recovery / needs assessment"]] },
  ];

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
          <button className={cn(mode === "active" && "is-active")} onClick={() => setMode("active")}>Active</button><button className={cn(mode === "archive" && "is-active")} onClick={() => setMode("archive")}>Archive</button><button className={cn(mode === "mass" && "is-active")} onClick={() => setMode("mass")}>Mass-Send</button>
        </div>
        <label className="messages-search"><Search size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Number or Name" /></label>
        <div className="messages-filter-row">
          <button className={cn(filter === "all" && "is-active")} onClick={() => setFilter("all")}>All</button>
          <button className={cn(filter === "sent" && "is-active")} onClick={() => setFilter("sent")}>Sent</button>
          <button className={cn(filter === "unread" && "is-active")} onClick={() => setFilter("unread")}>Unread · {contacts.reduce((n, c) => n + c.unread, 0)}</button>
          <button className={cn(filter === "missed" && "is-active")} onClick={() => setFilter("missed")}>Missed Call</button>
          {customFilters.map((item) => <button key={item} className={cn(filter === item && "is-active")} onClick={() => setFilter(item)}>{item}</button>)}
          <button aria-label="Create custom filter" onClick={() => setFilterOpen((open) => !open)}><Plus size={15} /></button>
        </div>
        {filterOpen && <div className="messages-filter-builder"><input autoFocus value={newFilter} onChange={(e) => setNewFilter(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomFilter()} placeholder="Keyword, zone, or flag"/><button onClick={addCustomFilter}>Save filter</button></div>}

        <div className="messages-contact-list">
          {visible.map((contact) => (
            <button key={contact.id} className={cn("messages-contact", selected?.id === contact.id && "is-selected")} onClick={() => setSelectedId(contact.id)}>
              <span className="messages-avatar">{initials(contact.name)}</span>
              <span className="messages-contact-copy"><strong>{contact.name}</strong><span>{contact.last_message}</span></span>
              <span className="messages-contact-meta">{time(contact.last_timestamp)}{contact.unread > 0 && <i />}</span>
            </button>
          ))}
          {visible.length === 0 && <div className="messages-empty">No matching conversations.</div>}
          {mode === "mass" && <div className="messages-empty">Choose Mass-Send from the alert workflow to contact zones safely.</div>}
        </div>
      </div>

      <div className="messages-thread-panel">
        {selected ? <>
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
        </> : <div className="messages-thread-empty"><MessageCircle /><strong>Select a conversation</strong></div>}
      </div>

      {detailsOpen && <aside className="messages-details-panel">
        {selected && <>
          <div className="messages-profile">
            <span className="messages-profile-avatar"><UserRound /></span>
            <h2>{selected.name}</h2><p>{selected.phone}</p>
            <div className="messages-profile-actions">
              <button onClick={() => window.location.href = `tel:${selected.phone}`}><Phone /><span>Voice</span></button><button title="Video calls require a connected provider"><Video /><span>Video</span></button><button onClick={() => setManageOpen(true)}><MoreHorizontal /><span>Manage</span></button>
            </div>
            <button className="messages-status" onClick={() => setStatusOpen((open) => !open)}><ChevronDown /> {(selected.flood_status ?? "monitoring").replaceAll("_", " ")} · Change Status</button>
            {statusOpen && <div className="messages-status-menu">{statusGroups.map((group) => <section key={group.phase}><strong>{group.phase}</strong><small>{group.help}</small>{group.items.map(([value, label]) => <button key={value} className={cn(selected.flood_status === value && "is-active")} onClick={() => { mutateContact("status", { status: value }); setStatusOpen(false); }}>{label}</button>)}</section>)}</div>}
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
        </>}
      </aside>}

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
          <section className="contact-relatives"><div className="contact-relatives-heading"><div><h3>Possible relatives</h3><p>Add people operators may contact on this resident’s behalf.</p></div><button type="button" onClick={() => setRelatives([...relatives, { name: "", relationship: "", phone: "" }])}><Plus /> Add relative</button></div>
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
