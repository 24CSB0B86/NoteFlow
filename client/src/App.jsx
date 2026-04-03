import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ClassroomProvider } from './context/ClassroomContext'
import { SyllabusProvider } from './context/SyllabusContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import ClassroomsPage from './pages/ClassroomsPage'
import ClassroomDetailPage from './pages/ClassroomDetailPage'
import ResourceViewerPage from './pages/ResourceViewerPage'
import BountyBoardPage from './pages/BountyBoardPage'
import UserProfilePage from './pages/UserProfilePage'
import ProfessorDashboardPage from './pages/ProfessorDashboardPage'
import ExamSectionPage from './pages/ExamSectionPage'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ClassroomProvider>
          <SyllabusProvider>
            <BrowserRouter>
              <Routes>
                {/* Public */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Protected */}
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/classrooms" element={<ProtectedRoute><ClassroomsPage /></ProtectedRoute>} />
                <Route path="/classrooms/:id" element={<ProtectedRoute><ClassroomDetailPage /></ProtectedRoute>} />
                <Route path="/classrooms/:classroomId/resources/:resourceId/view" element={<ProtectedRoute><ResourceViewerPage /></ProtectedRoute>} />

                {/* Phase 5: Bounty Board */}
                <Route path="/classrooms/:classroomId/bounties" element={<ProtectedRoute><BountyBoardPage /></ProtectedRoute>} />

                {/* Phase 5: User Profile / Karma */}
                <Route path="/profile/:userId" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />

                {/* Phase 6: Professor Dashboard */}
                <Route path="/classrooms/:classroomId/professor" element={<ProtectedRoute><ProfessorDashboardPage /></ProtectedRoute>} />

                {/* Use Cases 4.0 & 5.0: Exam Section */}
                <Route path="/classrooms/:classroomId/exam" element={<ProtectedRoute><ExamSectionPage /></ProtectedRoute>} />

                {/* Redirects */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </SyllabusProvider>
        </ClassroomProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
