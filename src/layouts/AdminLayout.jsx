import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import AdminNavigation from '../components/AdminNavigation'

function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-[#0A2540] text-white shadow-xl lg:block">
        <AdminNavigation />
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#0A2540] text-white shadow-2xl transition-transform duration-200 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AdminNavigation onNavigate={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-gray-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <div className="ml-3 min-w-0">
            <div className="truncate font-semibold text-[#0A2540]">This Library</div>
            <div className="text-xs text-gray-500">Admin / Librarian</div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:min-h-screen lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
