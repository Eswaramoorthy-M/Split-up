/** Loading placeholder that mirrors the final report layout. */
export function ReportSkeleton() {
  return (
    <div className="report-layout report-skeleton" aria-hidden="true" aria-busy="true">
      <div className="report-header-skeleton">
        <span className="skeleton-line skeleton-title" />
        <span className="skeleton-line skeleton-select" />
      </div>
      <div className="report-card skeleton-hero">
        <span className="skeleton-line skeleton-label" />
        <span className="skeleton-line skeleton-amount" />
        <span className="skeleton-line skeleton-meta" />
      </div>
      <div className="report-card skeleton-card">
        <span className="skeleton-line skeleton-heading" />
        <span className="skeleton-line" />
        <span className="skeleton-line" />
        <span className="skeleton-line" />
      </div>
      <div className="report-card skeleton-card">
        <span className="skeleton-line skeleton-heading" />
        <span className="skeleton-line" />
        <span className="skeleton-line" />
      </div>
    </div>
  )
}
