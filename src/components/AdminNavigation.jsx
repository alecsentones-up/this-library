import { NavLink, useNavigate } from 'react-router-dom'
import {
  ArchiveRestore,
  BookOpen,
  FileSpreadsheet,
  HandCoins,
  LayoutDashboard,
  LogOut,
  X
} from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'

const items = [
  {
    to: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboard,
    end: true
  },
  {
    to: '/admin/books',
    label: 'Books',
    icon: BookOpen
  },
  {
    to: '/admin/borrowing',
    label: 'Borrowing & Returns',
    icon: HandCoins
  },
  {
    to: '/admin/import',
    label: 'Import XLSX',
    icon: FileSpreadsheet
  },
  {
    to: '/admin/backup',
    label: 'Backup & Migration',
    icon: ArchiveRestore
  }
]

function AdminNavigation({ onNavigate, onClose }) {
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut(auth)
    navigate('/admin/login', { replace: true })
    onNavigate?.()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <button
          type="button"
          onClick={() => {
            navigate('/admin')
            onNavigate?.()
          }}
          className="flex items-center gap-3 text-left"
        >
          <div className="rounded-lg bg-white/10 p-2">
            <BookOpen size={22} />
          </div>
          <div>
            <div className="font-bold tracking-tight">This Library</div>
            <div className="text-xs text-white/60">Admin / Librarian</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'bg-white text-[#0A2540] shadow-sm'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut size={19} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}

export default AdminNavigation
