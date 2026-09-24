import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  QrCode,
  RotateCcw,
  Search,
  UserRound,
  X
} from 'lucide-react'
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'firebase/firestore'
import { auth, db } from '../../firebase'
import LibraryCodeScanner from '../../components/LibraryCodeScanner'

const DUE_DAYS = 14

function getUserName(user) {
  return (
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.email ||
    'Unnamed user'
  )
}

function getUserIdNumber(user) {
  return (
    user?.idNumber ||
    user?.studentId ||
    user?.employeeId ||
    user?.teacherId ||
    ''
  )
}

function getUserRole(user) {
  return user?.role || 'student'
}

function getDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultDueDate() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + DUE_DAYS)
  return getDateInputValue(date)
}

function toDate(value) {
  if (!value) {
    return null
  }

  if (value instanceof Timestamp) {
    return value.toDate()
  }

  if (value?.toDate instanceof Function) {
    return value.toDate()
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getDisplayStatus(record) {
  if (record.status === 'Returned') {
    return 'Returned'
  }

  const dueDate = toDate(record.dueDate)

  if (dueDate && dueDate.getTime() < Date.now()) {
    return 'Overdue'
  }

  return record.status || 'Borrowed'
}

function getStatusClass(status) {
  if (status === 'Returned') {
    return 'bg-gray-100 text-gray-700'
  }

  if (status === 'Overdue') {
    return 'bg-red-100 text-red-800'
  }

  return 'bg-green-100 text-green-800'
}

function AdminBorrowing() {
  const [mode, setMode] = useState('checkout')
  const [users, setUsers] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [userSearch, setUserSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [checkoutScannerOpen, setCheckoutScannerOpen] = useState(false)
  const [checkoutCopy, setCheckoutCopy] = useState(null)
  const [checkoutBook, setCheckoutBook] = useState(null)
  const [dueDate, setDueDate] = useState(getDefaultDueDate())

  const [returnScannerOpen, setReturnScannerOpen] = useState(false)
  const [returnCopy, setReturnCopy] = useState(null)
  const [returnBook, setReturnBook] = useState(null)
  const [returnRecord, setReturnRecord] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError('')

      try {
        const [usersSnapshot, recordsSnapshot] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'borrow_records'))
        ])

        const loadedUsers = usersSnapshot.docs.map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...snapshotDoc.data()
        }))

        const loadedRecords = recordsSnapshot.docs
          .map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data()
          }))
          .sort((a, b) => {
            const aDate = toDate(a.borrowedDate || a.requestDate)?.getTime() || 0
            const bDate = toDate(b.borrowedDate || b.requestDate)?.getTime() || 0
            return bDate - aDate
          })

        if (!cancelled) {
          setUsers(loadedUsers)
          setRecords(loadedRecords)
        }
      } catch (err) {
        console.error(err)

        if (!cancelled) {
          setError('Unable to load users and borrowing records.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase()

    if (!search) {
      return []
    }

    return users
      .filter((user) => {
        const values = [
          getUserName(user),
          getUserIdNumber(user),
          user.email,
          user.role
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase())

        return values.some((value) => value.includes(search))
      })
      .slice(0, 8)
  }, [users, userSearch])

  const activeRecords = useMemo(
    () => records.filter((record) => record.status === 'Borrowed' || record.status === 'Overdue'),
    [records]
  )

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function selectUser(user) {
    clearMessages()
    setSelectedUser(user)
    setUserSearch(getUserName(user))
    setCheckoutCopy(null)
    setCheckoutBook(null)
    setCheckoutScannerOpen(false)
    setDueDate(getDefaultDueDate())
  }

  function resetCheckout() {
    setSelectedUser(null)
    setUserSearch('')
    setCheckoutCopy(null)
    setCheckoutBook(null)
    setCheckoutScannerOpen(false)
    setDueDate(getDefaultDueDate())
  }

  async function handleCheckoutScan(scannedValue) {
    const accessionNo = String(scannedValue || '')
      .replace(/^BOOK:/i, '')
      .trim()

    if (!accessionNo) {
      setError('The QR code does not contain an accession number.')
      return
    }

    setBusy(true)
    clearMessages()
    setCheckoutScannerOpen(false)

    try {
      const copyRef = doc(db, 'book_copies', accessionNo)
      const copySnapshot = await getDoc(copyRef)

      if (!copySnapshot.exists()) {
        throw new Error(`Book copy ${accessionNo} was not found.`)
      }

      const copyData = copySnapshot.data()

      if (copyData.status !== 'Available') {
        throw new Error(`Book copy ${accessionNo} is not available.`)
      }

      if (!copyData.bookId) {
        throw new Error(`Book copy ${accessionNo} has no linked book.`)
      }

      const bookSnapshot = await getDoc(doc(db, 'books', copyData.bookId))

      if (!bookSnapshot.exists()) {
        throw new Error('The catalog book linked to this copy was not found.')
      }

      setCheckoutCopy({
        id: copySnapshot.id,
        ...copyData
      })

      setCheckoutBook({
        id: bookSnapshot.id,
        ...bookSnapshot.data()
      })
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to read the scanned book.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCheckout() {
    if (!selectedUser) {
      setError('Select a student or teacher first.')
      return
    }

    if (!checkoutCopy || !checkoutBook) {
      setError('Scan a book first.')
      return
    }

    if (!dueDate) {
      setError('Select a due date.')
      return
    }

    if (!auth.currentUser) {
      setError('Your admin session is not ready. Please sign in again.')
      return
    }

    const dueDateValue = new Date(`${dueDate}T23:59:59`)

    if (Number.isNaN(dueDateValue.getTime())) {
      setError('Invalid due date.')
      return
    }

    setBusy(true)
    clearMessages()

    try {
      const copyRef = doc(db, 'book_copies', checkoutCopy.id)
      const bookRef = doc(db, 'books', checkoutBook.id)
      const borrowRef = doc(collection(db, 'borrow_records'))

      await runTransaction(db, async (transaction) => {
        const copySnapshot = await transaction.get(copyRef)
        const bookSnapshot = await transaction.get(bookRef)

        if (!copySnapshot.exists()) {
          throw new Error('The book copy no longer exists.')
        }

        if (!bookSnapshot.exists()) {
          throw new Error('The catalog book no longer exists.')
        }

        const copyData = copySnapshot.data()
        const bookData = bookSnapshot.data()
        const currentAvailable = Number(bookData.availableCopies || 0)

        if (copyData.status !== 'Available') {
          throw new Error('This copy was already borrowed by another transaction.')
        }

        if (currentAvailable <= 0) {
          throw new Error('The catalog shows no available copies.')
        }

        transaction.update(copyRef, {
          status: 'Borrowed'
        })

        transaction.update(bookRef, {
          availableCopies: currentAvailable - 1,
          status: currentAvailable - 1 > 0 ? 'Available' : 'Unavailable'
        })

        transaction.set(borrowRef, {
          bookId: checkoutBook.id,
          copyId: checkoutCopy.id,
          accessionNo: checkoutCopy.accessionNo || checkoutCopy.id,
          userId: selectedUser.id,
          userRole: getUserRole(selectedUser),
          userName: getUserName(selectedUser),
          userIdNumber: getUserIdNumber(selectedUser),
          userEmail: selectedUser.email || '',
          requestDate: serverTimestamp(),
          borrowedDate: serverTimestamp(),
          dueDate: Timestamp.fromDate(dueDateValue),
          returnDate: null,
          status: 'Borrowed',
          processedBy: auth.currentUser.uid
        })
      })

      setSuccess(
        `${getUserName(selectedUser)} borrowed ${checkoutBook.title} (${checkoutCopy.accessionNo || checkoutCopy.id}).`
      )
      resetCheckout()
      await loadRecords()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to complete checkout.')
    } finally {
      setBusy(false)
    }
  }

  async function loadRecords() {
    const snapshot = await getDocs(collection(db, 'borrow_records'))

    const loadedRecords = snapshot.docs
      .map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data()
      }))
      .sort((a, b) => {
        const aDate = toDate(a.borrowedDate || a.requestDate)?.getTime() || 0
        const bDate = toDate(b.borrowedDate || b.requestDate)?.getTime() || 0
        return bDate - aDate
      })

    setRecords(loadedRecords)
  }

  async function handleReturnScan(scannedValue) {
    const accessionNo = String(scannedValue || '')
      .replace(/^BOOK:/i, '')
      .trim()

    if (!accessionNo) {
      setError('The QR code does not contain an accession number.')
      return
    }

    setBusy(true)
    clearMessages()
    setReturnScannerOpen(false)

    try {
      const copyRef = doc(db, 'book_copies', accessionNo)
      const copySnapshot = await getDoc(copyRef)

      if (!copySnapshot.exists()) {
        throw new Error(`Book copy ${accessionNo} was not found.`)
      }

      const copyData = copySnapshot.data()

      if (copyData.status !== 'Borrowed') {
        throw new Error(`Book copy ${accessionNo} is not currently borrowed.`)
      }

      if (!copyData.bookId) {
        throw new Error(`Book copy ${accessionNo} has no linked book.`)
      }

      const activeRecordQuery = query(
        collection(db, 'borrow_records'),
        where('copyId', '==', accessionNo),
        limit(10)
      )

      const recordSnapshot = await getDocs(activeRecordQuery)
      const matchingRecords = recordSnapshot.docs
        .map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...snapshotDoc.data()
        }))
        .filter((record) => record.status === 'Borrowed' || record.status === 'Overdue')
        .sort((a, b) => {
          const aDate = toDate(a.borrowedDate)?.getTime() || 0
          const bDate = toDate(b.borrowedDate)?.getTime() || 0
          return bDate - aDate
        })

      const activeRecord = matchingRecords[0]

      if (!activeRecord) {
        throw new Error('No active borrowing record was found for this copy.')
      }

      const bookSnapshot = await getDoc(doc(db, 'books', copyData.bookId))

      if (!bookSnapshot.exists()) {
        throw new Error('The catalog book linked to this copy was not found.')
      }

      setReturnCopy({
        id: copySnapshot.id,
        ...copyData
      })

      setReturnBook({
        id: bookSnapshot.id,
        ...bookSnapshot.data()
      })

      setReturnRecord(activeRecord)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to process the scanned return.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReturn() {
    if (!returnCopy || !returnBook || !returnRecord) {
      setError('Scan a currently borrowed book first.')
      return
    }

    if (!auth.currentUser) {
      setError('Your admin session is not ready. Please sign in again.')
      return
    }

    setBusy(true)
    clearMessages()

    try {
      const copyRef = doc(db, 'book_copies', returnCopy.id)
      const bookRef = doc(db, 'books', returnBook.id)
      const borrowRef = doc(db, 'borrow_records', returnRecord.id)

      await runTransaction(db, async (transaction) => {
        const copySnapshot = await transaction.get(copyRef)
        const bookSnapshot = await transaction.get(bookRef)
        const borrowSnapshot = await transaction.get(borrowRef)

        if (!copySnapshot.exists()) {
          throw new Error('The book copy no longer exists.')
        }

        if (!bookSnapshot.exists()) {
          throw new Error('The catalog book no longer exists.')
        }

        if (!borrowSnapshot.exists()) {
          throw new Error('The borrowing record no longer exists.')
        }

        const copyData = copySnapshot.data()
        const bookData = bookSnapshot.data()
        const borrowData = borrowSnapshot.data()
        const currentAvailable = Number(bookData.availableCopies || 0)
        const totalCopies = Number(bookData.totalCopies || 0)

        if (copyData.status !== 'Borrowed') {
          throw new Error('This copy is no longer marked as borrowed.')
        }

        if (borrowData.status !== 'Borrowed' && borrowData.status !== 'Overdue') {
          throw new Error('This borrowing record is no longer active.')
        }

        transaction.update(copyRef, {
          status: 'Available'
        })

        transaction.update(bookRef, {
          availableCopies: Math.min(currentAvailable + 1, totalCopies),
          status: Math.min(currentAvailable + 1, totalCopies) > 0 ? 'Available' : 'Unavailable'
        })

        transaction.update(borrowRef, {
          returnDate: serverTimestamp(),
          status: 'Returned',
          processedBy: auth.currentUser.uid
        })
      })

      setSuccess(
        `${returnRecord.userName || 'User'} returned ${returnBook.title} (${returnCopy.accessionNo || returnCopy.id}).`
      )
      setReturnCopy(null)
      setReturnBook(null)
      setReturnRecord(null)
      await loadRecords()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to complete return.')
    } finally {
      setBusy(false)
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    clearMessages()
    setCheckoutScannerOpen(false)
    setReturnScannerOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <p className="text-sm font-medium text-[#2E7D32]">Circulation</p>
          <h1 className="mt-1 text-3xl font-bold text-[#212529]">
            Borrowing & Returns
          </h1>
          <p className="mt-2 text-gray-600">
            Process checkouts and returns at the library desk using the book QR code.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <div>{error}</div>
            <button onClick={() => setError('')} className="ml-auto">
              <X size={18} />
            </button>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
            <div>{success}</div>
            <button onClick={() => setSuccess('')} className="ml-auto">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="flex gap-2 rounded-xl bg-gray-100 p-1 sm:w-fit">
          <button
            onClick={() => switchMode('checkout')}
            className={`rounded-lg px-5 py-3 text-sm font-semibold ${mode === 'checkout' ? 'bg-white text-[#0A2540] shadow-sm' : 'text-gray-600'}`}
          >
            Checkout
          </button>
          <button
            onClick={() => switchMode('return')}
            className={`rounded-lg px-5 py-3 text-sm font-semibold ${mode === 'return' ? 'bg-white text-[#0A2540] shadow-sm' : 'text-gray-600'}`}
          >
            Return
          </button>
        </div>

        {mode === 'checkout' && (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-3 text-[#0A2540]">
                  <UserRound size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#212529]">
                    1. Identify Borrower
                  </h2>
                  <p className="text-sm text-gray-500">
                    Search by name, ID number, email, or role.
                  </p>
                </div>
              </div>

              <div className="relative mt-5">
                <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={userSearch}
                  onChange={(event) => {
                    setUserSearch(event.target.value)
                    setSelectedUser(null)
                  }}
                  placeholder="Search student or teacher..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 outline-none focus:border-[#0A2540]"
                />
              </div>

              {!selectedUser && filteredUsers.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => selectUser(user)}
                      className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left last:border-0 hover:bg-gray-50"
                    >
                      <div>
                        <div className="font-semibold text-[#212529]">
                          {getUserName(user)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getUserIdNumber(user) || user.email || 'No ID'}
                        </div>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold capitalize text-gray-700">
                        {getUserRole(user)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {selectedUser && (
                <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-green-700">
                        Selected borrower
                      </div>
                      <div className="mt-1 text-lg font-bold text-[#212529]">
                        {getUserName(selectedUser)}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {getUserIdNumber(selectedUser) || selectedUser.email || 'No ID'}
                      </div>
                      <div className="mt-1 text-sm capitalize text-gray-600">
                        {getUserRole(selectedUser)}
                      </div>
                    </div>

                    <button
                      onClick={resetCheckout}
                      className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-gray-700"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-8 border-t border-gray-100 pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-3 text-[#2E7D32]">
                    <QrCode size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#212529]">
                      2. Scan Book QR
                    </h2>
                    <p className="text-sm text-gray-500">
                      Scan the QR printed on the physical book copy.
                    </p>
                  </div>
                </div>

                {!selectedUser ? (
                  <div className="mt-5 rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
                    Select the borrower before scanning the book.
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        clearMessages()
                        setCheckoutScannerOpen(true)
                      }}
                      disabled={busy}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0A2540] px-5 py-3 font-semibold text-white disabled:opacity-50"
                    >
                      <QrCode size={18} />
                      Open Camera Scanner
                    </button>

                    {checkoutScannerOpen && (
                      <div className="mt-5 rounded-xl border border-gray-200 p-4">
                        <LibraryCodeScanner
                          onScan={handleCheckoutScan}
                          onClose={() => setCheckoutScannerOpen(false)}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gray-100 p-3 text-[#0A2540]">
                  <CalendarDays size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#212529]">
                    3. Confirm Checkout
                  </h2>
                  <p className="text-sm text-gray-500">
                    Review the copy and due date before saving.
                  </p>
                </div>
              </div>

              {checkoutCopy && checkoutBook ? (
                <div className="mt-6 space-y-5">
                  <div className="rounded-xl bg-gray-50 p-5">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Book
                    </div>
                    <div className="mt-1 text-xl font-bold text-[#212529]">
                      {checkoutBook.title}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      {checkoutBook.author || 'Unknown author'}
                    </div>
                    <div className="mt-4 font-mono text-sm font-semibold text-[#0A2540]">
                      Accession: {checkoutCopy.accessionNo || checkoutCopy.id}
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#212529]">
                      Due Date
                    </span>
                    <input
                      type="date"
                      value={dueDate}
                      min={getDateInputValue(new Date())}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#0A2540]"
                    />
                  </label>

                  <button
                    onClick={handleCheckout}
                    disabled={busy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2E7D32] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 size={18} />
                    {busy ? 'Processing...' : 'Confirm Borrowing'}
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
                  The scanned book will appear here for confirmation.
                </div>
              )}
            </section>
          </div>
        )}

        {mode === 'return' && (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-3 text-[#2E7D32]">
                  <RotateCcw size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#212529]">
                    Scan Returned Book
                  </h2>
                  <p className="text-sm text-gray-500">
                    Scan the QR on the book being returned.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  clearMessages()
                  setReturnScannerOpen(true)
                }}
                disabled={busy}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0A2540] px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                <QrCode size={18} />
                Open Camera Scanner
              </button>

              {returnScannerOpen && (
                <div className="mt-5 rounded-xl border border-gray-200 p-4">
                  <LibraryCodeScanner
                    onScan={handleReturnScan}
                    onClose={() => setReturnScannerOpen(false)}
                  />
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-3 text-[#0A2540]">
                  <BookOpen size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#212529]">
                    Confirm Return
                  </h2>
                  <p className="text-sm text-gray-500">
                    Verify the borrower and copy before completing the return.
                  </p>
                </div>
              </div>

              {returnCopy && returnBook && returnRecord ? (
                <div className="mt-6 space-y-5">
                  <div className="rounded-xl bg-gray-50 p-5">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Borrower
                    </div>
                    <div className="mt-1 text-lg font-bold text-[#212529]">
                      {returnRecord.userName || 'Unknown user'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {returnRecord.userIdNumber || returnRecord.userEmail || 'No ID'}
                    </div>

                    <div className="mt-5 border-t border-gray-200 pt-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Book
                      </div>
                      <div className="mt-1 text-xl font-bold text-[#212529]">
                        {returnBook.title}
                      </div>
                      <div className="mt-1 font-mono text-sm font-semibold text-[#0A2540]">
                        Accession: {returnCopy.accessionNo || returnCopy.id}
                      </div>
                      <div className="mt-3 text-sm text-gray-600">
                        Due: {toDate(returnRecord.dueDate)?.toLocaleDateString() || 'No due date'}
                      </div>
                      <div className="mt-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(getDisplayStatus(returnRecord))}`}>
                          {getDisplayStatus(returnRecord)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleReturn}
                    disabled={busy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2E7D32] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 size={18} />
                    {busy ? 'Processing...' : 'Confirm Return'}
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
                  Scan a borrowed copy to see its current borrower and due date.
                </div>
              )}
            </section>
          </div>
        )}

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#212529]">
                Active Borrowings
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Current borrowed copies and their due dates.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">
              {activeRecords.length}
            </span>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Loading borrowing records...
            </div>
          ) : activeRecords.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">
              No active borrowings.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="px-4 py-3 font-medium">Borrower</th>
                    <th className="px-4 py-3 font-medium">Book</th>
                    <th className="px-4 py-3 font-medium">Accession</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRecords.map((record) => (
                    <tr key={record.id} className="border-b border-gray-100">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#212529]">
                          {record.userName || 'Unknown user'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {record.userIdNumber || record.userEmail || ''}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[#212529]">
                        {record.bookId}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs">
                        {record.accessionNo || record.copyId}
                      </td>
                      <td className="px-4 py-4">
                        {toDate(record.dueDate)?.toLocaleDateString() || 'No due date'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(getDisplayStatus(record))}`}>
                          {getDisplayStatus(record)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          Checkout and return update the physical copy, catalog availability, and borrowing record together using a Firestore transaction, so the three records stay consistent when librarians work at the same time.
        </div>
      </main>
    </div>
  )
}

export default AdminBorrowing
