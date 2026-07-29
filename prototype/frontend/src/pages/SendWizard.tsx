import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, Ban, ChevronLeft } from "lucide-react";
import { get, post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const TEMPLATE_META: Record<string, { fil: string; en: string; tone: string }> = {
  HEADSUP: { fil: "Babala — may paparating", en: "Heads-up — storm incoming (T-24h)", tone: "border-amber-200" },
  PREPARE: { fil: "Paghahanda — i-charge, mag-empake", en: "Prepare — charge phones, pack (T-6h)", tone: "border-amber-300" },
  EVACUATE: { fil: "Lumikas na", en: "Evacuate now (T-2h)", tone: "border-red-300" },
};

export default function SendWizard() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [zonesAvail, setZonesAvail] = useState<any[]>([]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    template_code: "", zones: [] as string[], severity: "normal",
    center: "Barangay Hall", route_status: "open", route_note: "", source: "PAGASA via MDRRMO",
  });
  const [preview, setPreview] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { get("/api/summary").then((s) => setZonesAvail(s.zones)); }, []);

  const doPreview = async () => {
    const p = await post("/api/preview", { ...form, zones: form.zones.join(",") });
    setPreview(p); setStep(4);
  };
  const doSend = async () => {
    setSending(true); setError("");
    try {
      const r = await post("/api/send", { ...form, zones: form.zones.join(",") });
      nav(`/event/${r.alert_id}`);
    } catch (e: any) { setError(e.message); setSending(false); }
  };

  const routeOpts = [
    { v: "open", icon: CheckCircle2, cls: "text-green-700", sel: "border-green-500 bg-green-50", title: t("routeOpen"), sub: t("routeOpenSub") },
    { v: "affected", icon: AlertCircle, cls: "text-amber-600", sel: "border-amber-500 bg-amber-50", title: t("routeAffected"), sub: t("routeAffectedSub") },
    { v: "closed", icon: Ban, cls: "text-red-700", sel: "border-red-500 bg-red-50", title: t("routeClosed"), sub: t("routeClosedSub") },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{t("stepOf")} {Math.min(step, 4)}/4</span>
        <Progress value={step * 25} className="flex-1" />
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <h1 className="text-lg font-semibold">{t("whatWarning")}</h1>
          {Object.entries(TEMPLATE_META).map(([code, meta]) => (
            <Card key={code}
              className={cn("cursor-pointer transition hover:bg-zinc-50", meta.tone,
                form.template_code === code && "ring-2 ring-zinc-900")}
              onClick={() => { setForm({ ...form, template_code: code, severity: code === "EVACUATE" ? "critical" : "normal" }); setStep(2); }}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">{lang === "fil" ? meta.fil : meta.en}</div>
                  <div className="text-xs text-muted-foreground">{code}</div>
                </div>
                {code === "EVACUATE" && <Badge variant="destructive">{t("critical")}</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <h1 className="text-lg font-semibold">{t("whichZones")}</h1>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {zonesAvail.map((z) => {
              const on = form.zones.includes(z.zone);
              return (
                <button key={z.zone}
                  onClick={() => setForm({ ...form, zones: on ? form.zones.filter((x) => x !== z.zone) : [...form.zones, z.zone] })}
                  className={cn("rounded-lg border p-3 text-center transition",
                    on ? "border-zinc-900 bg-zinc-900 text-white" : "bg-white hover:bg-zinc-50")}>
                  <div className="text-lg font-semibold">Zone {z.zone}</div>
                  <div className={cn("text-xs", on ? "text-zinc-300" : "text-muted-foreground")}>{z.c} {t("households")}</div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)}><ChevronLeft size={16} />{t("back")}</Button>
            <Button disabled={!form.zones.length} onClick={() => setStep(3)}>{t("next")}</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h1 className="text-lg font-semibold">{t("routeQ")}</h1>
          <div className="space-y-2">
            {routeOpts.map((o) => (
              <Card key={o.v}
                className={cn("cursor-pointer border transition hover:bg-zinc-50", form.route_status === o.v && o.sel)}
                onClick={() => setForm({ ...form, route_status: o.v })}>
                <CardContent className="flex items-center gap-3 p-4">
                  <o.icon className={o.cls} size={22} />
                  <div>
                    <div className="font-medium">{o.title}</div>
                    <div className="text-xs text-muted-foreground">{o.sub}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>{t("center")}</Label>
              <Input value={form.center} onChange={(e) => setForm({ ...form, center: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t("routeNote")}</Label>
              <Input value={form.route_note} placeholder="Riverside–Chapel path"
                onChange={(e) => setForm({ ...form, route_note: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>{t("source")}</Label>
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
          </div>
          <div className="flex justify-between pt-1">
            <Button variant="ghost" onClick={() => setStep(2)}><ChevronLeft size={16} />{t("back")}</Button>
            <Button onClick={doPreview}>{t("previewSms")}</Button>
          </div>
        </div>
      )}

      {step === 4 && preview && (
        <div className="space-y-3">
          <h1 className="text-lg font-semibold">{t("previewSms")}</h1>
          {preview.previews.map((p: any) => (
            <Card key={p.language}>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{p.language.toUpperCase()}</Badge>
                  <span>{p.recipients} {t("recipients")} · {p.chars} chars · {p.segments} {t("segments")}</span>
                  {p.errors.length ? <Badge variant="destructive">{t("blocked")}: {p.errors.join("; ")}</Badge>
                    : p.warnings.length ? <Badge variant="warning">{p.warnings.join("; ")}</Badge>
                    : <Badge variant="success">{t("linterPass")}</Badge>}
                </div>
                <div className="whitespace-pre-wrap rounded-lg bg-zinc-100 p-3 font-mono text-[13px] leading-relaxed">{p.body}</div>
              </CardContent>
            </Card>
          ))}
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          <div className="flex justify-between pt-1">
            <Button variant="ghost" onClick={() => setStep(3)}><ChevronLeft size={16} />{t("back")}</Button>
            <Button variant="destructive" size="lg" disabled={preview.blocked || sending} onClick={doSend}>
              {sending ? "…" : `${t("sendWave")} ${preview.previews.reduce((a: number, p: any) => a + p.recipients, 0)} ${t("recipients")}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
