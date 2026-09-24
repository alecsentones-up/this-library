import {
  collection,
  endAt,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  startAt
} from 'firebase/firestore'
import { db } from '../firebase'

export const ADMIN_BOOKS_PAGE_SIZE = 20
export const BOOKS_PAGE_SIZE = 20
export const PUBLIC_BOOKS_PAGE_SIZE = 12

function mapSnapshot(snapshot) {
  return snapshot.docs.map((snapshotDoc) => ({
    id: snapshotDoc.id,
    ...snapshotDoc.data()
  }))
}

export async function getBooksPage({
  cursor = null,
  pageSize = BOOKS_PAGE_SIZE
} = {}) {
  const constraints = [orderBy('title')]

  if (cursor) {
    constraints.push(startAfter(cursor))
  }

  constraints.push(limit(pageSize + 1))

  const snapshot = await getDocs(
    query(collection(db, 'books'), ...constraints)
  )

  const hasNext = snapshot.docs.length > pageSize
  const visibleDocs = snapshot.docs.slice(0, pageSize)

  return {
    books: visibleDocs.map((snapshotDoc) => ({
      id: snapshotDoc.id,
      ...snapshotDoc.data()
    })),
    lastDoc: visibleDocs[visibleDocs.length - 1] || null,
    hasNext
  }
}

function getSearchVariants(value) {
  const trimmed = value.trim()

  if (!trimmed) {
    return []
  }

  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return [...new Set([trimmed, capitalized])]
}

async function searchField(field, value, pageSize) {
  const snapshot = await getDocs(
    query(
      collection(db, 'books'),
      orderBy(field),
      startAt(value),
      endAt(`${value}\uf8ff`),
      limit(pageSize)
    )
  )

  return mapSnapshot(snapshot)
}

export async function searchBooks({
  search,
  pageSize = PUBLIC_BOOKS_PAGE_SIZE
}) {
  const variants = getSearchVariants(search)

  if (variants.length === 0) {
    return []
  }

  const fields = ['title', 'author', 'isbn']
  const results = await Promise.all(
    fields.flatMap((field) =>
      variants.map((variant) => searchField(field, variant, pageSize))
    )
  )

  const unique = new Map()

  results.flat().forEach((book) => {
    unique.set(book.id, book)
  })

  return [...unique.values()]
    .sort((a, b) =>
      String(a.title || '').localeCompare(
        String(b.title || ''),
        undefined,
        { sensitivity: 'base' }
      )
    )
    .slice(0, pageSize * 2)
}
