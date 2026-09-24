import { useEffect, useState } from 'react'
import {
  BookOpen,
  Camera,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore'
import { db } from '../../firebase'
import LibraryCodeScanner from '../../components/LibraryCodeScanner'
import { getBooksPage, searchBooks, ADMIN_BOOKS_PAGE_SIZE } from '../../services/bookPagination'

const emptyForm = {
  title: '',
  author: '',
  isbn: '',
  description: '',
  coverImageUrl: '',
  totalCopies: 1
}

function normalizeIsbn(value) {
  return String(value || '')
    .replace(/[^0-9Xx]/g, '')
    .toUpperCase()
}

async function loadGoogleBook(isbn) {
  const cleanIsbn = normalizeIsbn(isbn)

  if (!cleanIsbn) {
    return null
  }

  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(cleanIsbn)}`
  )

  if (!response.ok) {
    throw new Error('Unable to retrieve book details from Google Books.')
  }

  const data = await response.json()

  if (!data.items?.length) {
    return null
  }

  const info = data.items[0].volumeInfo || {}

  return {
    title: info.title || '',
    author: Array.isArray(info.authors) ? info.authors.join(', ') : '',
    description: info.description || '',
    coverImageUrl: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || ''
  }
}

function getAvailability(book) {
  const total = Number(book.totalCopies || 0)
  const available = Number(book.availableCopies || 0)

  if (available > 0) {
    return {
      label: `${available} available`,
      className: 'bg-green-100 text-green-800'
    }
  }

  if (total > 0) {
    return {
      label: 'All copies borrowed',
      className: 'bg-yellow-100 text-yellow-800'
    }
  }

  return {
    label: 'No copies',
    className: 'bg-gray-100 text-gray-600'
  }
}

function AdminBooks() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageCursors, setPageCursors] = useState({ 1: null })
  const [hasNext, setHasNext] = useState(false)
  const [selectedBook, setSelectedBook] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingBook, setEditingBook] = useState(null)
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [lookingUpIsbn, setLookingUpIsbn] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchPage() {
      setLoading(true)
      setError('')

      try {
        if (appliedSearch.trim()) {
          const results = await searchBooks({
            search: appliedSearch,
            pageSize: ADMIN_BOOKS_PAGE_SIZE
          })

          if (!cancelled) {
            setBooks(results)
            setHasNext(false)
          }
          return
        }

        const cursor = pageCursors[page] || null
        const result = await getBooksPage({
          cursor,
          pageSize: ADMIN_BOOKS_PAGE_SIZE
        })

        if (!cancelled) {
          setBooks(result.books)
          setHasNext(result.hasNext)

          if (result.lastDoc) {
            setPageCursors((current) => ({
              ...current,
              [page + 1]: result.lastDoc
            }))
          }
        }
      } catch (err) {
        console.error(err)

        if (!cancelled) {
          setError('Unable to load books. Please try again.')
          setBooks([])
          setHasNext(false)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchPage()

    return () => {
      cancelled = true
    }
  }, [page, appliedSearch])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim())
      setPage(1)
      setPageCursors({ 1: null })
    }, 350)

    return () => window.clearTimeout(timer)
  }, [search])

  async function openDetails(book) {
    setSelectedBook(book)
  }

  function openAdd() {
    setEditingBook(null)
    setFormData(emptyForm)
    setFormOpen(true)
    setScannerOpen(false)
  }

  function openEdit(book) {
    setEditingBook(book)
    setFormData({
      title: book.title || '',
      author: book.author || '',
      isbn: book.isbn || '',
      description: book.description || '',
      coverImageUrl: book.coverImageUrl || '',
      totalCopies: Number(book.totalCopies || 1)
    })
    setFormOpen(true)
    setScannerOpen(false)
    setSelectedBook(null)
  }

  function closeForm() {
    if (saving) {
      return
    }

    setFormOpen(false)
    setEditingBook(null)
    setFormData(emptyForm)
    setScannerOpen(false)
  }

  async function handleIsbnScan(value) {
    const isbn = normalizeIsbn(value)

    setScannerOpen(false)
    setFormData((current) => ({
      ...current,
      isbn
    }))

    if (!isbn) {
      return
    }

    setLookingUpIsbn(true)

    try {
      const result = await loadGoogleBook(isbn)

      if (result) {
        setFormData((current) => ({
          ...current,
          ...result,
          isbn
        }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLookingUpIsbn(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const title = formData.title.trim()
    const author = formData.author.trim()
    const isbn = normalizeIsbn(formData.isbn)
    const totalCopies = Math.max(Number(formData.totalCopies) || 0, 1)

    if (!title) {
      setError('Book title is required.')
      return
    }

    if (!editingBook && totalCopies < 1) {
      setError('Total copies must be at least 1.')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (editingBook) {
        const previousTotal = Number(editingBook.totalCopies || 0)
        const previousAvailable = Number(editingBook.availableCopies || 0)
        const borrowedCopies = Math.max(previousTotal - previousAvailable, 0)
        const nextAvailable = Math.max(totalCopies - borrowedCopies, 0)

        await updateDoc(doc(db, 'books', editingBook.id), {
          title,
          author,
          isbn,
          description: formData.description.trim(),
          coverImageUrl: formData.coverImageUrl.trim(),
          totalCopies,
          availableCopies: nextAvailable,
          status: nextAvailable > 0 ? 'Available' : 'Out of Stock'
        })
      } else {
        await addDoc(collection(db, 'books'), {
          title,
          author,
          isbn,
          description: formData.description.trim(),
          coverImageUrl: formData.coverImageUrl.trim(),
          totalCopies,
          availableCopies: totalCopies,
          status: 'Available',
          createdAt: serverTimestamp()
        })
      }

      closeForm()

      if (appliedSearch) {
        setAppliedSearch('')
        setSearch('')
      } else {
        setPage(1)
        setPageCursors({ 1: null })
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to save book.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(book) {
    const confirmed = window.confirm(
      `Delete "${book.title || 'this book'}"? This only deletes the catalog record. Do not delete books that have active copies or borrowing records.`
    )

    if (!confirmed) {
      return
    }

    setDeletingId(book.id)
    setError('')

    try {
      await deleteDoc(doc(db, 'books', book.id))
      setSelectedBook(null)

      if (books.length === 1 && page > 1) {
        setPage(page - 1)
        setPageCursors((current) => {
          const next = { ...current }
          delete next[page + 1]
          return next
        })
      } else {
        setPage((current) => current)
        setPageCursors((current) => ({ ...current }))
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to delete book.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="flex min-h-screen">
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#212529] sm:text-3xl">
                  Books
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage the library catalog without loading the entire collection.
                </p>
              </div>

              <button
                onClick={openAdd}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A2540] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <Plus size={18} />
                Add Book
              </button>
            </div>

            <div className="mb-6 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  size={19}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title, author, or ISBN..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-10 outline-none focus:border-[#0A2540]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {appliedSearch && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Clear Search
                </button>
              )}
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {loading ? (
                <div className="p-12 text-center text-sm text-gray-500">
                  Loading books...
                </div>
              ) : books.length === 0 ? (
                <div className="p-12 text-center">
                  <BookOpen size={42} className="mx-auto mb-4 text-gray-300" />
                  <h2 className="text-lg font-semibold text-[#212529]">
                    {appliedSearch ? 'No books found' : 'No books yet'}
                  </h2>
                  <p className="mt-2 text-sm text-gray-500">
                    {appliedSearch
                      ? 'Try another title, author, or ISBN.'
                      : 'Add your first book or import the accession spreadsheet.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left">
                      <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-5 py-4">Book</th>
                          <th className="px-5 py-4">ISBN</th>
                          <th className="px-5 py-4">Copies</th>
                          <th className="px-5 py-4">Status</th>
                          <th className="px-5 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {books.map((book) => {
                          const availability = getAvailability(book)

                          return (
                            <tr key={book.id} className="hover:bg-gray-50">
                              <td className="px-5 py-4">
                                <div className="flex min-w-[260px] items-center gap-3">
                                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-[#0A2540]">
                                    {book.coverImageUrl ? (
                                      <img
                                        src={book.coverImageUrl}
                                        alt=""
                                        loading="lazy"
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full items-center justify-center text-white">
                                        <BookOpen size={18} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="line-clamp-2 font-semibold text-[#212529]">
                                      {book.title || 'Untitled'}
                                    </div>
                                    <div className="mt-1 text-sm text-gray-500">
                                      {book.author || 'Unknown author'}
                                    </div>
                                    {book.callNo && (
                                      <div className="mt-1 text-xs text-gray-400">
                                        Call no.: {book.callNo}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-sm text-gray-600">
                                {book.isbn || '—'}
                              </td>
                              <td className="px-5 py-4 text-sm text-gray-600">
                                {Number(book.availableCopies || 0)} / {Number(book.totalCopies || 0)}
                              </td>
                              <td className="px-5 py-4">
                                <span className={`rounded-full px-3 py-1 text-xs font-medium ${availability.className}`}>
                                  {availability.label}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openDetails(book)}
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEdit(book)}
                                    className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                                    aria-label={`Edit ${book.title}`}
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(book)}
                                    disabled={deletingId === book.id}
                                    className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                                    aria-label={`Delete ${book.title}`}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="divide-y divide-gray-100 md:hidden">
                    {books.map((book) => {
                      const availability = getAvailability(book)

                      return (
                        <div key={book.id} className="p-4">
                          <div className="flex gap-4">
                            <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-[#0A2540]">
                              {book.coverImageUrl ? (
                                <img
                                  src={book.coverImageUrl}
                                  alt=""
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-white">
                                  <BookOpen size={22} />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="line-clamp-2 font-semibold text-[#212529]">
                                {book.title || 'Untitled'}
                              </div>
                              <div className="mt-1 text-sm text-gray-500">
                                {book.author || 'Unknown author'}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <span>{Number(book.availableCopies || 0)} / {Number(book.totalCopies || 0)} copies</span>
                                <span className={`rounded-full px-2.5 py-1 font-medium ${availability.className}`}>
                                  {availability.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex gap-2">
                            <button
                              type="button"
                              onClick={() => openDetails(book)}
                              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(book)}
                              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(book)}
                              disabled={deletingId === book.id}
                              className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {!appliedSearch && (
                    <div className="flex items-center justify-between border-t border-gray-200 px-4 py-4 sm:px-5">
                      <div className="text-sm text-gray-500">
                        Page {page} · {books.length} books
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={page === 1 || loading}
                          onClick={() => setPage((current) => Math.max(current - 1, 1))}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ChevronLeft size={16} />
                          Previous
                        </button>

                        <button
                          type="button"
                          disabled={!hasNext || loading}
                          onClick={() => setPage((current) => current + 1)}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#0A2540] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Next
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {appliedSearch && (
                    <div className="border-t border-gray-200 px-4 py-4 text-sm text-gray-500 sm:px-5">
                      Search results are limited to the matching results returned by the catalog search.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="font-semibold text-[#212529]">Book Details</div>
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-[180px_1fr]">
              <div>
                {selectedBook.coverImageUrl ? (
                  <img
                    src={selectedBook.coverImageUrl}
                    alt={selectedBook.title}
                    loading="lazy"
                    className="mx-auto aspect-[3/4] w-full rounded-xl object-cover shadow-sm"
                  />
                ) : (
                  <div className="mx-auto flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-[#0A2540] text-white">
                    <BookOpen size={48} />
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-bold text-[#212529]">
                  {selectedBook.title || 'Untitled'}
                </h2>
                <p className="mt-1 text-gray-600">
                  {selectedBook.author || 'Unknown author'}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-[#F8F9FA] p-3">
                    <div className="text-xl font-bold text-[#0A2540]">{Number(selectedBook.totalCopies || 0)}</div>
                    <div className="text-xs text-gray-500">Total</div>
                  </div>
                  <div className="rounded-xl bg-[#F8F9FA] p-3">
                    <div className="text-xl font-bold text-[#2E7D32]">{Number(selectedBook.availableCopies || 0)}</div>
                    <div className="text-xs text-gray-500">Available</div>
                  </div>
                  <div className="rounded-xl bg-[#F8F9FA] p-3">
                    <div className="text-xl font-bold text-[#FBC02D]">{Math.max(Number(selectedBook.totalCopies || 0) - Number(selectedBook.availableCopies || 0), 0)}</div>
                    <div className="text-xs text-gray-500">Borrowed</div>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <div><span className="font-semibold">ISBN:</span> {selectedBook.isbn || '—'}</div>
                  <div><span className="font-semibold">Call No.:</span> {selectedBook.callNo || '—'}</div>
                  <div><span className="font-semibold">Publisher:</span> {selectedBook.publisher || '—'}</div>
                  <div><span className="font-semibold">Edition:</span> {selectedBook.edition || '—'}</div>
                  <div><span className="font-semibold">Description:</span> {selectedBook.description || 'No description available.'}</div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(selectedBook)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0A2540] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    <Edit3 size={16} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedBook)}
                    disabled={deletingId === selectedBook.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <div className="font-semibold text-[#212529]">
                  {editingBook ? 'Edit Book' : 'Add Book'}
                </div>
                <div className="text-xs text-gray-500">
                  Bibliographic information and catalog copies
                </div>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setScannerOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#0A2540] px-4 py-2.5 text-sm font-semibold text-[#0A2540] hover:bg-gray-50"
                >
                  <Camera size={17} />
                  {scannerOpen ? 'Close Scanner' : 'Scan ISBN'}
                </button>

                {lookingUpIsbn && (
                  <div className="self-center text-sm text-gray-500">
                    Looking up ISBN...
                  </div>
                )}
              </div>

              {scannerOpen && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <LibraryCodeScanner onScan={handleIsbnScan} />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Title</label>
                  <input
                    value={formData.title}
                    onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none focus:border-[#0A2540]"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Author</label>
                  <input
                    value={formData.author}
                    onChange={(event) => setFormData((current) => ({ ...current, author: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none focus:border-[#0A2540]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">ISBN</label>
                  <input
                    value={formData.isbn}
                    onChange={(event) => setFormData((current) => ({ ...current, isbn: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none focus:border-[#0A2540]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none focus:border-[#0A2540]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Cover Image URL</label>
                  <input
                    value={formData.coverImageUrl}
                    onChange={(event) => setFormData((current) => ({ ...current, coverImageUrl: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none focus:border-[#0A2540]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Total Copies</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.totalCopies}
                    onChange={(event) => setFormData((current) => ({ ...current, totalCopies: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none focus:border-[#0A2540]"
                  />
                  {editingBook && (
                    <p className="mt-1 text-xs text-gray-500">
                      Borrowed copies are preserved when changing the total.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || lookingUpIsbn}
                  className="rounded-lg bg-[#0A2540] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? 'Saving...' : editingBook ? 'Save Changes' : 'Add Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminBooks
