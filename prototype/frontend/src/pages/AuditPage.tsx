import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AuditPage() {
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  useEffect(() => { get("/api/audit").then(setData); }, []);
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <a href="/audit.csv"><Button variant="outline" size="sm">{t("exportCsv")}</Button></a>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Sends</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>#</TableHead><TableHead>Alert</TableHead><TableHead>To</TableHead>
              <TableHead>Kind</TableHead><TableHead>Status</TableHead><TableHead>Att</TableHead><TableHead>At</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.sends.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{s.id}</TableCell><TableCell>{s.alert_id}</TableCell>
                  <TableCell className="font-medium">{s.name || s.phone}</TableCell>
                  <TableCell className="text-xs">{s.kind}</TableCell>
                  <TableCell><Badge variant={s.status === "sent" ? "success" : s.status === "unreached" ? "destructive" : "warning"}>{s.status}</Badge></TableCell>
                  <TableCell>{s.attempts}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.created_at}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Replies</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>#</TableHead><TableHead>From</TableHead><TableHead>Keyword</TableHead>
              <TableHead>Raw</TableHead><TableHead>Handled</TableHead><TableHead>At</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.replies.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell className="font-medium">{r.name || r.phone}</TableCell>
                  <TableCell>{r.keyword ? <Badge variant="secondary">{r.keyword}</Badge> : <Badge variant="muted">unrecognized</Badge>}</TableCell>
                  <TableCell className="max-w-64 truncate text-xs">{r.raw_text}</TableCell>
                  <TableCell>{r.handled ? "yes" : "no"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.received_at}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
