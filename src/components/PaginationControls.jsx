import { ChevronLeft, ChevronRight } from 'lucide-react'

function PaginationControls({
  page,
  hasNext,
  loading,
  onPrevious,
  onNext
}) {
  return (
    <div className="mt-8 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <button
        onClick={onPrevious}
        disabled={loading || page <= 1}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={18} />
        Previous
      </button>

      <div className="text-sm font-medium text-gray-600">
        Page {page}
      </div>

      <button
        onClick={onNext}
        disabled={loading || !hasNext}
        className="inline-flex items-center gap-2 rounded-lg bg-[#0A2540] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

export default PaginationControls
