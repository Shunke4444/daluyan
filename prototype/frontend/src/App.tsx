import { HashRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/lib/i18n";
import Shell from "@/components/Shell";
import Home from "@/pages/Home";
import SendWizard from "@/pages/SendWizard";
import EventBoard from "@/pages/EventBoard";
import Registry from "@/pages/Registry";
import TemplatesPage from "@/pages/TemplatesPage";
import AuditPage from "@/pages/AuditPage";
import SimulatorPage from "@/pages/SimulatorPage";

export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route path="/send" element={<SendWizard />} />
            <Route path="/event/:id" element={<EventBoard />} />
            <Route path="/registry" element={<Registry />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/simulator" element={<SimulatorPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </I18nProvider>
  );
}
