import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TemplatesPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { get("/api/templates").then(setRows); }, []);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("templatesNote")}</p>
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-semibold">{r.code}</span>
              <Badge variant="secondary">{r.language.toUpperCase()}</Badge>
              <span className="text-xs text-muted-foreground">v{r.version} · {r.approved_by}</span>
              <span className="ml-auto">
                {r.lint_errors.length ? <Badge variant="destructive">blocked</Badge>
                  : r.lint_warnings.length ? <Badge variant="warning">warning</Badge>
                  : <Badge variant="success">{t("linterPass")}</Badge>}
              </span>
            </div>
            <div className="whitespace-pre-wrap rounded-lg bg-zinc-100 p-3 font-mono text-[13px]">{r.body}</div>
            {(r.lint_errors.length > 0 || r.lint_warnings.length > 0) && (
              <div className="mt-2 text-xs text-muted-foreground">{[...r.lint_errors, ...r.lint_warnings].join(" · ")}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
