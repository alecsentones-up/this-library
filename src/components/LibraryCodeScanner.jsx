/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/purity */
import { useEffect, useRef, useState } from 'react'
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats
} from 'html5-qrcode'
import { Camera, X } from 'lucide-react'

function LibraryCodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null)
  const onScanRef = useRef(onScan)
  const elementIdRef = useRef(
    `library-code-scanner-${Math.random().toString(36).slice(2)}`
  )
  const startedRef = useRef(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    const scanner = new Html5Qrcode(elementIdRef.current)
    scannerRef.current = scanner
    let cancelled = false

    async function startScanner() {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 180 },
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.EAN_13
            ]
          },
          async (decodedText) => {
            if (!startedRef.current) {
              return
            }

            startedRef.current = false

            try {
              if (scanner.isScanning) {
                await scanner.stop()
              }
            } catch (stopError) {
              console.error(stopError)
            }

            try {
              await scanner.clear()
            } catch (clearError) {
              console.error(clearError)
            }

            onScanRef.current(decodedText)
          },
          () => {}
        )

        if (cancelled) {
          try {
            if (scanner.isScanning) {
              await scanner.stop()
            }
          } catch (stopError) {
            console.error(stopError)
          }

          return
        }

        startedRef.current = true
      } catch (scannerError) {
        console.error(scannerError)
        setError(
          'Unable to open the camera. Check the browser camera permission and use HTTPS or localhost.'
        )
      }
    }

    startScanner()

    return () => {
      cancelled = true
      startedRef.current = false

      async function stopScanner() {
        try {
          if (scanner.isScanning) {
            await scanner.stop()
          }
        } catch (stopError) {
          console.error(stopError)
        }

        try {
          await scanner.clear()
        } catch (clearError) {
          console.error(clearError)
        }
      }

      stopScanner()
      scannerRef.current = null
    }
  }, [])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-[#212529]">
          <Camera size={19} />
          Scan library code
        </div>

        <button
          onClick={onClose}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X size={18} />
        </button>
      </div>

      <div className="rounded-xl bg-black p-2">
        <div id={elementIdRef.current} />
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  )
}

export default LibraryCodeScanner
