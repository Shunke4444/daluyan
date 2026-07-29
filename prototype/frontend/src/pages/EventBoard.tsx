import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { get, postForm } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DeliveryBar from "@/components/DeliveryBar";

const kwVariant = (kw: string | null) =>
  !kw ? "muted" : kw === "SAFE" ? "success" : kw === "EVAC" ? "secondary" : "destructive";

function Flags({ flags }: { flags?: string }) {
  if (!flags) return null;
  return (
    <span className="ml-1 inline-flex gap-1">
      {flags.split(",").filter(Boolean).map((f) => (
        <span key={f} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">{f}</span>
      ))}
    </span>
  );
}

export default function EventBoard({ alertId }: { alertId?: number }) {
  const params = useParams();
  const id = alertId ?? Number(params.id);
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    const load = () => {
      get(`/alerts/${id}/data`).then(setData).catch(() => {});
      get("/api/alerts").then((all) => setMeta(all.find((a: any) => a.id === id))).catch(() => {});
    };
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [id]);

  if (!data) return <div className="py-16 text-center text-sm text-muted-foreground">…</div>;

  const routeVariant = meta?.route_status === "open" ? "success" : meta?.route_status === "closed" ? "destructive" : "warning";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="font-semibold">{t("activeAlert")} #{id}{meta ? ` — ${meta.template_code} · z${meta.zones}` : ""}</span>
            {meta && <Badge variant={routeVariant as any}>route: {meta.route_status}</Badge>}
            {meta?.severity === "critical" && <Badge variant="destructive">{t("critical")}</Badge>}
            <span className="ml-auto text-xs text-muted-foreground">{meta?.source} · {meta?.created_at}</span>
          </div>
          <DeliveryBar counts={data.counts} />
          <div className="mt-2 text-xs text-muted-foreground">{data.replies.length} {t("repliesIn")}</div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("liveReplies")}</CardTitle></CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto">
            {data.replies.length === 0 && <div className="text-sm text-muted-foreground">{t("noRepliesYet")}</div>}
            {data.replies.map((r: any) => (
              <div key={r.id} className="flex items-start gap-2 rounded-lg border p-2.5 text-sm">
                <Badge variant={kwVariant(r.keyword) as any}>{r.keyword || "?"}</Badge>
                <div className="min-w-0">
                  <div className="font-medium">{r.name || r.phone}<Flags flags={r.flags} /></div>
                  <div className="truncate text-xs text-muted-foreground">"{r.raw_text}" · z{r.zone || "?"} · {r.received_at}</div>
                </div>
                {(r.keyword === "HELP" || r.keyword === "MEDICINE" || r.keyword === "STRANDED" || !r.keyword) && !r.handled && (
                  <Button size="sm" variant="outline" className="ml-auto shrink-0"
                    onClick={() => postForm(`/replies/${r.id}/handle`, {}).then(() => {})}>
                    {t("markHandled")}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("unreachedList")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              {data.unreached.length === 0 && <div className="text-sm text-muted-foreground">—</div>}
              {data.unreached.map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="destructive">unreached</Badge>
                  <span className="font-medium">{s.name || s.phone}</span>
                  <span className="text-xs text-muted-foreground">z{s.zone}</span><Flags flags={s.flags} />
                </div>
              ))}
            </div>
            <div className="border-t pt-3">
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t("noReplyList")}</div>
              <div className="flex flex-wrap gap-1.5">
                {data.no_reply.map((s: any) => (
                  <span key={s.id} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs">{s.name || s.phone}</span>
                ))}
                {data.no_reply.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t("perHousehold")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Household</TableHead><TableHead>Zone</TableHead>
              <TableHead>Status</TableHead><TableHead>Attempts</TableHead><TableHead>Error</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.sends.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name || s.phone}<Flags flags={s.flags} /></TableCell>
                  <TableCell>{s.zone}</TableCell>
                  <TableCell><Badge variant={s.status === "sent" ? "success" : s.status === "unreached" ? "destructive" : "warning"}>{s.status}</Badge></TableCell>
                  <TableCell>{s.attempts}</TableCell>
                  <TableCell className="max-w-56 truncate text-xs text-muted-foreground">{s.error}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="text-xs text-muted-foreground"><Link className="underline underline-offset-2" to="/">← {t("overview")}</Link></div>
    </div>
  );
}
