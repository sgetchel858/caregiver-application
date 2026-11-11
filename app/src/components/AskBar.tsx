import { useEffect, useId, useRef } from 'react'
import { Icon } from './Icon'
import { useUI } from '../lib/ui'

/**
 * The ask box. Shows a mic when empty and a send arrow once there's text.
 * Enter sends; Shift+Enter adds a line.
 */
export function AskBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  white = false,
  disabled = false,
  active = false,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: (v: string) => void
  placeholder: string
  label: string
  white?: boolean
  disabled?: boolean
  active?: boolean
}) {
  const id = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  const { toast } = useUI()
  const hasText = value.trim().length > 0

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [value])

  const submit = () => {
    if (hasText && !disabled) onSubmit(value.trim())
  }

  return (
    <form
      className={`askbar ${white ? 'askbar--white' : ''} ${active || hasText ? 'askbar--active' : ''}`}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
        enterKeyHint="send"
        autoComplete="off"
      />
      {hasText ? (
        <button type="submit" className="askbar__btn" aria-label="Send question" disabled={disabled}>
          <Icon name="send" size={18} strokeWidth={2.2} />
        </button>
      ) : (
        <button type="button" className="askbar__btn" aria-label="Ask by voice" onClick={() => toast("Voice isn't part of this demo yet. Type your question instead.")}>
          <Icon name="mic" size={18} />
        </button>
      )}
    </form>
  )
}
