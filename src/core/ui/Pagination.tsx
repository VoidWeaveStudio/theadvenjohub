//src\core\ui\Pagination.tsx
"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const maxVisible = 7;

  let visiblePages = pages;
  if (totalPages > maxVisible) {
    const start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    visiblePages = pages.slice(start - 1, end);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="btn-secondary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ←
      </button>

      {visiblePages[0] > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="btn-secondary px-3 py-2"
          >
            1
          </button>
          {visiblePages[0] > 2 && <span className="text-text-secondary px-2">...</span>}
        </>
      )}

      {visiblePages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-2 rounded font-medium transition-colors ${page === currentPage
              ? "bg-primary text-white"
              : "btn-secondary"
            }`}
        >
          {page}
        </button>
      ))}

      {visiblePages[visiblePages.length - 1] < totalPages && (
        <>
          {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
            <span className="text-text-secondary px-2">...</span>
          )}
          <button
            onClick={() => onPageChange(totalPages)}
            className="btn-secondary px-3 py-2"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="btn-secondary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        →
      </button>
    </div>
  );
}