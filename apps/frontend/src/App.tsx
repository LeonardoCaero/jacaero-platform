import { Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { ProfilePage } from './pages/ProfilePage'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { TimeTrackerPage } from './pages/TimeTrackerPage'
import { TeamPage } from './pages/TeamPage'
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
        <Route path="/time-tracker" element={<TimeTrackerPage />} />
        <Route path="/team" element={<TeamPage />} />
        {modules
          .filter((m) => m.key !== 'timeTracker' && m.key !== 'team')
          .map((m) => (
            <Route key={m.path} path={m.path} element={<ComingSoonPage moduleKey={m.key} />} />
          ))}
      </Route>
    </Routes>
  )
}

export default App
