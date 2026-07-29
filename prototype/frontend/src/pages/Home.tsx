import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, UserPlus, CheckCircle2, CircleAlert, ChevronRight, FileCheck2, FileWarning, Wifi, Send } from "lucide-react";
import { get } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EventBoard from "./EventBoard";
import { cn } from "@/lib/utils";

export default function Home() {
  const { t } = useI18n();
  const [sum, setSum] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    const load = () => {
      get("/api/summary").then(setSum).catch(() => {});
      get("/api/alerts").then(setAlerts).catch(() => {});
      get("/api/templates").then(setTemplates).catch(() => {});
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  if (!sum) return <div className="py-16 text-center text-sm text-muted-foreground">…</div>;
  if (sum.active_alert) return <EventBoard alertId={sum.active_alert.id} />;

  const consentPct = sum.residents ? Math.round((sum.consented / sum.residents) * 100) : 0;
  const approved = templates.length > 0 && templates.some((x) => !String(x.approved_by || "").toUpperCase().includes("DRAFT"));
  const isMock = sum.gateway === "mock";
  const last = alerts[0];
  const lastPct = last && last.counts.total ? Math.round((last.counts.sent / last.counts.total) * 100) : null;
  const maxZone = Math.max(1, ...sum.zones.map((z: any) => z.c));

  const readiness = [
    { ok: consentPct >= 90, label: t("consentCoverage"), value: `${consentPct}% (${sum.consented}/${sum.residents})`, icon: CheckCircle2 },
    { ok: approved, label: t("templatesStatus"), value: approved ? t("approved") : t("draftStatus"), icon: approved ? FileCheck2 : FileWarning },
    { ok: !isMock, label: t("gatewayStatus"), value: isMock ? t("simulationMode") : `${sum.gateway.toUpperCase()}${sum.balance ? " · " + sum.balance : ""}`, icon: Wifi },
    { ok: lastPct !== null && lastPct >= 90, label: t("lastAlertDelivery"), value: lastPct !== null ? `${lastPct}% · ${last.template_code} z${last.zones}` : t("noAlertsYet"), icon: Send },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 size={17} className="text-green-700" />
        <span className="font-semibold text-green-800">{t("ready")}</span>
        <span className="text-muted-foreground">— {sum.consented} {t("households")} · {sum.gateway.toUpperCase()} {t("gatewayOk")}</span>
      </div>

      {sum.triage > 0 && (
        <Link to="/triage" className="block">
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 transition hover:bg-red-100/70">
            <CircleAlert className="shrink-0 text-red-700" size={20} />
            <span className="text-sm font-medium text-red-900">{sum.triage} {t("triageBanner")}</span>
            <ChevronRight className="ml-auto text-red-700" size={18} />
          </div>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Link to="/send" className="lg:col-span-2">
          <Card className="h-full border-red-200 bg-red-50 transition hover:border-red-300 hover:bg-red-100/70">
            <CardContent className="flex h-full flex-col justify-center p-7">
              <AlertTriangle className="text-red-700" size={30} />
              <div className="mt-3 text-2xl font-bold tracking-tight text-red-950">{t("sendAlert")}</div>
              <div className="mt-1 text-sm text-red-800/80">{t("sendAlertSub")}</div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/registry">
          <Card className="h-full transition hover:bg-zinc-50">
            <CardContent className="flex h-full flex-col justify-center p-7">
              <UserPlus className="text-zinc-500" size={26} />
              <div className="mt-3 text-lg font-semibold">{t("enroll")}</div>
              <div className="mt-1 text-sm text-muted-foreground">{t("enrollSub")}</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-[13px] uppercase tracking-wide text-muted-foreground">{t("readiness")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {readiness.map((r) => (
              <div key={r.label} className="flex items-start gap-2.5">
                <r.icon size={16} className={cn("mt-0.5 shrink-0", r.ok ? "text-green-700" : "text-amber-600")} />
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{r.label}</div>
                  <div className={cn("text-sm font-medium", !r.ok && "text-amber-700")}>{r.value}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-[13px] uppercase tracking-wide text-muted-foreground">{t("zoneCoverage")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sum.zones.map((z: any) => (
              <div key={z.zone}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">Zone {z.zone}</span>
                  <span className="text-muted-foreground tabular-nums">{z.c} {t("households")}</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-100">
                  <div className="h-1.5 rounded-full bg-zinc-800" style={{ width: `${(z.c / maxZone) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-[13px] uppercase tracking-wide text-muted-foreground">{t("recentAlerts")}</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {alerts.length === 0 && <div className="text-sm text-muted-foreground">{t("noAlertsYet")}</div>}
            {alerts.slice(0, 5).map((a) => (
              <Link key={a.id} to={`/event/${a.id}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-zinc-50">
                <span className="font-medium">{a.template_code}</span>
                <span className="text-xs text-muted-foreground">z{a.zones}</span>
                <Badge variant={a.counts.unreached ? "destructive" : "success"} className="ml-auto tabular-nums">
                  {a.counts.sent}/{a.counts.total}
                </Badge>
                <span className="text-[11px] text-muted-foreground tabular-nums">{String(a.created_at).slice(5, 10)}</span>
              </Link>
            ))}
            {alerts.length > 0 && (
              <Link to="/audit" className="block pt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-zinc-700">
                {t("history")}
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
