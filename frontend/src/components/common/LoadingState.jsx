export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand/25 border-t-brand" aria-hidden />
      {label}
    </div>
  );
}
