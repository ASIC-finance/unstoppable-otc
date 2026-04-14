type Props = {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

/**
 * Content-agnostic loading placeholder. Uses a subtle animated pulse that
 * respects prefers-reduced-motion via CSS.
 */
export function Skeleton({ className = '', width, height = '1rem', rounded = 'md' }: Props) {
  const radius = {
    sm: '4px',
    md: '6px',
    lg: '10px',
    full: '999px',
  }[rounded]

  return (
    <span
      aria-hidden="true"
      className={`skeleton ${className}`.trim()}
      style={{
        display: 'inline-block',
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: radius,
      }}
    />
  )
}

export function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i}>
          <Skeleton width="80%" />
        </td>
      ))}
    </tr>
  )
}
