import { Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { ProfilePage } from './pages/ProfilePage'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { TimeTrackerPage } from './pages/TimeTrackerPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import { modules } from './lib/modules'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
        {modules
          .filter((m) => m.key !== 'timeTracker')
          .map((m) => (
            <Route key={m.path} path={m.path} element={<ComingSoonPage moduleKey={m.key} />} />
          ))}
      </Route>
    </Routes>
  )
}

export default App
