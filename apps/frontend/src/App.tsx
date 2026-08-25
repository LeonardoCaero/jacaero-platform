import { Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { ProfilePage } from './pages/ProfilePage'
import { AboutPage } from './pages/AboutPage'
import { ClientsPage } from './pages/ClientsPage'
import { ClientDetailPage } from './pages/ClientDetailPage'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { TimeTrackerPage } from './pages/TimeTrackerPage'
import { TeamPage } from './pages/TeamPage'
import { PapeleoPage } from './pages/PapeleoPage'
import { EmailOrdersPage } from './pages/EmailOrdersPage'
import { ReconcilePage } from './pages/ReconcilePage'
import { DocumentsPage } from './pages/DocumentsPage'
import { AcceptInvitePage } from './pages/AcceptInvitePage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import { modules } from './lib/modules'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/time-tracker" element={<TimeTrackerPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/papeleo" element={<PapeleoPage />} />
        <Route path="/papeleo/pedidos" element={<EmailOrdersPage />} />
        <Route path="/papeleo/pedidos/:id/reconcile" element={<ReconcilePage />} />
        <Route
          path="/papeleo/presupuestos"
          element={<DocumentsPage category="presupuesto" titleKey="presupuesto" />}
        />
        <Route path="/papeleo/albaranes" element={<DocumentsPage category="albaran" titleKey="albaran" />} />
        <Route
          path="/papeleo/pedidos-material"
          element={<DocumentsPage category="pedidoMaterial" titleKey="pedidoMaterial" />}
        />
        <Route path="/papeleo/facturas" element={<DocumentsPage category="factura" titleKey="facturas" />} />
        <Route path="/papeleo/horas" element={<DocumentsPage category="horasTrabajo" titleKey="horas" />} />
        {modules
          .filter((m) => !['timeTracker', 'team', 'papeleo', 'clients'].includes(m.key))
          .map((m) => (
            <Route key={m.path} path={m.path} element={<ComingSoonPage moduleKey={m.key} />} />
          ))}
      </Route>
    </Routes>
  )
}

export default App
