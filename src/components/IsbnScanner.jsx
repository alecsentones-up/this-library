import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'

function IsbnScanner({ onScan, onClose }) {
  const scannerRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let scanner

    async function startScanner() {
      try {
        scanner = new Html5Qrcode('isbn-reader')
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: {
              width: 300,
              height: 120
            }
          },
          async (decodedText) => {
            const isbn = decodedText.replace(/[^0-9Xx]/g, '')

            if (isbn.length !== 10 && isbn.length !== 13) {
              return
            }

            await stopScanner()
            onScan(isbn)
          },
          () => {}
        )
      } catch (err) {
        console.error(err)
        setError(
          'Unable to access the camera. Please allow camera access and try again.'
        )
      }
    }

    startScanner()

    return () => {
      stopScanner()
    }

    async function stopScanner() {
      if (!scannerRef.current) {
        return
      }

      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop()
        }

        await scannerRef.current.clear()
      } catch (err) {
        console.error(err)
      }

      scannerRef.current = null
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#0A2540] px-5 py-4 text-white">
          <div>
            <h2 className="font-bold">Scan ISBN</h2>
            <p className="text-xs text-white/70">
              Point the camera at the book barcode
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <div
            id="isbn-reader"
            className="overflow-hidden rounded-xl"
          />

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <p className="mt-4 text-center text-sm text-gray-500">
            Position the ISBN barcode inside the scanning area.
          </p>

          <button
            onClick={onClose}
            className="mt-5 w-full rounded-lg border border-gray-200 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default IsbnScanner