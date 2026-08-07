import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive, ChevronDown, FileImage, Languages, MessageCircle, MoreHorizontal,
  Phone, Plus, Search, Send, UserRound, Video,
} from "lucide-react";
import { get, post } from "@/lib/api";
import { cn } from "@/lib/utils";

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
};

type Template = { id: number; code: string; language: string; body: string };

const time = (value?: string) => value ? value.slice(11, 16) : "";
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

export default function MessagesPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

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
    return matches && (filter === "all" || contact.unread > 0);
  }), [contacts, filter, search]);

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

  if (loading) return <div className="messages-loading">Loading messages…</div>;

  return (
    <section className="messages-workspace">
      <div className="messages-list-panel">
        <header className="messages-panel-heading">
          <h1>Messages</h1>
          <div className="messages-heading-actions">
            <button><Plus size={17} /> Add</button>
            <button><Languages size={16} /> ENG</button>
          </div>
        </header>

        <div className="messages-mode-tabs">
          <button className="is-active">Active</button><button>Archive</button><button>Mass-Send</button>
        </div>
        <label className="messages-search"><Search size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Number or Name" /></label>
        <div className="messages-filter-row">
          <button className={cn(filter === "all" && "is-active")} onClick={() => setFilter("all")}>All</button>
          <button>Sent</button>
          <button className={cn(filter === "unread" && "is-active")} onClick={() => setFilter("unread")}>Unread · {contacts.reduce((n, c) => n + c.unread, 0)}</button>
          <button>Missed Call</button><button aria-label="More filters"><Plus size={15} /></button>
        </div>

        <div className="messages-contact-list">
          {visible.map((contact) => (
            <button key={contact.id} className={cn("messages-contact", selected?.id === contact.id && "is-selected")} onClick={() => setSelectedId(contact.id)}>
              <span className="messages-avatar">{initials(contact.name)}</span>
              <span className="messages-contact-copy"><strong>{contact.name}</strong><span>{contact.last_message}</span></span>
              <span className="messages-contact-meta">{time(contact.last_timestamp)}{contact.unread > 0 && <i />}</span>
            </button>
          ))}
          {visible.length === 0 && <div className="messages-empty">No matching conversations.</div>}
        </div>
      </div>

      <div className="messages-thread-panel">
        {selected ? <>
          <header className="messages-thread-header">
            <span className="messages-avatar messages-avatar--small">{initials(selected.name)}</span>
            <strong>{selected.name}</strong><span>Zone {selected.zone}</span>
            <button aria-label="Conversation options"><MoreHorizontal /></button>
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

      <aside className="messages-details-panel">
        {selected && <>
          <div className="messages-profile">
            <span className="messages-profile-avatar"><UserRound /></span>
            <h2>{selected.name}</h2><p>{selected.phone}</p>
            <div className="messages-profile-actions">
              <button><Phone /><span>Voice</span></button><button><Video /><span>Video</span></button><button><MoreHorizontal /><span>Manage</span></button>
            </div>
            <button className="messages-status"><ChevronDown /> Change Status</button>
          </div>
          <div className="messages-details-section">
            <h3>Operations</h3>
            {templates.filter((item) => item.language === selected.language).slice(0, 2).map((template) => (
              <button key={template.id} className="messages-template" onClick={() => setDraft(template.body)}>
                <span><strong>{template.code}</strong><small>{template.body}</small></span><Send />
              </button>
            ))}
            <button className="messages-see-more"><ChevronDown /> See more</button>
          </div>
          <button className="messages-media"><FileImage /> Media, Images, and Links</button>
          <div className="messages-details-section messages-resident-info">
            <h3>Resident details</h3>
            <p><strong>Zone</strong><span>{selected.zone}</span></p>
            <p><strong>Language</strong><span>{selected.language.toUpperCase()}</span></p>
            <p><strong>Flags</strong><span>{selected.flags || "None"}</span></p>
          </div>
        </>}
      </aside>
    </section>
  );
}
