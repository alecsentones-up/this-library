import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Edit,
  Eye,
  Plus,
  ScanLine,
  Search,
  Trash2,
  X
} from 'lucide-react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../../firebase'
import IsbnScanner from '../../components/IsbnScanner'

const emptyForm = {
  title: '',
  author: '',
  isbn: '',
  description: '',
  coverImageUrl: '',
  totalCopies: 1
}

function AdminBooks() {
  const navigate = useNavigate()

  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isbnLoading, setIsbnLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  const [selectedBook, setSelectedBook] = useState(null)
  const [editingBook, setEditingBook] = useState(null)

  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    let cancelled = false

    async function fetchBooks() {
      try {
        const snapshot = await getDocs(collection(db, 'books'))

        const loadedBooks = snapshot.docs.map((bookDoc) => ({
          id: bookDoc.id,
          ...bookDoc.data()
        }))

        if (!cancelled) {
          setBooks(loadedBooks)
          setLoading(false)
        }
      } catch (error) {
        console.error(error)

        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchBooks()

    return () => {
      cancelled = true
    }
  }, [])

  function resetForm() {
    setForm(emptyForm)
    setEditingBook(null)
    setShowForm(false)
  }

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value
    }))
  }

  function openAddForm() {
    setForm(emptyForm)
    setEditingBook(null)
    setShowForm(true)
  }

  function openEditForm(book) {
    setEditingBook(book)

    setForm({
      title: book.title || '',
      author: book.author || '',
      isbn: book.isbn || '',
      description: book.description || '',
      coverImageUrl: book.coverImageUrl || '',
      totalCopies: book.totalCopies || 1
    })

    setShowForm(true)
  }

  async function refreshBooks() {
    const snapshot = await getDocs(collection(db, 'books'))

    const loadedBooks = snapshot.docs.map((bookDoc) => ({
      id: bookDoc.id,
      ...bookDoc.data()
    }))

    setBooks(loadedBooks)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const title = form.title.trim()
    const author = form.author.trim()
    const isbn = form.isbn.trim()
    const description = form.description.trim()
    const coverImageUrl = form.coverImageUrl.trim()
    const totalCopies = Number(form.totalCopies)

    if (!title || !author || totalCopies < 1) {
      return
    }

    setSaving(true)

    try {
      if (editingBook) {
        const previousTotalCopies = Number(
          editingBook.totalCopies || 0
        )

        const previousAvailableCopies = Number(
          editingBook.availableCopies || 0
        )

        const borrowedCopies =
          previousTotalCopies - previousAvailableCopies

        const availableCopies = Math.max(
          totalCopies - borrowedCopies,
          0
        )

        let status = 'Available'

        if (availableCopies === 0) {
          status = 'Borrowed'
        }

        await updateDoc(doc(db, 'books', editingBook.id), {
          title,
          author,
          isbn,
          description,
          coverImageUrl,
          totalCopies,
          availableCopies,
          status,
          updatedAt: serverTimestamp()
        })
      } else {
        await addDoc(collection(db, 'books'), {
          title,
          author,
          isbn,
          description,
          coverImageUrl,
          totalCopies,
          availableCopies: totalCopies,
          status: 'Available',
          createdAt: serverTimestamp()
        })
      }

      await refreshBooks()
      resetForm()
    } catch (error) {
      console.error(error)
      window.alert('Unable to save the book. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(book) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${book.title}"?`
    )

    if (!confirmed) {
      return
    }

    setDeleting(true)

    try {
      await deleteDoc(doc(db, 'books', book.id))

      setBooks((current) =>
        current.filter((item) => item.id !== book.id)
      )

      setSelectedBook(null)
    } catch (error) {
      console.error(error)
      window.alert('Unable to delete the book. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleIsbnScan = useCallback(async (isbn) => {
    setShowScanner(false)
    setIsbnLoading(true)

    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`
      )

      if (!response.ok) {
        throw new Error('Google Books request failed')
      }

      const data = await response.json()
      const book = data.items?.[0]?.volumeInfo

      if (!book) {
        setForm((current) => ({
          ...current,
          isbn
        }))

        return
      }

      setForm((current) => ({
        ...current,
        title: book.title || '',
        author: book.authors?.join(', ') || '',
        isbn,
        description: book.description || '',
        coverImageUrl:
          book.imageLinks?.thumbnail ||
          book.imageLinks?.smallThumbnail ||
          ''
      }))
    } catch (error) {
      console.error(error)

      setForm((current) => ({
        ...current,
        isbn
      }))
    } finally {
      setIsbnLoading(false)
    }
  }, [])

  const filteredBooks = books.filter((book) => {
    const keyword = search.toLowerCase()

    return (
      book.title?.toLowerCase().includes(keyword) ||
      book.author?.toLowerCase().includes(keyword) ||
      book.isbn?.toLowerCase().includes(keyword)
    )
  })

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-[#0A2540] text-white">
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
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
              <h1 className="font-bold">THIS Library</h1>
              <p className="text-xs text-white/70">
                Book Management
              </p>
            </div>
          </div>

          <button
            onClick={openAddForm}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-semibold text-[#0A2540] hover:bg-gray-100"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add Book</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6 md:p-10">
        <div>
          <h2 className="text-3xl font-bold text-[#212529]">
            Books
          </h2>

          <p className="mt-2 text-gray-500">
            Add, view, edit, and delete library books.
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
          <div className="relative max-w-xl">
            <Search
              size={19}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, author, or ISBN"
              className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-4 outline-none focus:border-[#0A2540]"
            />
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading books...
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="p-10 text-center">
              <BookOpen
                size={40}
                className="mx-auto text-gray-300"
              />

              <h3 className="mt-4 font-semibold text-[#212529]">
                No books found
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Add your first book to the library.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredBooks.map((book) => (
                <div
                  key={book.id}
                  className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"
                >
                  <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                    {book.coverImageUrl ? (
                      <img
                        src={book.coverImageUrl}
                        alt={book.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BookOpen
                        size={24}
                        className="text-gray-400"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-[#212529]">
                      {book.title}
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      {book.author}
                    </p>

                    {book.isbn && (
                      <p className="mt-1 text-xs text-gray-400">
                        ISBN: {book.isbn}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs text-gray-400">
                        Available
                      </p>

                      <p className="mt-1 font-semibold text-[#2E7D32]">
                        {book.availableCopies ?? 0}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">
                        Total
                      </p>

                      <p className="mt-1 font-semibold text-[#212529]">
                        {book.totalCopies ?? 0}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedBook(book)}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Eye size={16} />
                      View
                    </button>

                    <button
                      onClick={() => openEditForm(book)}
                      className="flex items-center gap-2 rounded-lg bg-[#0A2540] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      <Edit size={16} />
                      Edit
                    </button>

                    <button
                      onClick={() => handleDelete(book)}
                      disabled={deleting}
                      className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h3 className="text-xl font-bold text-[#212529]">
                  {editingBook ? 'Edit Book' : 'Add Book'}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  {editingBook
                    ? 'Update the book information.'
                    : 'Add a new book to the library.'}
                </p>
              </div>

              <button
                onClick={resetForm}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Title
                </label>

                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-[#0A2540]"
                  placeholder="Book title"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Author
                </label>

                <input
                  name="author"
                  value={form.author}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-[#0A2540]"
                  placeholder="Author name"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    ISBN
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    disabled={isbnLoading}
                    className="flex items-center gap-2 rounded-lg bg-[#0A2540] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <ScanLine size={16} />
                    Scan ISBN
                  </button>
                </div>

                <input
                  name="isbn"
                  value={form.isbn}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-[#0A2540]"
                  placeholder="ISBN"
                />

                {isbnLoading && (
                  <p className="mt-2 text-sm text-gray-500">
                    Looking up book information...
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Description
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-[#0A2540]"
                  placeholder="Book description"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Cover Image URL
                </label>

                <input
                  name="coverImageUrl"
                  value={form.coverImageUrl}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-[#0A2540]"
                  placeholder="https://..."
                />

                {form.coverImageUrl && (
                  <img
                    src={form.coverImageUrl}
                    alt="Book cover preview"
                    className="mt-3 h-32 w-24 rounded-lg object-cover"
                  />
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Total Copies
                </label>

                <input
                  type="number"
                  name="totalCopies"
                  value={form.totalCopies}
                  onChange={handleChange}
                  min="1"
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-[#0A2540]"
                />

                {editingBook && (
                  <p className="mt-2 text-xs text-gray-500">
                    Borrowed copies are preserved when changing the
                    total number of copies.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-gray-200 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#0A2540] px-5 py-3 font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? 'Saving...'
                    : editingBook
                      ? 'Save Changes'
                      : 'Add Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h3 className="text-xl font-bold text-[#212529]">
                Book Details
              </h3>

              <button
                onClick={() => setSelectedBook(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="flex justify-center">
                {selectedBook.coverImageUrl ? (
                  <img
                    src={selectedBook.coverImageUrl}
                    alt={selectedBook.title}
                    className="h-56 w-40 rounded-xl object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-56 w-40 items-center justify-center rounded-xl bg-gray-100">
                    <BookOpen
                      size={40}
                      className="text-gray-400"
                    />
                  </div>
                )}
              </div>

              <h4 className="mt-6 text-2xl font-bold text-[#212529]">
                {selectedBook.title}
              </h4>

              <p className="mt-2 text-gray-500">
                {selectedBook.author}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">
                    Total Copies
                  </p>

                  <p className="mt-1 text-xl font-bold text-[#212529]">
                    {selectedBook.totalCopies ?? 0}
                  </p>
                </div>

                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-xs text-gray-500">
                    Available Copies
                  </p>

                  <p className="mt-1 text-xl font-bold text-[#2E7D32]">
                    {selectedBook.availableCopies ?? 0}
                  </p>
                </div>
              </div>

              {selectedBook.isbn && (
                <div className="mt-5">
                  <p className="text-sm font-semibold text-gray-700">
                    ISBN
                  </p>

                  <p className="mt-1 text-gray-500">
                    {selectedBook.isbn}
                  </p>
                </div>
              )}

              <div className="mt-5">
                <p className="text-sm font-semibold text-gray-700">
                  Description
                </p>

                <p className="mt-1 whitespace-pre-wrap text-gray-500">
                  {selectedBook.description ||
                    'No description available.'}
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setSelectedBook(null)
                    openEditForm(selectedBook)
                  }}
                  className="flex items-center gap-2 rounded-lg bg-[#0A2540] px-4 py-3 font-medium text-white hover:opacity-90"
                >
                  <Edit size={17} />
                  Edit Book
                </button>

                <button
                  onClick={() => handleDelete(selectedBook)}
                  disabled={deleting}
                  className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-3 font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 size={17} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <IsbnScanner
          onScan={handleIsbnScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}

export default AdminBooks