import { useI18n } from "@/lib/i18n";

export default function DeliveryBar({ counts }: { counts: { total: number; sent: number; pending: number; unreached: number } }) {
  const { t } = useI18n();
  const total = Math.max(1, counts.total);
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-zinc-100">
        <div className="bg-green-600" style={{ width: pct(counts.sent) }} />
        <div className="bg-amber-400" style={{ width: pct(counts.pending) }} />
        <div className="bg-red-600" style={{ width: pct(counts.unreached) }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span><b className="text-green-700">{counts.sent}</b> {t("delivered")}</span>
        <span><b className="text-amber-600">{counts.pending}</b> {t("retrying")}</span>
        <span><b className="text-red-700">{counts.unreached}</b> {t("unreached")}</span>
      </div>
    </div>
  );
}
