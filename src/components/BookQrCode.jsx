import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

function BookQrCode({ accessionNo, size = 180 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !accessionNo) {
      return
    }

    QRCode.toCanvas(
      canvasRef.current,
      `BOOK:${accessionNo}`,
      {
        width: size,
        margin: 2
      }
    ).catch((error) => {
      console.error(error)
    })
  }, [accessionNo, size])

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} />
      <div className="mt-2 font-mono text-sm font-semibold">
        {accessionNo}
      </div>
    </div>
  )
}

export default BookQrCode
