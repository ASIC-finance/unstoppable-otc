import { useState, useCallback } from 'react'

/**
 * Inline icon-button that copies a value to the clipboard and flashes a
 * "Copied" confirmation for ~1.5s. Uses the async Clipboard API.
 */
export function CopyButton({
  value,
  label = 'Copy to clipboard',
  className = '',
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API unavailable or rejected — silently ignore; not worth a toast.
    }
  }, [value])

  return (
    <button
      type="button"
      onClick={copy}
      className={`copy-button ${className}`.trim()}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      data-copied={copied || undefined}
    >
      {copied ? '\u2713' : '\u2398'}
    </button>
  )
}
