import { useEffect, useState } from "react";
import { get, postForm } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function Triage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);

  const load = () =>
    get("/api/audit").then((d) =>
      setRows(d.replies.filter((r: any) => !r.handled && (["HELP", "MEDICINE", "STRANDED"].includes(r.keyword) || !r.keyword))));
  useEffect(() => {
    load();
    const iv = setInterval(load, 4000);
    return () => clearInterval(iv);
  }, []);

  const handle = (id: number) => postForm(`/replies/${id}/handle`, {}).then(load);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{t("triageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("triageSub")}</p>
      </div>
      {rows.length === 0 && (
        <Card><CardContent className="flex items-center gap-2.5 p-6 text-sm text-green-800">
          <CheckCircle2 size={18} className="text-green-700" />{t("triageEmpty")}
        </CardContent></Card>
      )}
      {rows.map((r) => (
        <Card key={r.id} className={r.keyword ? "border-red-200" : ""}>
          <CardContent className="flex items-start gap-3 p-4">
            <Badge variant={r.keyword ? "destructive" : "muted"}>{r.keyword || t("unrecognized")}</Badge>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{r.name || r.phone}</div>
              <div className="mt-0.5 text-sm text-zinc-700">"{r.raw_text}"</div>
              <div className="mt-1 text-xs text-muted-foreground tabular-nums">{r.received_at} · alert #{r.alert_id ?? "—"}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => handle(r.id)}>{t("markHandled")}</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
