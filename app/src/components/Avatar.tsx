export function Avatar({
  initials,
  color,
  size = 52,
  label,
}: {
  initials: string
  color: string
  size?: number
  label?: string
}) {
  const font = size >= 60 ? 22 : size >= 50 ? 17 : size >= 40 ? 15 : 12
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, background: color, fontSize: font }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {initials}
    </div>
  )
}
