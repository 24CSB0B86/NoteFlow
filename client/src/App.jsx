import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ClassroomProvider } from './context/ClassroomContext'
import ProtectedRoute from './components/layout/ProtectedRoute'

import LoginPage          from './pages/LoginPage'
import SignupPage         from './pages/SignupPage'
import ResetPasswordPage  from './pages/ResetPasswordPage'
import DashboardPage      from './pages/DashboardPage'
import ClassroomsPage     from './pages/ClassroomsPage'
import ClassroomDetailPage from './pages/ClassroomDetailPage'
import SettingsPage       from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ClassroomProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login"          element={<LoginPage />} />
            <Route path="/signup"         element={<SignupPage />} />
            <Route path="/forgot-password" element={<ResetPasswordPage />} />
            <Route path="/reset-password"  element={<ResetPasswordPage />} />

            {/* Protected routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute><DashboardPage /></ProtectedRoute>
            } />

            <Route path="/classrooms" element={
              <ProtectedRoute><ClassroomsPage /></ProtectedRoute>
            } />

            <Route path="/classrooms/:id" element={
              <ProtectedRoute><ClassroomDetailPage /></ProtectedRoute>
            } />

            <Route path="/settings" element={
              <ProtectedRoute><SettingsPage /></ProtectedRoute>
            } />

            {/* Default redirect */}
            <Route path="/"   element={<Navigate to="/dashboard" replace />} />
            <Route path="/*"  element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ClassroomProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
