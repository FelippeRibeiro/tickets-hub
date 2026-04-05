import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { AppShell } from '@/components/app-shell'
import { ProtectedRoute } from '@/components/protected-route'
import { AdminPage } from '@/pages/admin-page'
import { HomePage } from '@/pages/home-page'
import { LoginPage } from '@/pages/login-page'
import { RegisterPage } from '@/pages/register-page'
import { TicketDetailPage } from '@/pages/ticket-detail-page'

function MyTicketsPage() {
  return <HomePage onlyMine title="Meus tickets" subtitle="Tickets criados por você" />
}

function AdminPageWrapper() {
  const { user } = useAuth()
  if (!user?.is_admin) {
    return <Navigate to="/" replace />
  }
  return <AdminPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/meus-tickets" element={<MyTicketsPage />} />
        <Route path="/ticket/:id" element={<TicketDetailPage />} />
        <Route path="/admin" element={<AdminPageWrapper />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
