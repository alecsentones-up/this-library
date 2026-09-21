import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Search,
  UserRound,
  X,
  LogOut
} from 'lucide-react'
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where
} from 'firebase/firestore'
import {
  onAuthStateChanged,
  signOut
} from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../../firebase'

function PublicCatalog() {
  const navigate = useNavigate()

  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedBook, setSelectedBook] = useState(null)

  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    let cancelled = false

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (cancelled) {
          return
        }

        setUser(currentUser)

        if (!currentUser) {
          setUserProfile(null)
          setAuthLoading(false)
          return
        }

        try {
          const userSnapshot = await getDocs(
            query(
              collection(db, 'users'),
              where('__name__', '==', currentUser.uid)
            )
          )

          if (!cancelled) {
            if (!userSnapshot.empty) {
              setUserProfile(
                userSnapshot.docs[0].data()
              )
            } else {
              setUserProfile(null)
            }
          }
        } catch (error) {
          console.error(error)

          if (!cancelled) {
            setUserProfile(null)
          }
        } finally {
          if (!cancelled) {
            setAuthLoading(false)
          }
        }
      }
    )

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadBooks = async () => {
      setLoading(true)
      setError('')

      try {
        const snapshot = await getDocs(
          collection(db, 'books')
        )

        const loadedBooks = snapshot.docs.map(
          (bookDoc) => ({
            id: bookDoc.id,
            ...bookDoc.data()
          })
        )

        if (!cancelled) {
          setBooks(loadedBooks)
        }
      } catch (err) {
        console.error(err)

        if (!cancelled) {
          setError(
            'Unable to load books. Please try again.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadBooks()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredBooks = useMemo(() => {
    const queryText = search.trim().toLowerCase()

    return books.filter((book) => {
      const matchesSearch =
        !queryText ||
        book.title?.toLowerCase().includes(queryText) ||
        book.author?.toLowerCase().includes(queryText) ||
        book.isbn?.toLowerCase().includes(queryText)

      const matchesFilter =
        filter === 'all' ||
        (
          filter === 'available' &&
          Number(book.availableCopies) > 0
        ) ||
        (
          filter === 'borrowed' &&
          Number(book.availableCopies) === 0
        )

      return matchesSearch && matchesFilter
    })
  }, [books, search, filter])

  function getAvailability(book) {
    const total = Number(book.totalCopies || 0)
    const available = Number(
      book.availableCopies || 0
    )

    const borrowed = Math.max(
      total - available,
      0
    )

    if (available > 0) {
      return {
        label: `${available} available`,
        className:
          'bg-green-100 text-green-800'
      }
    }

    return {
      label:
        borrowed > 0
          ? 'Currently borrowed'
          : 'Unavailable',
      className:
        'bg-yellow-100 text-yellow-800'
    }
  }

  async function handleBorrowRequest(book) {
    if (!user) {
      navigate('/login')
      return
    }

    if (requesting) {
      return
    }

    if ((book.availableCopies ?? 0) <= 0) {
      window.alert(
        'This book is currently unavailable.'
      )
      return
    }

    setRequesting(true)

    try {
      const existingSnapshot = await getDocs(
        query(
          collection(db, 'borrow_records'),
          where('userId', '==', user.uid)
        )
      )

      const alreadyRequested =
        existingSnapshot.docs.some(
          (recordDoc) => {
            const record = recordDoc.data()

            return (
              record.bookId === book.id &&
              (
                record.status ===
                  'Pending Request' ||
                record.status === 'Borrowed' ||
                record.status === 'Overdue'
              )
            )
          }
        )

      if (alreadyRequested) {
        window.alert(
          'You already have an active request or borrowing record for this book.'
        )
        return
      }

      await addDoc(
        collection(db, 'borrow_records'),
        {
          bookId: book.id,
          bookTitle: book.title,
          userId: user.uid,
          userRole:
            userProfile?.role || 'student',
          userName:
            userProfile?.name ||
            user.displayName ||
            user.email ||
            'Library User',
          userEmail: user.email || '',
          requestDate: serverTimestamp(),
          borrowedDate: null,
          dueDate: null,
          returnDate: null,
          status: 'Pending Request'
        }
      )

      window.alert(
        'Your borrowing request has been submitted.'
      )
    } catch (error) {
      console.error(error)

      window.alert(
        'Unable to submit your request. Please try again.'
      )
    } finally {
      setRequesting(false)
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth)
      setSelectedBook(null)
    } catch (error) {
      console.error(error)
    }
  }

  if (selectedBook) {
    const availability =
      getAvailability(selectedBook)

    const total = Number(
      selectedBook.totalCopies || 0
    )

    const available = Number(
      selectedBook.availableCopies || 0
    )

    const borrowed = Math.max(
      total - available,
      0
    )

    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <header className="bg-[#0A2540] text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
            <button
              onClick={() => setSelectedBook(null)}
              className="flex items-center gap-2 font-medium hover:opacity-80"
            >
              <ArrowLeft size={20} />
              Back to Catalog
            </button>

            <div className="flex items-center gap-2">
              <BookOpen size={22} />
              <span className="font-semibold">
                THIS Library
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-6 py-10">
          <div className="grid gap-10 rounded-2xl bg-white p-8 shadow-sm md:grid-cols-[260px_1fr]">
            <div>
              {selectedBook.coverImageUrl ? (
                <img
                  src={selectedBook.coverImageUrl}
                  alt={selectedBook.title}
                  className="w-full rounded-xl object-cover shadow"
                />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-[#0A2540] text-white">
                  <BookOpen size={64} />
                </div>
              )}
            </div>

            <div>
              <span
                className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${availability.className}`}
              >
                {availability.label}
              </span>

              <h1 className="mt-4 text-3xl font-bold text-[#212529]">
                {selectedBook.title}
              </h1>

              <p className="mt-2 text-lg text-gray-600">
                {selectedBook.author ||
                  'Unknown author'}
              </p>

              {selectedBook.isbn && (
                <p className="mt-4 text-sm text-gray-500">
                  ISBN: {selectedBook.isbn}
                </p>
              )}

              <p className="mt-6 leading-7 text-gray-600">
                {selectedBook.description ||
                  'No description available.'}
              </p>

              <div className="mt-8 grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-[#F8F9FA] p-4 text-center">
                  <div className="text-2xl font-bold text-[#0A2540]">
                    {total}
                  </div>
                  <div className="text-sm text-gray-500">
                    Total Copies
                  </div>
                </div>

                <div className="rounded-xl bg-[#F8F9FA] p-4 text-center">
                  <div className="text-2xl font-bold text-[#2E7D32]">
                    {available}
                  </div>
                  <div className="text-sm text-gray-500">
                    Available
                  </div>
                </div>

                <div className="rounded-xl bg-[#F8F9FA] p-4 text-center">
                  <div className="text-2xl font-bold text-[#FBC02D]">
                    {borrowed}
                  </div>
                  <div className="text-sm text-gray-500">
                    Borrowed
                  </div>
                </div>
              </div>

              <button
                onClick={() =>
                  handleBorrowRequest(
                    selectedBook
                  )
                }
                disabled={
                  available === 0 ||
                  requesting ||
                  authLoading
                }
                className="mt-8 rounded-lg bg-[#0A2540] px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {requesting
                  ? 'Submitting...'
                  : available === 0
                    ? 'Currently Unavailable'
                    : 'Request to Borrow'}
              </button>
            </div>
          </div>
        </main>
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
                This Library
              </h1>

              <p className="text-xs text-white/70">
                Library Catalog
              </p>
            </div>
          </div>

          {authLoading ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-white/10" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/account')}
                className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10"
              >
                <UserRound size={19} />

                <span className="hidden sm:inline">
                  My Account
                </span>
              </button>

              <button
                onClick={handleSignOut}
                className="rounded-lg p-2 hover:bg-white/10"
                title="Sign Out"
              >
                <LogOut size={19} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10"
            >
              <UserRound size={19} />

              <span className="hidden sm:inline">
                Sign In
              </span>
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-[#212529]">
            Browse the Library
          </h2>

          <p className="mt-2 text-gray-600">
            Search books and check their availability.
          </p>
        </div>

        <div className="mb-8 flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search by title, author, or ISBN..."
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-12 pr-10 outline-none focus:border-[#0A2540]"
            />

            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="flex rounded-xl border border-gray-200 bg-white p-1">
            {[
              ['all', 'All'],
              ['available', 'Available'],
              ['borrowed', 'Borrowed']
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  filter === value
                    ? 'bg-[#0A2540] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <p className="text-gray-500">
              Loading books...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          filteredBooks.length === 0 && (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm">
              <BookOpen
                size={42}
                className="mx-auto mb-4 text-gray-300"
              />

              <h3 className="text-lg font-semibold text-[#212529]">
                No books found
              </h3>

              <p className="mt-2 text-gray-500">
                Try a different search or filter.
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          filteredBooks.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredBooks.map((book) => {
                const availability =
                  getAvailability(book)

                return (
                  <div
                    key={book.id}
                    className="overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  >
                    {book.coverImageUrl ? (
                      <img
                        src={book.coverImageUrl}
                        alt={book.title}
                        className="h-64 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-64 items-center justify-center bg-[#0A2540] text-white">
                        <BookOpen size={56} />
                      </div>
                    )}

                    <div className="p-5">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${availability.className}`}
                      >
                        {availability.label}
                      </span>

                      <h3 className="mt-3 line-clamp-2 text-lg font-bold text-[#212529]">
                        {book.title}
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        {book.author ||
                          'Unknown author'}
                      </p>

                      <button
                        onClick={() =>
                          setSelectedBook(book)
                        }
                        className="mt-5 w-full rounded-lg border border-[#0A2540] px-4 py-2.5 font-medium text-[#0A2540] transition hover:bg-[#0A2540] hover:text-white"
                      >
                        View Book
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </main>
    </div>
  )
}

export default PublicCatalog