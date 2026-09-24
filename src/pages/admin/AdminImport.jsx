import { useState } from 'react'
import {
  CheckCircle,
  FileSpreadsheet,
  Upload,
  XCircle
} from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from '../../firebase'

const expectedSheetName = 'Elem accession record'

const columnMap = {
  'Acc. no.': 'accessionNo',
  'Date': 'accessionDate',
  'call no.': 'callNo',
  'Author': 'author',
  'Editor / Illustrator / et.al.': 'editors',
  'Title': 'title',
  'vol.': 'volume',
  'edition': 'edition',
  'Source': 'source',
  'Series': 'series',
  'Place of publication': 'placeOfPublication',
  'Publisher': 'publisher',
  'Copyright': 'copyright',
  'ISBN': 'isbn',
  'Illustration / page / cm': 'illustrationPageCm',
  'Notes': 'notes',
  'Description': 'description'
}

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function cleanValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return ''
  }

  return String(value).trim()
}

function createCatalogKey(book) {
  const isbn = normalize(book.isbn)
  const title = normalize(book.title)
  const author = normalize(book.author)
  const callNo = normalize(book.callNo)

  if (isbn) {
    return `isbn:${isbn}`
  }

  return `title:${title}|author:${author}|call:${callNo}`
}

function parseExcelDate(value) {
  if (!value) {
    return ''
  }

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)

    if (!date) {
      return ''
    }

    return [
      date.y,
      String(date.m).padStart(2, '0'),
      String(date.d).padStart(2, '0')
    ].join('-')
  }

  return cleanValue(value)
}

function convertRow(row) {
  const book = {}

  Object.entries(columnMap).forEach(
    ([excelColumn, field]) => {
      const value = row[excelColumn]

      if (field === 'accessionDate') {
        book[field] = parseExcelDate(value)
      } else {
        book[field] = cleanValue(value)
      }
    }
  )

  return book
}

function AdminImport() {

  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function handleFileChange(event) {
    const selectedFile =
      event.target.files?.[0]

    setResult(null)
    setError('')

    if (!selectedFile) {
      setFile(null)
      return
    }

    const extension =
      selectedFile.name
        .split('.')
        .pop()
        ?.toLowerCase()

    if (extension !== 'xlsx') {
      setError(
        'Please select an XLSX file.'
      )
      setFile(null)
      return
    }

    setFile(selectedFile)
  }

  async function handleImport() {
    if (!file || loading) {
      return
    }

    setLoading(true)
    setResult(null)
    setError('')

    try {
      const buffer =
        await file.arrayBuffer()

      const workbook =
        XLSX.read(buffer, {
          type: 'array'
        })

      if (
        !workbook.SheetNames.includes(
          expectedSheetName
        )
      ) {
        throw new Error(
          `The workbook must contain a sheet named "${expectedSheetName}".`
        )
      }

      const worksheet =
        workbook.Sheets[
          expectedSheetName
        ]

      const rows =
        XLSX.utils.sheet_to_json(
          worksheet,
          {
            defval: ''
          }
        )

      if (rows.length === 0) {
        throw new Error(
          'The selected sheet does not contain any data.'
        )
      }

      const convertedRows =
        rows
          .map(convertRow)
          .filter(
            (row) => row.accessionNo
          )

      if (convertedRows.length === 0) {
        throw new Error(
          'No accession numbers were found in the sheet.'
        )
      }

      const [
        booksSnapshot,
        copiesSnapshot
      ] = await Promise.all([
        getDocs(collection(db, 'books')),
        getDocs(collection(db, 'book_copies'))
      ])

      const existingBooks = new Map()

      booksSnapshot.docs.forEach(
        (bookDoc) => {
          const data = bookDoc.data()

          if (data.catalogKey) {
            existingBooks.set(
              data.catalogKey,
              {
                id: bookDoc.id,
                ...data
              }
            )
          }
        }
      )

      const existingCopies =
        new Set(
          copiesSnapshot.docs.map(
            (copyDoc) => copyDoc.id
          )
        )

      const groupedBooks = new Map()

      convertedRows.forEach((row) => {
        const catalogKey =
          createCatalogKey(row)

        if (!groupedBooks.has(catalogKey)) {
          groupedBooks.set(
            catalogKey,
            {
              catalogKey,
              sourceBook: row,
              copies: []
            }
          )
        }

        groupedBooks
          .get(catalogKey)
          .copies.push(row)
      })

      const bookIds = new Map()
      const newCopiesByBook =
        new Map()

      groupedBooks.forEach(
        (group, catalogKey) => {
          const existing =
            existingBooks.get(
              catalogKey
            )

          const bookId =
            existing?.id ||
            doc(collection(db, 'books')).id

          bookIds.set(
            catalogKey,
            bookId
          )

          const newCopies =
            group.copies.filter(
              (copy) =>
                !existingCopies.has(
                  copy.accessionNo
                )
            )

          newCopiesByBook.set(
            catalogKey,
            newCopies
          )
        }
      )

      const operations = []

      groupedBooks.forEach(
        (group, catalogKey) => {
          const existing =
            existingBooks.get(
              catalogKey
            )

          const bookId =
            bookIds.get(catalogKey)

          const newCopies =
            newCopiesByBook.get(
              catalogKey
            ) || []

          const source =
            group.sourceBook

          const previousTotal =
            Number(
              existing?.totalCopies || 0
            )

          const previousAvailable =
            Number(
              existing?.availableCopies ||
                0
            )

          const totalCopies =
            previousTotal +
            newCopies.length

          const availableCopies =
            previousAvailable +
            newCopies.length

          const bookData = {
            title: source.title,
            author: source.author,
            editors: source.editors,
            callNo: source.callNo,
            volume: source.volume,
            edition: source.edition,
            source: source.source,
            series: source.series,
            placeOfPublication:
              source.placeOfPublication,
            publisher: source.publisher,
            copyright: source.copyright,
            isbn: source.isbn,
            illustrationPageCm:
              source.illustrationPageCm,
            notes: source.notes,
            description:
              existing?.description ||
              source.description,
            coverImageUrl:
              existing?.coverImageUrl ||
              '',
            catalogKey,
            totalCopies,
            availableCopies,
            status:
              availableCopies > 0
                ? 'Available'
                : 'Out of Stock',
            updatedAt:
              serverTimestamp()
          }

          if (!existing) {
            bookData.createdAt =
              serverTimestamp()
          }

          operations.push({
            type: 'book',
            id: bookId,
            data: bookData
          })

          newCopies.forEach(
            (copy) => {
              operations.push({
                type: 'copy',
                id: copy.accessionNo,
                data: {
                  accessionNo:
                    copy.accessionNo,
                  bookId,
                  barcodeValue:
                    `BOOK:${copy.accessionNo}`,
                  accessionDate:
                    copy.accessionDate,
                  status: 'Available',
                  notes: copy.notes,
                  createdAt:
                    serverTimestamp()
                }
              })
            }
          )
        }
      )

      let batch = writeBatch(db)
      let operationCount = 0
      let batchesCommitted = 0

      for (const operation of operations) {
        if (operationCount >= 450) {
          await batch.commit()

          batchesCommitted += 1
          batch = writeBatch(db)
          operationCount = 0
        }

        if (operation.type === 'book') {
          batch.set(
            doc(
              db,
              'books',
              operation.id
            ),
            operation.data,
            { merge: true }
          )
        } else {
          batch.set(
            doc(
              db,
              'book_copies',
              operation.id
            ),
            operation.data,
            { merge: true }
          )
        }

        operationCount += 1
      }

      if (operationCount > 0) {
        await batch.commit()
        batchesCommitted += 1
      }

      const importedCopies =
        convertedRows.filter(
          (row) =>
            !existingCopies.has(
              row.accessionNo
            )
        ).length

      const skippedCopies =
        convertedRows.length -
        importedCopies

      setResult({
        rows: convertedRows.length,
        importedCopies,
        skippedCopies,
        books: groupedBooks.size,
        batches: batchesCommitted
      })

      setFile(null)
    } catch (error) {
      console.error(error)

      setError(
        error.message ||
          'Unable to import the XLSX file.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-[#212529]">
              Import Library Accession Records
            </h1>

            <p className="mt-2 text-gray-600">
              Upload the XLSX workbook containing
              the <strong>Elem accession record</strong>
              sheet.
            </p>
          </div>

          <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-5">
            <h2 className="font-semibold text-[#0A2540]">
              Import rules
            </h2>

            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>
                • Only the sheet named
                <strong>
                  {' '}Elem accession record
                </strong>
                {' '}is imported.
              </li>

              <li>
                • Empty fields are allowed.
              </li>

              <li>
                • Empty fields can be completed later
                by the librarian.
              </li>

              <li>
                • Accession numbers identify physical
                copies.
              </li>

              <li>
                • Existing accession numbers are not
                duplicated.
              </li>
            </ul>
          </div>

          <div className="mt-8 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <Upload
              size={42}
              className="mx-auto text-gray-400"
            />

            <h2 className="mt-4 font-semibold text-[#212529]">
              Select XLSX file
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Example:
              <br />
              Copy of THIS ACCESSION DEC14,2024.xlsx
            </p>

            <label className="mt-5 inline-flex cursor-pointer items-center rounded-lg bg-[#0A2540] px-5 py-3 font-medium text-white hover:opacity-90">
              Choose XLSX File

              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {file && (
              <div className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-700">
                <FileSpreadsheet
                  size={18}
                />
                {file.name}
              </div>
            )}
          </div>

          {error && (
            <div className="mt-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <XCircle
                size={20}
                className="shrink-0"
              />
              {error}
            </div>
          )}

          {result && (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-center gap-2 font-semibold text-green-800">
                <CheckCircle size={20} />
                Import completed
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-2xl font-bold text-green-800">
                    {result.rows}
                  </div>
                  <div className="text-xs text-gray-600">
                    Rows processed
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-bold text-green-800">
                    {result.importedCopies}
                  </div>
                  <div className="text-xs text-gray-600">
                    New copies
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-bold text-green-800">
                    {result.skippedCopies}
                  </div>
                  <div className="text-xs text-gray-600">
                    Existing copies
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-bold text-green-800">
                    {result.books}
                  </div>
                  <div className="text-xs text-gray-600">
                    Titles grouped
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="mt-8 w-full rounded-lg bg-[#2E7D32] px-5 py-3 font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading
              ? 'Importing...'
              : 'Import Accession Records'}
          </button>
        </div>
      </main>
    </div>
  )
}

export default AdminImport