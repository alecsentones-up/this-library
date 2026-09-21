import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  ClipboardList
} from 'lucide-react'
import { auth } from '../../firebase'

function AdminDashboard() {
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut(auth)
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-[#0A2540] text-white">
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/10 p-2">
              <BookOpen size={24} />
            </div>

            <div>
              <h1 className="font-bold">THIS Library</h1>
              <p className="text-xs text-white/70">
                Administration
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden min-h-[calc(100vh-80px)] w-64 border-r border-gray-200 bg-white p-4 md:block">
          <nav className="space-y-1">
            <button className="flex w-full items-center gap-3 rounded-lg bg-[#0A2540] px-4 py-3 text-left text-white">
              <LayoutDashboard size={19} />
              Dashboard
            </button>

            <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-gray-600 hover:bg-gray-100">
              <BookOpen size={19} />
              Books
            </button>

            <button
              onClick={() => navigate('/admin/borrowing')}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-gray-600 hover:bg-gray-100">
              <ClipboardList size={19} />
              Borrowing
            </button>

            <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-gray-600 hover:bg-gray-100">
              <Users size={19} />
              Users
            </button>

            <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-gray-600 hover:bg-gray-100">
              <Settings size={19} />
              Settings
            </button>
          </nav>
        </aside>

        <main className="flex-1 p-6 md:p-10">
          <div>
            <h2 className="text-3xl font-bold text-[#212529]">
              Dashboard
            </h2>

            <p className="mt-2 text-gray-500">
              Welcome to the library administration panel.
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardCard
              label="Total Books"
              value="0"
              icon={<BookOpen size={22} />}
            />

            <DashboardCard
              label="Available"
              value="0"
              icon={<BookOpen size={22} />}
            />

            <DashboardCard
              label="Borrowed"
              value="0"
              icon={<ClipboardList size={22} />}
            />

            <DashboardCard
              label="Pending Requests"
              value="0"
              icon={<ClipboardList size={22} />}
            />
          </div>

          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#212529]">
              Quick Actions
            </h3>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/admin/books')}
                className="rounded-lg bg-[#0A2540] px-5 py-3 font-medium text-white hover:opacity-90"
              >
                Manage Books
              </button>

              <button
                onClick={() => navigate('/admin/borrowing')}
                className="rounded-lg border border-gray-200 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50">
                View Borrowing
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function DashboardCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="rounded-lg bg-[#F8F9FA] p-3 text-[#0A2540]">
          {icon}
        </div>
      </div>

      <div className="mt-5">
        <div className="text-3xl font-bold text-[#212529]">
          {value}
        </div>

        <div className="mt-1 text-sm text-gray-500">
          {label}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard