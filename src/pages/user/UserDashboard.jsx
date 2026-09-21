/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react'
import {
  BookOpen,
  Clock,
  LogOut,
  RotateCcw
} from 'lucide-react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../../firebase'

function UserDashboard() {
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAccount() {
      const user = auth.currentUser

      if (!user) {
        return
      }

      try {
        const profileSnapshot = await getDoc(
          doc(db, 'users', user.uid)
        )

        const recordsSnapshot = await getDocs(
          query(
            collection(db, 'borrow_records'),
            where('userId', '==', user.uid)
          )
        )

        const loadedRecords =
          recordsSnapshot.docs.map((recordDoc) => ({
            id: recordDoc.id,
            ...recordDoc.data()
          }))

        if (!cancelled) {
          setProfile(profileSnapshot.exists()
            ? profileSnapshot.data()
            : null)

          setRecords(loadedRecords)
          setLoading(false)
        }
      } catch (error) {
        console.error(error)

        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchAccount()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  function getStatusClass(status) {
    if (status === 'Borrowed') {
      return 'bg-blue-50 text-blue-700'
    }

    if (status === 'Pending Request') {
      return 'bg-yellow-50 text-yellow-700'
    }

    if (status === 'Overdue') {
      return 'bg-red-50 text-red-700'
    }

    return 'bg-green-50 text-green-700'
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
        <div className="text-gray-500">
          Loading account...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-[#0A2540] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/10 p-2">
              <BookOpen size={24} />
            </div>

            <div>
              <h1 className="font-bold">
                THIS Library
              </h1>

              <p className="text-xs text-white/70">
                My Account
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">
              Sign Out
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6 md:p-10">
        <div>
          <h2 className="text-3xl font-bold text-[#212529]">
            Welcome, {profile?.name || 'Library User'}
          </h2>

          <p className="mt-2 text-gray-500">
            {profile?.role === 'teacher'
              ? 'Teacher'
              : 'Student'}
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <AccountCard
            label="Pending Requests"
            value={
              records.filter(
                (record) =>
                  record.status === 'Pending Request'
              ).length
            }
            icon={<Clock size={22} />}
          />

          <AccountCard
            label="Borrowed Books"
            value={
              records.filter(
                (record) =>
                  record.status === 'Borrowed' ||
                  record.status === 'Overdue'
              ).length
            }
            icon={<BookOpen size={22} />}
          />

          <AccountCard
            label="Returned Books"
            value={
              records.filter(
                (record) => record.status === 'Returned'
              ).length
            }
            icon={<RotateCcw size={22} />}
          />
        </div>

        <div className="mt-8 rounded-2xl bg-white shadow-sm">
          <div className="border-b border-gray-100 p-6">
            <h3 className="text-lg font-bold text-[#212529]">
              My Borrowing
            </h3>
          </div>

          {records.length === 0 ? (
            <div className="p-10 text-center">
              <BookOpen
                size={40}
                className="mx-auto text-gray-300"
              />

              <p className="mt-4 text-gray-500">
                You have no borrowing records yet.
              </p>

              <button
                onClick={() => navigate('/')}
                className="mt-5 rounded-lg bg-[#0A2540] px-5 py-3 font-medium text-white hover:opacity-90"
              >
                Browse Library
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {records.map((record) => (
                <BorrowRecord
                  key={record.id}
                  record={record}
                />
              ))}
            </div>
          )}
        </div>

        {records.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => navigate('/')}
              className="rounded-lg bg-[#0A2540] px-5 py-3 font-medium text-white hover:opacity-90"
            >
              Browse Library
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function AccountCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="rounded-lg bg-[#F8F9FA] p-3 text-[#0A2540] w-fit">
        {icon}
      </div>

      <p className="mt-5 text-3xl font-bold text-[#212529]">
        {value}
      </p>

      <p className="mt-1 text-sm text-gray-500">
        {label}
      </p>
    </div>
  )
}

function BorrowRecord({ record }) {
  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-semibold text-[#212529]">
            {record.bookTitle || 'Library Book'}
          </h4>

          <p className="mt-1 text-sm text-gray-500">
            Requested:{' '}
            {formatDate(record.requestDate)}
          </p>

          {record.dueDate && (
            <p className="mt-1 text-sm text-gray-500">
              Due:{' '}
              {formatDate(record.dueDate)}
            </p>
          )}
        </div>

        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(record.status)}`}
        >
          {record.status}
        </span>
      </div>
    </div>
  )
}

function getStatusClass(status) {
  if (status === 'Borrowed') {
    return 'bg-blue-50 text-blue-700'
  }

  if (status === 'Pending Request') {
    return 'bg-yellow-50 text-yellow-700'
  }

  if (status === 'Overdue') {
    return 'bg-red-50 text-red-700'
  }

  return 'bg-green-50 text-green-700'
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().toLocaleDateString()
  }

  return new Date(value).toLocaleDateString()
}

export default UserDashboard