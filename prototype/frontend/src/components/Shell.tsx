import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Axis3D, Cog, MessageCircle } from "lucide-react";
import { get } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function Shell() {
  const location = useLocation();
  const { t, lang, setLang } = useI18n();
  const [sum, setSum] = useState<any>(null);
  useEffect(() => {
    const load = () => get("/api/summary").then(setSum).catch(() => {});
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const tabs = [
    { to: "/", label: "Dashboard", icon: Axis3D, end: true },
    { to: "/messages", label: "Messages", icon: MessageCircle, badge: sum?.triage },
    { to: "/templates", label: "Templates", icon: Cog },
  ];

  return (
    <div className="daluyan-shell min-h-screen">
      <aside className="daluyan-nav" aria-label="Primary navigation">
        <nav className="daluyan-nav__links">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                aria-label={tab.label}
                className={({ isActive }) =>
                  cn("daluyan-nav__link", isActive && "daluyan-nav__link--active")
                }
              >
                <tab.icon aria-hidden="true" strokeWidth={1.8} />
                <span className="daluyan-nav__label">{tab.label}</span>
                {tab.badge ? <span className="daluyan-nav__badge">{tab.badge > 99 ? "99+" : tab.badge}</span> : null}
              </NavLink>
            ))}
        </nav>
        <div className="daluyan-nav__footer">
          {sum && <span className={cn("daluyan-nav__status", sum.gateway === "mock" ? "bg-amber-500" : "bg-green-600")} title={`${sum.gateway} gateway`} />}
          <div className="daluyan-nav__avatar" aria-hidden="true">You</div>
            <button
              onClick={() => setLang(lang === "en" ? "fil" : "en")}
              className="daluyan-nav__language"
              aria-label={`Change language to ${lang === "en" ? "Filipino" : "English"}`}
            >
              {lang === "en" ? "FIL" : "EN"}
            </button>
        </div>
      </aside>
      <main className={cn("daluyan-main mx-auto", location.pathname === "/messages" ? "max-w-none p-0" : "max-w-5xl px-4 py-6")}>
        <Outlet />
      </main>
    </div>
  );
}
