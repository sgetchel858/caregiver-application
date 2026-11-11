import { Fragment, type ReactNode } from 'react'

/** Renders agent "rich" text: **bold** spans and blank-line paragraph breaks. */
export function Rich({ text }: { text: string }): ReactNode {
  const paras = text.split(/\n{2,}/)
  return paras.map((p, pi) => (
    <Fragment key={pi}>
      {pi > 0 && (
        <>
          <br />
          <br />
        </>
      )}
      {p.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
      )}
    </Fragment>
  ))
}
