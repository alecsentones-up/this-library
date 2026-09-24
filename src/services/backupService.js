/* eslint-disable no-unused-vars */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from '../firebase'

export const BACKUP_VERSION = 1
export const BACKUP_COLLECTIONS = [
  'books',
  'book_copies',
  'borrow_records',
  'users'
]

const BACKUP_HISTORY_KEY = 'this-library-backup-history'
const MAX_HISTORY = 10
const BATCH_SIZE = 450

function serializeValue(value) {
  if (value instanceof Timestamp) {
    return {
      __type: 'timestamp',
      seconds: value.seconds,
      nanoseconds: value.nanoseconds
    }
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue)
  }

  if (value && typeof value === 'object') {
    const result = {}

    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = serializeValue(nestedValue)
    }

    return result
  }

  return value
}

function deserializeValue(value) {
  if (Array.isArray(value)) {
    return value.map(deserializeValue)
  }

  if (value && typeof value === 'object') {
    if (value.__type === 'timestamp') {
      return new Timestamp(Number(value.seconds), Number(value.nanoseconds))
    }

    const result = {}

    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = deserializeValue(nestedValue)
    }

    return result
  }

  return value
}

function saveBackupHistory(entry) {
  const existing = getBackupHistory()
  const updated = [entry, ...existing].slice(0, MAX_HISTORY)
  localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(updated))
}

export function getBackupHistory() {
  try {
    const value = localStorage.getItem(BACKUP_HISTORY_KEY)

    if (!value) {
      return []
    }

    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error(error)
    return []
  }
}

function getTimestampFilePart(date) {
  const pad = (value) => String(value).padStart(2, '0')

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + '-' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('')
}

function createFileName(type, date) {
  return `this-library-${type}-${getTimestampFilePart(date)}.json`
}

function downloadJson(payload, fileName) {
  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: 'application/json' }
  )

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function createBackupPayload(
  collections = BACKUP_COLLECTIONS,
  type = 'manual'
) {
  const createdAt = new Date()
  const result = {}

  for (const collectionName of collections) {
    const snapshot = await getDocs(collection(db, collectionName))

    result[collectionName] = snapshot.docs.map((snapshotDoc) => ({
      id: snapshotDoc.id,
      data: serializeValue(snapshotDoc.data())
    }))
  }

  return {
    version: BACKUP_VERSION,
    type,
    createdAt: createdAt.toISOString(),
    collections: result
  }
}

export async function createAndDownloadBackup(type = 'manual') {
  const payload = await createBackupPayload(BACKUP_COLLECTIONS, type)
  const date = new Date(payload.createdAt)
  const fileName = createFileName(type, date)

  downloadJson(payload, fileName)

  const counts = {}

  for (const collectionName of BACKUP_COLLECTIONS) {
    counts[collectionName] = payload.collections[collectionName]?.length || 0
  }

  saveBackupHistory({
    id: `${date.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    createdAt: payload.createdAt,
    fileName,
    counts
  })

  return {
    payload,
    fileName,
    counts
  }
}

export function parseBackupFileText(text) {
  const payload = JSON.parse(text)

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid backup file.')
  }

  if (Number(payload.version) !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${payload.version}`)
  }

  if (!payload.collections || typeof payload.collections !== 'object') {
    throw new Error('Backup file does not contain collections.')
  }

  for (const collectionName of BACKUP_COLLECTIONS) {
    if (
      payload.collections[collectionName] !== undefined
      && !Array.isArray(payload.collections[collectionName])
    ) {
      throw new Error(`Invalid data for collection: ${collectionName}`)
    }
  }

  return payload
}

async function commitInChunks(operations) {
  for (let index = 0; index < operations.length; index += BATCH_SIZE) {
    const chunk = operations.slice(index, index + BATCH_SIZE)
    const batch = writeBatch(db)

    chunk.forEach((operation) => {
      if (operation.type === 'delete') {
        batch.delete(operation.ref)
      } else {
        batch.set(operation.ref, operation.data)
      }
    })

    await batch.commit()
  }
}

export async function restoreCollection(collectionName, entries) {
  const currentSnapshot = await getDocs(collection(db, collectionName))

  const deleteOperations = currentSnapshot.docs.map((snapshotDoc) => ({
    type: 'delete',
    ref: doc(db, collectionName, snapshotDoc.id)
  }))

  await commitInChunks(deleteOperations)

  const writeOperations = entries.map((entry) => ({
    type: 'set',
    ref: doc(db, collectionName, entry.id),
    data: deserializeValue(entry.data)
  }))

  await commitInChunks(writeOperations)

  return {
    deleted: deleteOperations.length,
    restored: writeOperations.length
  }
}

export async function restoreSelectedCollections(
  payload,
  selectedCollections
) {
  const results = {}

  for (const collectionName of selectedCollections) {
    const entries = payload.collections[collectionName]

    if (!Array.isArray(entries)) {
      results[collectionName] = {
        deleted: 0,
        restored: 0,
        skipped: true
      }
      continue
    }

    results[collectionName] = await restoreCollection(
      collectionName,
      entries
    )
  }

  return results
}
