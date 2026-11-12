import { joinNames } from '../../lib/format'

export interface EscortOption {
  id: string
  /** "Me", "Dad", "Mike" */
  label: string
  /** name in a sentence: "you", "Dad", "Mike" */
  name: string
}

/** "Who's taking Mom?": one choice, saved as soon as it is tapped. */
export function EscortPicker({
  who,
  options,
  selected,
  userId,
  pending,
  onPick,
}: {
  /** "Mom" */
  who: string
  options: EscortOption[]
  selected: string | null
  userId: string
  pending: boolean
  onPick: (id: string) => void
}) {
  const chosen = options.find((o) => o.id === selected)
  const others = options.filter((o) => o.id !== selected)
  let caption = `No one is down to take ${who} yet.`
  if (chosen) {
    const names = others.map((o) => (o.id === userId ? 'You' : o.name))
    // "You" reads best first
    names.sort((a, b) => (a === 'You' ? -1 : b === 'You' ? 1 : 0))
    caption =
      chosen.id === userId
        ? names.length
          ? `${joinNames(names)} can see you're going.`
          : "You're going."
        : `${joinNames(names)} can see ${chosen.name} is going.`
  }
  return (
    <section className="card">
      <h2 className="h2" id="escort-h">
        Who's taking {who}?
      </h2>
      <div className="cal-escort" role="group" aria-labelledby="escort-h" style={{ marginTop: 4 }}>
        {options.map((o) => (
          <button
            key={o.id}
            className="cal-escort__btn"
            aria-pressed={o.id === selected}
            disabled={pending}
            onClick={() => o.id !== selected && onPick(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <span className="small muted" role="status" style={{ marginTop: 4 }}>
        {pending ? 'Saving…' : caption}
      </span>
    </section>
  )
}
