function getInitials(name?: string) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function Avatar({ name, size = 'md' }: { name?: string; size?: 'md' | 'lg' }) {
  const dimensions = size === 'lg' ? 'h-16 w-16 text-lg' : 'h-8 w-8 text-xs'

  return (
    <span
      className={`flex ${dimensions} items-center justify-center rounded-full bg-yellow font-display font-semibold text-ink`}
    >
      {getInitials(name)}
    </span>
  )
}
