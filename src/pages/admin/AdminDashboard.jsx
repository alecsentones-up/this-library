import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  ClipboardList
} from 'lucide-react'

function AdminDashboard() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="flex">


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