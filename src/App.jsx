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
      </Routes>
    </BrowserRouter>
  )
}

export default App