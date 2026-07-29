import { useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const FLAGS = ["elderly", "pwd", "pregnant", "infant", "chronic_illness"];

export default function Registry() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", zone: "1", language: "fil", flags: [] as string[], consent: false });
  const [err, setErr] = useState("");

  const load = () => get("/api/residents").then(setRows);
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setErr("");
    try {
      await post("/api/residents", form);
      setForm({ name: "", phone: "", zone: form.zone, language: "fil", flags: [], consent: false });
      load();
    } catch (e: any) { setErr(e.message); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t("enroll")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>{t("name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t("phone")}</Label>
              <Input value={form.phone} placeholder="09171234567" onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t("zone")}</Label>
              <Input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t("language")}</Label>
              <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                <option value="fil">Filipino</option><option value="ceb">Cebuano</option>
              </Select></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>{t("flags")}</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {FLAGS.map((f) => {
                  const on = form.flags.includes(f);
                  return (
                    <button key={f} type="button"
                      onClick={() => setForm({ ...form, flags: on ? form.flags.filter((x) => x !== f) : [...form.flags, f] })}
                      className={"rounded-full border px-3 py-1 text-xs transition " + (on ? "border-amber-400 bg-amber-50 text-amber-900" : "bg-white text-zinc-600 hover:bg-zinc-50")}>
                      {f}
                    </button>
                  );
                })}
              </div></div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
              {t("consent")}
            </label>
            <Button onClick={submit} disabled={!form.name || !form.phone || !form.consent}>{t("enrollBtn")}</Button>
          </div>
          {err && <div className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-800">{err}</div>}
          <p className="mt-3 text-xs text-muted-foreground">{t("consentNote")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{rows.length} {t("registered")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Zone</TableHead>
              <TableHead>Lang</TableHead><TableHead>Flags</TableHead><TableHead>Consent</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                  <TableCell>{r.zone}</TableCell>
                  <TableCell>{r.language}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.flags || "").split(",").filter(Boolean).map((f: string) => (
                        <span key={f} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">{f}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{r.consent_at
                    ? <Badge variant="success">{String(r.consent_at).slice(0, 10)}</Badge>
                    : <Badge variant="destructive">none</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
