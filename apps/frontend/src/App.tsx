import { Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { ComingSoonPage } from './pages/ComingSoonPage'
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
        {modules.map((m) => (
          <Route key={m.path} path={m.path} element={<ComingSoonPage title={m.label} />} />
        ))}
      </Route>
    </Routes>
  )
}

export default App
