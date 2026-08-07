import { HashRouter, Navigate, Routes, Route, useParams } from "react-router-dom";
import { I18nProvider } from "@/lib/i18n";
import Shell from "@/components/Shell";
import Home from "@/pages/Home";
import SendWizard from "@/pages/SendWizard";
import EventBoard from "@/pages/EventBoard";
import Registry from "@/pages/Registry";
import TemplatesPage from "@/pages/TemplatesPage";
import AuditPage from "@/pages/AuditPage";
import SimulatorPage from "@/pages/SimulatorPage";
import MessagesPage from "@/pages/MessagesPage";

function LegacyEventRedirect() {
  const { id } = useParams();
  return <Navigate to={`/legacy/event/${id}`} replace />;
}

export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/templates" element={<TemplatesPage />} />

            {/* Kept for existing bookmarks and links while the three-page UI is rolled out. */}
            <Route path="/send" element={<Navigate to="/legacy/send" replace />} />
            <Route path="/event/:id" element={<LegacyEventRedirect />} />
            <Route path="/triage" element={<Navigate to="/messages" replace />} />
            <Route path="/registry" element={<Navigate to="/legacy/registry" replace />} />
            <Route path="/audit" element={<Navigate to="/legacy/audit" replace />} />
            <Route path="/simulator" element={<Navigate to="/legacy/simulator" replace />} />

            <Route path="/legacy/send" element={<SendWizard />} />
            <Route path="/legacy/event/:id" element={<EventBoard />} />
            <Route path="/legacy/registry" element={<Registry />} />
            <Route path="/legacy/audit" element={<AuditPage />} />
            <Route path="/legacy/simulator" element={<SimulatorPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </I18nProvider>
  );
}
