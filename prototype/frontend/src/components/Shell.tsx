import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { get } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function Shell() {
  const { t, lang, setLang } = useI18n();
  const [sum, setSum] = useState<any>(null);
  useEffect(() => {
    const load = () => get("/api/summary").then(setSum).catch(() => {});
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const tabs = [
    { to: "/", label: t("overview") },
    { to: "/registry", label: t("registry") },
    { to: "/templates", label: t("templates") },
    { to: "/audit", label: t("audit") },
    { to: "/simulator", label: t("simulator") },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Radio className="h-4.5 w-4.5" size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Daluyan</div>
              <div className="text-[11px] text-muted-foreground leading-tight">Brgy Mahogany, Marilao</div>
            </div>
          </div>
          <nav className="flex gap-1 text-sm">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === "/"}
                className={({ isActive }) =>
                  cn("rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100",
                     isActive && "bg-zinc-100 font-medium text-zinc-900")
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {sum && (
              <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <span className={cn("h-2 w-2 rounded-full", sum.gateway === "mock" ? "bg-amber-500" : "bg-green-600")} />
                {sum.gateway.toUpperCase()}
                {sum.balance ? <span>· {sum.balance}</span> : null}
              </div>
            )}
            <button
              onClick={() => setLang(lang === "en" ? "fil" : "en")}
              className="rounded-md border px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              {lang === "en" ? "FIL" : "EN"}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
