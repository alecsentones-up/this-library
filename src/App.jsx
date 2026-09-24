/* eslint-disable no-undef */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PublicCatalog from './pages/public/PublicCatalog'
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminBooks from './pages/admin/AdminBooks'
import AdminBorrowing from './pages/admin/AdminBorrowing'
import ProtectedRoute from './components/ProtectedRoute'
import UserRoute from './components/UserRoute'
import UserLogin from './pages/auth/UserLogin'
import UserRegister from './pages/auth/UserRegister'
import UserDashboard from './pages/user/UserDashboard'
import AdminImport from './pages/admin/AdminImport'
import AdminBackupMigration from './pages/admin/AdminBackupMigration'
import AdminLayout from './layouts/AdminLayout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<PublicCatalog />}
        />

        <Route
          path="/login"
          element={<UserLogin />}
        />

        <Route
          path="/register"
          element={<UserRegister />}
        />

        <Route
          path="/account"
          element={
            <UserRoute>
              <UserDashboard />
            </UserRoute>
          }          
        />

        <Route
          path="/admin/login"
          element={<AdminLogin />}
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }>
          <Route index element={<AdminDashboard />} />
          <Route path="books" element={<AdminBooks />} />
          <Route path="borrowing" element={<AdminBorrowing />} />
          <Route path="import" element={<AdminImport />} />
          <Route path="backup" element={<AdminBackupMigration />} />
        </Route>

        {/* 

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/books"
          element={
            <ProtectedRoute>
              <AdminBooks />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/borrowing"
          element={
            <ProtectedRoute>
              <AdminBorrowing />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/backup"
          element={
            <ProtectedRoute>
              <AdminBackupMigration />
            </ProtectedRoute>
          }
        />

        <Route
        path="/admin/import"
        element={
          <ProtectedRoute>
            <AdminImport />
          </ProtectedRoute>
        }
      /> */}
      </Routes>
    </BrowserRouter>
  )
}

export default App