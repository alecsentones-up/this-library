import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileArchive,
  History,
  RotateCcw,
  Upload,
  Users
} from 'lucide-react'
import {
  BACKUP_COLLECTIONS,
  createAndDownloadBackup,
  getBackupHistory,
  parseBackupFileText,
  restoreSelectedCollections
} from '../../services/backupService'

const collectionLabels = {
  books: 'Books',
  book_copies: 'Book Copies',
  borrow_records: 'Borrow Records',
  users: 'Users'
}

function formatDate(value) {
  if (!value) {
    return 'Unknown date'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return date.toLocaleString()
}

function countCollections(collections = {}) {
  return BACKUP_COLLECTIONS.reduce((total, collectionName) => {
    return total + Number(collections[collectionName]?.length || 0)
  }, 0)
}

function AdminBackupMigration() {
  const [history, setHistory] = useState(() => getBackupHistory())
  const [backup, setBackup] = useState(null)
  const [selectedCollections, setSelectedCollections] = useState(
    Object.fromEntries(BACKUP_COLLECTIONS.map((name) => [name, true]))
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')


  const selectedNames = useMemo(
    () => BACKUP_COLLECTIONS.filter((name) => selectedCollections[name]),
    [selectedCollections]
  )

  function refreshHistory() {
    setHistory(getBackupHistory())
  }

  async function handleCreateBackup(type = 'manual') {
    setBusy(true)
    setMessage('')
    setError('')

    try {
      const result = await createAndDownloadBackup(type)
      refreshHistory()

      setMessage(
        `Backup created successfully. ${countCollections(result.payload.collections)} documents were included.`
      )
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to create backup.')
    } finally {
      setBusy(false)
    }
  }

  async function handleBackupFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setBusy(true)
    setMessage('')
    setError('')

    try {
      const text = await file.text()
      const parsed = parseBackupFileText(text)
      setBackup(parsed)
      setMessage('Backup file loaded. Review the collections before restoring.')
    } catch (err) {
      console.error(err)
      setBackup(null)
      setError(err.message || 'Unable to read backup file.')
    } finally {
      setBusy(false)
    }
  }

  function toggleCollection(collectionName) {
    setSelectedCollections((current) => ({
      ...current,
      [collectionName]: !current[collectionName]
    }))
  }

  async function handleRestore() {
    if (!backup) {
      setError('Please select a backup file first.')
      return
    }

    if (selectedNames.length === 0) {
      setError('Select at least one collection to restore.')
      return
    }

    const confirmed = window.confirm(
      `Restore ${selectedNames.map((name) => collectionLabels[name]).join(', ')}? Current data in those collections will be removed and replaced by the backup. A safety backup will be downloaded first.`
    )

    if (!confirmed) {
      return
    }

    setBusy(true)
    setMessage('')
    setError('')

    try {
      await createAndDownloadBackup('safety-before-restore')
      const results = await restoreSelectedCollections(
        backup,
        selectedNames
      )
      refreshHistory()

      const restoredTotal = selectedNames.reduce(
        (total, name) => total + Number(results[name]?.restored || 0),
        0
      )

      setMessage(
        `Restore completed. ${restoredTotal} documents were restored.`
      )
    } catch (err) {
      console.error(err)
      setError(
        err.message || 'Restore failed. Use the safety backup to recover the previous data.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-[#2E7D32]">
                Administration
              </p>
              <h1 className="mt-1 text-3xl font-bold text-[#212529]">
                Backup & Migration
              </h1>
              <p className="mt-2 text-gray-600">
                Back up and restore This Library data directly from the browser.
              </p>
            </div>

            <button
              onClick={() => handleCreateBackup('manual')}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A2540] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={18} />
              {busy ? 'Working...' : 'Create Backup'}
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {message && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
            <div>{message}</div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-3 text-[#0A2540]">
                <FileArchive size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#212529]">
                  Create Backup
                </h2>
                <p className="text-sm text-gray-500">
                  Downloads a JSON backup file to this device.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {BACKUP_COLLECTIONS.map((collectionName) => (
                <div
                  key={collectionName}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <div className="font-semibold text-[#212529]">
                    {collectionLabels[collectionName]}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    Included in backup
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              Firebase Authentication accounts and passwords are not included.
              The Users collection is backed up, so users can register again later
              and recover their profile data through the application's registration flow.
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-3 text-[#2E7D32]">
                <Upload size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#212529]">
                  Restore Backup
                </h2>
                <p className="text-sm text-gray-500">
                  Replace selected collections using a backup file.
                </p>
              </div>
            </div>

            <label className="mt-6 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm font-semibold text-[#0A2540] transition hover:border-[#0A2540] hover:bg-gray-100">
              <Upload size={18} />
              Select Backup JSON
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleBackupFile}
                className="hidden"
              />
            </label>

            {backup && (
              <div className="mt-5 rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-500">Backup date</div>
                <div className="mt-1 font-semibold text-[#212529]">
                  {formatDate(backup.createdAt)}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {BACKUP_COLLECTIONS.map((collectionName) => {
                    const count = backup.collections[collectionName]?.length || 0

                    return (
                      <label
                        key={collectionName}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-3 py-3"
                      >
                        <span>
                          <span className="block font-medium text-[#212529]">
                            {collectionLabels[collectionName]}
                          </span>
                          <span className="text-xs text-gray-500">
                            {count.toLocaleString()} documents
                          </span>
                        </span>

                        <input
                          type="checkbox"
                          checked={Boolean(selectedCollections[collectionName])}
                          onChange={() => toggleCollection(collectionName)}
                          className="h-4 w-4"
                        />
                      </label>
                    )
                  })}
                </div>

                <button
                  onClick={handleRestore}
                  disabled={busy}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2E7D32] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw size={18} />
                  Restore Selected Collections
                </button>
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-100 p-3 text-[#0A2540]">
              <History size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#212529]">
                Backup History
              </h2>
              <p className="text-sm text-gray-500">
                History is stored locally in this browser. The actual backup files are downloaded to your device.
              </p>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">
              No backup history yet.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">File</th>
                    <th className="px-4 py-3 font-medium">Books</th>
                    <th className="px-4 py-3 font-medium">Copies</th>
                    <th className="px-4 py-3 font-medium">Users</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100">
                      <td className="px-4 py-4 whitespace-nowrap text-[#212529]">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                          {entry.type}
                        </span>
                      </td>
                      <td className="max-w-xs truncate px-4 py-4 font-mono text-xs text-gray-500">
                        {entry.fileName}
                      </td>
                      <td className="px-4 py-4">
                        {(entry.counts?.books || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        {(entry.counts?.book_copies || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        {(entry.counts?.users || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <Users size={21} className="mt-0.5 shrink-0 text-[#0A2540]" />
            <div className="text-sm text-blue-950">
              <div className="font-semibold">What is restored?</div>
              <div className="mt-1 leading-6">
                Books, physical book copies, borrowing records, and Firestore user profiles can be restored. Firebase Authentication accounts are separate, so users will need to register again when their old Auth account is no longer available.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default AdminBackupMigration
