/** Lightweight in-app loading shell shown while a lazy route chunk resolves. */
export function PageFallback() {
  return (
    <section className="workspace-header" aria-live="polite" aria-busy="true">
      <div>
        <p className="eyebrow">Loading</p>
        <h1 className="workspace-title">Preparing workspace…</h1>
        <p className="workspace-copy">Fetching bundle and wallet context.</p>
      </div>
    </section>
  )
}
