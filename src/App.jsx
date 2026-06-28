import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useState } from 'react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Students from './pages/Students'
import Courses from './pages/Courses'
import Attendance from './pages/Attendance'
import StudentDetail from './pages/StudentDetail'
import Teachers from './pages/Teachers'
import MyCourses from './pages/MyCourses'
import MyStudents from './pages/MyStudents'
import RoleGuard from './components/RoleGuard'
import { getAuthSession } from './utils/storage'

function App() {
  const [dataVersion, setDataVersion] = useState(0)
  const refreshData = () => setDataVersion((version) => version + 1)

  return (
    <BrowserRouter>
      <Routes>
        <Route path="login" element={<Login onLogin={refreshData} />} />
        <Route element={<RequireAuth><Layout onRoleChange={refreshData} onAuthChange={refreshData} /></RequireAuth>}>
          <Route index element={<RoleGuard allowedRole="admin"><Dashboard dataVersion={dataVersion} onDataChange={refreshData} /></RoleGuard>} />
          <Route
            path="students"
            element={<RoleGuard allowedRole="admin"><Students dataVersion={dataVersion} onDataChange={refreshData} /></RoleGuard>}
          />
          <Route
            path="courses"
            element={<RoleGuard allowedRole="admin"><Courses dataVersion={dataVersion} onDataChange={refreshData} /></RoleGuard>}
          />
          <Route path="attendance" element={<RoleGuard allowedRoles={['teacher', 'admin']}><Attendance dataVersion={dataVersion} onDataChange={refreshData} /></RoleGuard>} />
          <Route path="teachers" element={<RoleGuard allowedRole="admin"><Teachers dataVersion={dataVersion} onDataChange={refreshData} /></RoleGuard>} />
          <Route path="my-courses" element={<RoleGuard allowedRole="teacher"><MyCourses dataVersion={dataVersion} onDataChange={refreshData} /></RoleGuard>} />
          <Route path="my-students" element={<RoleGuard allowedRole="teacher"><MyStudents dataVersion={dataVersion} onDataChange={refreshData} /></RoleGuard>} />
          <Route path="student/:id" element={<StudentDetail dataVersion={dataVersion} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function RequireAuth({ children }) {
  const location = useLocation()
  return getAuthSession() ? children : <Navigate to="/login" replace state={{ from: location }} />
}

export default App
