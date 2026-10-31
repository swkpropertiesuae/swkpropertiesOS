import EmailPage from './pages/EmailPage'
import {ExtractionPage} from './pages/ExtractionPage'
import {CompetencyPage} from './pages/EnterprisePages'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Suspense, lazy, type ReactNode } from 'react'
import { useMeta } from './lib/meta'
import { Shell } from './components/Shell'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Launcher } from './pages/Launcher'
import { Workspaces, WorkspaceUtilities } from './pages/Workspaces'
import { EntityListPage, EntityRecordPage } from './pages/EntityPages'
import { CalendarPage } from './pages/CalendarPage'
import { ReportsPage, KpiPage } from './pages/ReportPages'
import { ToolsPage } from './pages/ToolsPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { ProfilePage } from './pages/ProfilePage'
import { RolesPage, SettingsPage, AuditPage, BackupPage } from './pages/AdminPages'
import { CompliancePage } from './pages/CompliancePage'
import { WorkQueuePage,HandoverPage } from './pages/WorkPages'
import { PublicTrack } from './pages/PublicTrack'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { AiPage } from './pages/AiPage'
import { WhatsAppPage } from './pages/WhatsAppPage'
import { BankImportPage, YearEndPage, WpsPage } from './pages/FinanceExtras'
import { PrintPage } from './print/PrintPage'
import { StudioHome, StudioEditor } from './pages/StudioPage'
import { NewInvoicePage } from './pages/NewInvoicePage'
import { Loading, ErrorBox } from './ui/kit'
import { isNativeAndroid } from './mobile/native-bridge'

// SWK real-estate modules (code-split)
const MarketPage = lazy(() => import('./pages/swk/MarketPage'))
const ToolkitPage = lazy(() => import('./pages/swk/ToolkitPage'))
const ListingsStudio = lazy(() => import('./pages/swk/ListingsStudio'))
const OffPlanPage = lazy(() => import('./pages/swk/OffPlanPage'))
const PdcVault = lazy(() => import('./pages/swk/PdcVault'))
const PipelinePage = lazy(() => import('./pages/swk/PipelinePage'))
const AgentsPage = lazy(() => import('./pages/swk/AgentsPage'))
const ReraCentre = lazy(() => import('./pages/swk/ReraCentre'))
const Owner360 = lazy(() => import('./pages/swk/Owner360'))
const EnterpriseMasterOsPage = lazy(() => import('./pages/swk/EnterpriseMasterOsPage'))
const SwkOneApp = lazy(() => import('./mobile/SwkOneApp'))
const ReceptionQrPage = lazy(() => import('./pages/swk/ReceptionQrPage'))
const RecycleBinPage = lazy(() => import('./pages/swk/RecycleBinPage'))
const WithdrawalsPage = lazy(() => import('./pages/swk/WithdrawalsPage'))

function Guard({ module, children }: { module: string; children: ReactNode }) {
  const { can } = useMeta()
  return can(module, 'view') ? <>{children}</> : <ErrorBox error={new Error('You do not have access to this page. Ask an administrator to grant the permission.')} />
}
const Statements = () => <ReportsPage fixed={['trial_balance', 'profit_loss', 'balance_sheet', 'general_ledger', 'vat_return', 'ar_aging', 'ap_aging', 'tax_invoice_register']} />

export default function App() {
  const { me, loading } = useMeta()
  const loc = useLocation()
  const defaultLanding = isNativeAndroid() ? '/swk-one' : '/home'
  if (loc.pathname.startsWith('/t/')) return <Routes><Route path="/t/:token" element={<PublicTrack />} /></Routes>
  if (loading) return <div className="h-full grid place-items-center"><Loading label="Starting SWK OS…" /></div>
  if (!me) return <Routes><Route path="/login" element={<Login />} /><Route path="*" element={<Navigate to="/login" replace state={{ from: loc.pathname }} />} /></Routes>
  if (me.mustChangePassword && !loc.pathname.startsWith('/profile') && !loc.pathname.startsWith('/print')) return <Navigate to="/profile" replace />
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<Navigate to={defaultLanding} replace />} />
        <Route path="/swk-one" element={<SwkOneApp />} />
        <Route element={<Shell />}>
          <Route index element={<Navigate to={defaultLanding} replace />} />
          <Route path="/home" element={<Launcher />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/enterprise/master-os" element={<EnterpriseMasterOsPage />} />
          <Route path="/reception-qr" element={<ReceptionQrPage />} />
          <Route path="/recycle-bin" element={<RecycleBinPage />} />
          <Route path="/withdrawals" element={<WithdrawalsPage />} />
          <Route path="/workspaces" element={<Workspaces />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/toolkit" element={<ToolkitPage />} />
          <Route path="/listings" element={<Guard module="properties"><ListingsStudio /></Guard>} />
          <Route path="/offplan" element={<Guard module="properties"><OffPlanPage /></Guard>} />
          <Route path="/pdc" element={<Guard module="leases"><PdcVault /></Guard>} />
          <Route path="/pipeline" element={<Guard module="sales"><PipelinePage /></Guard>} />
          <Route path="/agents" element={<Guard module="hr"><AgentsPage /></Guard>} />
          <Route path="/rera" element={<Guard module="compliance"><ReraCentre /></Guard>} />
          <Route path="/owners" element={<Guard module="finance"><Owner360 /></Guard>} />
          <Route path="/workspace/:workspace" element={<Workspaces key={loc.pathname} />} />
          <Route path="/workspace-tools" element={<WorkspaceUtilities />} />
          <Route path="/e/:entity" element={<EntityListPage />} />
          <Route path="/e/:entity/:id" element={<EntityRecordPage />} />
          <Route path="/extractions/:id" element={<Guard module="documents"><ExtractionPage /></Guard>} />
          <Route path="/competency" element={<Guard module="hr"><CompetencyPage /></Guard>} />
          <Route path="/work/queues" element={<Guard module="projects"><WorkQueuePage /></Guard>} />
          <Route path="/work/handovers" element={<Guard module="projects"><HandoverPage /></Guard>} />
          <Route path="/email" element={<EmailPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/reports" element={<Guard module="reports"><ReportsPage /></Guard>} />
          <Route path="/finance/statements" element={<Guard module="finance"><Statements /></Guard>} />
          <Route path="/kpi" element={<Guard module="reports"><KpiPage /></Guard>} />
          <Route path="/studio" element={<Guard module="documents"><StudioHome /></Guard>} />
          <Route path="/studio/:id" element={<Guard module="documents"><StudioEditor /></Guard>} />
          <Route path="/finance/new-invoice" element={<Guard module="finance"><NewInvoicePage /></Guard>} />
          <Route path="/documents" element={<Guard module="documents"><DocumentsPage /></Guard>} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin/roles" element={<Guard module="admin"><RolesPage /></Guard>} />
          <Route path="/admin/settings" element={<Guard module="admin"><SettingsPage /></Guard>} />
          <Route path="/admin/audit" element={<Guard module="admin"><AuditPage /></Guard>} />
          <Route path="/admin/integrations" element={<Guard module="admin"><IntegrationsPage /></Guard>} />
          <Route path="/ai" element={<Guard module="ai"><AiPage /></Guard>} />
          <Route path="/whatsapp" element={<Guard module="crm"><WhatsAppPage /></Guard>} />
          <Route path="/finance/bank-import" element={<Guard module="finance"><BankImportPage /></Guard>} />
          <Route path="/finance/year-end" element={<Guard module="finance"><YearEndPage /></Guard>} />
          <Route path="/hr/wps" element={<Guard module="hr"><WpsPage /></Guard>} />
          <Route path="/compliance" element={<Guard module="compliance"><CompliancePage /></Guard>} />
          <Route path="/admin/backup" element={<Guard module="admin"><BackupPage /></Guard>} />
          <Route path="/print/:entity/:id" element={<PrintPage />} />
          <Route path="*" element={<ErrorBox error={new Error('Page not found')} />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
void lazy
