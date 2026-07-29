import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, UserPlus, CheckCircle2 } from "lucide-react";
import { get } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import EventBoard from "./EventBoard";

export default function Home() {
  const { t } = useI18n();
  const [sum, setSum] = useState<any>(null);
  useEffect(() => {
    const load = () => get("/api/summary").then(setSum).catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  if (!sum) return <div className="py-16 text-center text-sm text-muted-foreground">…</div>;

  if (sum.active_alert) {
    return <EventBoard alertId={sum.active_alert.id} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-green-700">
        <CheckCircle2 size={16} />
        <span className="font-medium">{t("ready")}</span>
        <span className="text-muted-foreground">
          — {sum.consented} {t("households")} · {sum.gateway.toUpperCase()} {t("gatewayOk")}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-5">
        <Link to="/send" className="sm:col-span-3">
          <Card className="h-full border-red-200 bg-red-50 transition hover:border-red-300 hover:bg-red-100/70">
            <CardContent className="p-6">
              <AlertTriangle className="text-red-700" size={28} />
              <div className="mt-3 text-xl font-semibold text-red-900">{t("sendAlert")}</div>
              <div className="mt-1 text-sm text-red-800/80">{t("sendAlertSub")}</div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/registry" className="sm:col-span-2">
          <Card className="h-full transition hover:bg-zinc-50">
            <CardContent className="p-6">
              <UserPlus className="text-zinc-500" size={26} />
              <div className="mt-3 text-lg font-semibold">{t("enroll")}</div>
              <div className="mt-1 text-sm text-muted-foreground">{t("enrollSub")}</div>
            </CardContent>
          </Card>
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">{t("registry")}</div>
          <div className="mt-1 text-2xl font-semibold">{sum.residents}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{sum.consented} {t("consented")}</span></div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Zones</div>
          <div className="mt-1 text-2xl font-semibold">{sum.zones.length}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {sum.zones.map((z: any) => `z${z.zone}:${z.c}`).join("  ")}</span></div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">{t("needsAttention")}</div>
          <div className={"mt-1 text-2xl font-semibold " + (sum.triage ? "text-red-700" : "")}>{sum.triage}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{t("unhandledReplies")}</span></div>
        </CardContent></Card>
      </div>
      <div className="text-xs text-muted-foreground">
        <Link to="/audit" className="underline underline-offset-2 hover:text-zinc-700">{t("history")}</Link>
      </div>
    </div>
  );
}
