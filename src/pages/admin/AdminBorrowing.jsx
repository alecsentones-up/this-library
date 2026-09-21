import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock,
  RotateCcw,
  X
} from 'lucide-react'
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../../firebase'

function AdminBorrowing() {
  const navigate = useNavigate()

  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchRecords() {
      try {
        const snapshot = await getDocs(
          collection(db, 'borrow_records')
        )

        const loadedRecords = snapshot.docs.map(
          (recordDoc) => ({
            id: recordDoc.id,
            ...recordDoc.data()
          })
        )

        if (!cancelled) {
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

    fetchRecords()

    return () => {
      cancelled = true
    }
  }, [])

  async function approveRequest(record) {
    if (processing) {
      return
    }

    setProcessing(true)

    try {
      const booksSnapshot = await getDocs(
        collection(db, 'books')
      )

      const bookDoc = booksSnapshot.docs.find(
        (book) => book.id === record.bookId
      )

      if (!bookDoc) {
        window.alert('The book no longer exists.')
        return
      }

      const book = bookDoc.data()
      const availableCopies = Number(
        book.availableCopies || 0
      )

      if (availableCopies <= 0) {
        window.alert(
          'This book is no longer available.'
        )
        return
      }

      const dueDate = new Date()

      dueDate.setDate(
        dueDate.getDate() + 14
      )

      await updateDoc(
        doc(db, 'borrow_records', record.id),
        {
          borrowedDate: serverTimestamp(),
          dueDate,
          status: 'Borrowed'
        }
      )

      const newAvailableCopies =
        availableCopies - 1

      await updateDoc(
        doc(db, 'books', record.bookId),
        {
          availableCopies: newAvailableCopies,
          status:
            newAvailableCopies === 0
              ? 'Borrowed'
              : 'Available',
          updatedAt: serverTimestamp()
        }
      )

      setRecords((current) =>
        current.map((item) =>
          item.id === record.id
            ? {
                ...item,
                status: 'Borrowed',
                borrowedDate: new Date(),
                dueDate
              }
            : item
        )
      )
    } catch (error) {
      console.error(error)
      window.alert(
        'Unable to approve the request.'
      )
    } finally {
      setProcessing(false)
    }
  }

  async function denyRequest(record) {
    if (processing) {
      return
    }

    const confirmed = window.confirm(
      'Deny this borrowing request?'
    )

    if (!confirmed) {
      return
    }

    setProcessing(true)

    try {
      await updateDoc(
        doc(db, 'borrow_records', record.id),
        {
          status: 'Returned',
          returnDate: serverTimestamp()
        }
      )

      setRecords((current) =>
        current.map((item) =>
          item.id === record.id
            ? {
                ...item,
                status: 'Returned'
              }
            : item
        )
      )
    } catch (error) {
      console.error(error)
      window.alert(
        'Unable to deny the request.'
      )
    } finally {
      setProcessing(false)
    }
  }

  async function returnBook(record) {
    if (processing) {
      return
    }

    const confirmed = window.confirm(
      `Mark "${record.bookTitle}" as returned?`
    )

    if (!confirmed) {
      return
    }

    setProcessing(true)

    try {
      const booksSnapshot = await getDocs(
        collection(db, 'books')
      )

      const bookDoc = booksSnapshot.docs.find(
        (book) => book.id === record.bookId
      )

      if (!bookDoc) {
        window.alert('The book no longer exists.')
        return
      }

      const book = bookDoc.data()

      const availableCopies = Number(
        book.availableCopies || 0
      )

      const totalCopies = Number(
        book.totalCopies || 0
      )

      const newAvailableCopies = Math.min(
        availableCopies + 1,
        totalCopies
      )

      await updateDoc(
        doc(db, 'borrow_records', record.id),
        {
          returnDate: serverTimestamp(),
          status: 'Returned'
        }
      )

      await updateDoc(
        doc(db, 'books', record.bookId),
        {
          availableCopies: newAvailableCopies,
          status:
            newAvailableCopies > 0
              ? 'Available'
              : 'Borrowed',
          updatedAt: serverTimestamp()
        }
      )

      setRecords((current) =>
        current.map((item) =>
          item.id === record.id
            ? {
                ...item,
                status: 'Returned',
                returnDate: new Date()
              }
            : item
        )
      )
    } catch (error) {
      console.error(error)
      window.alert(
        'Unable to return the book.'
      )
    } finally {
      setProcessing(false)
    }
  }

  function getStatusClass(status) {
    if (status === 'Pending Request') {
      return 'bg-yellow-50 text-yellow-700'
    }

    if (status === 'Borrowed') {
      return 'bg-blue-50 text-blue-700'
    }

    if (status === 'Overdue') {
      return 'bg-red-50 text-red-700'
    }

    return 'bg-green-50 text-green-700'
  }

  const pending = records.filter(
    (record) =>
      record.status === 'Pending Request'
  )

  const active = records.filter(
    (record) =>
      record.status === 'Borrowed' ||
      record.status === 'Overdue'
  )

  const returned = records.filter(
    (record) => record.status === 'Returned'
  )

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-[#0A2540] text-white">
        <div className="flex items-center gap-3 px-6 py-5">
          <button
            onClick={() => navigate('/admin')}
            className="rounded-lg p-2 hover:bg-white/10"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="rounded-lg bg-white/10 p-2">
            <BookOpen size={24} />
          </div>

          <div>
            <h1 className="font-bold">
              THIS Library
            </h1>

            <p className="text-xs text-white/70">
              Borrowing Management
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6 md:p-10">
        <h2 className="text-3xl font-bold text-[#212529]">
          Borrowing
        </h2>

        <p className="mt-2 text-gray-500">
          Manage borrowing requests, active loans, and returns.
        </p>

        {loading ? (
          <div className="mt-8 rounded-2xl bg-white p-10 text-center text-gray-500 shadow-sm">
            Loading borrowing records...
          </div>
        ) : (
          <>
            <BorrowSection
              title="Pending Requests"
              icon={<Clock size={20} />}
              records={pending}
              emptyText="No pending requests."
              statusClass={getStatusClass}
              actions={(record) => (
                <>
                  <button
                    onClick={() =>
                      approveRequest(record)
                    }
                    disabled={processing}
                    className="flex items-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <Check size={16} />
                    Approve
                  </button>

                  <button
                    onClick={() =>
                      denyRequest(record)
                    }
                    disabled={processing}
                    className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <X size={16} />
                    Deny
                  </button>
                </>
              )}
            />

            <BorrowSection
              title="Active Borrowings"
              icon={<BookOpen size={20} />}
              records={active}
              emptyText="No active borrowings."
              statusClass={getStatusClass}
              actions={(record) => (
                <button
                  onClick={() =>
                    returnBook(record)
                  }
                  disabled={processing}
                  className="flex items-center gap-2 rounded-lg bg-[#0A2540] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  <RotateCcw size={16} />
                  Return
                </button>
              )}
            />

            <BorrowSection
              title="Returned"
              icon={<RotateCcw size={20} />}
              records={returned}
              emptyText="No returned books."
              statusClass={getStatusClass}
            />
          </>
        )}
      </main>
    </div>
  )
}

function BorrowSection({
  title,
  icon,
  records,
  emptyText,
  statusClass,
  actions
}) {
  return (
    <section className="mt-8 rounded-2xl bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 p-6">
        <div className="rounded-lg bg-[#F8F9FA] p-2 text-[#0A2540]">
          {icon}
        </div>

        <div>
          <h3 className="font-bold text-[#212529]">
            {title}
          </h3>

          <p className="text-sm text-gray-500">
            {records.length} record
            {records.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">
          {emptyText}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {records.map((record) => (
            <div
              key={record.id}
              className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <h4 className="font-semibold text-[#212529]">
                  {record.bookTitle}
                </h4>

                <p className="mt-1 text-sm text-gray-500">
                  User: {record.userId}
                </p>

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

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(record.status)}`}
                >
                  {record.status}
                </span>

                {actions && actions(record)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
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

export default AdminBorrowing