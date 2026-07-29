import { useEffect, useRef, useState } from "react";
import { get, postForm } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function SimulatorPage() {
  const { t } = useI18n();
  const [residents, setResidents] = useState<any[]>([]);
  const [who, setWho] = useState<string>("");
  const [thread, setThread] = useState<any[]>([]);
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    get("/api/residents").then((r) => { setResidents(r); if (r.length && !who) setWho(String(r[0].id)); });
  }, []);

  useEffect(() => {
    if (!who) return;
    const load = () => get(`/simulator/${who}/thread`).then((d) => setThread(d.thread));
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [who]);

  useEffect(() => { scroller.current?.scrollTo(0, 99999); }, [thread]);

  const phone = residents.find((r) => String(r.id) === who)?.phone || "";
  const send = async (msg: string) => {
    if (!msg) return;
    await postForm("/inbound", { from: phone, message: msg });
    setText("");
    setTimeout(() => get(`/simulator/${who}/thread`).then((d) => setThread(d.thread)), 400);
  };

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <Select value={who} onChange={(e) => setWho(e.target.value)}>
        {residents.map((r) => (
          <option key={r.id} value={r.id}>{r.name} — z{r.zone} ({r.language}) {r.phone}</option>
        ))}
      </Select>
      <Card>
        <CardContent className="p-3">
          <div ref={scroller} className="h-80 space-y-2 overflow-y-auto rounded-lg bg-zinc-50 p-3">
            {thread.map((m: any, i) => (
              <div key={i} className={cn("max-w-[85%] rounded-xl px-3 py-2 text-[13px] whitespace-pre-wrap",
                m.dir === "out" ? "bg-white border" : "ml-auto bg-green-100")}>
                {m.dir === "out" ? m.body : m.raw_text}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {m.dir === "out" ? m.status : (m.keyword || "unrecognized")} · {(m.created_at || m.received_at || "").slice(5, 16)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="SAFE, EVAC, TULONG…"
              onKeyDown={(e) => e.key === "Enter" && send(text)} />
            <Button onClick={() => send(text)}>Send</Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="py-1 text-xs text-muted-foreground">{t("sendTest")}</span>
            {["SAFE", "EVAC", "TULONG", "GAMOT", "NAIPIT KAMI"].map((k) => (
              <Button key={k} size="sm" variant="outline" onClick={() => send(k)}>{k}</Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
