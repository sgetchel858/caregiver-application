import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Header } from '../components/Header'
import { ErrorState, ScreenSkeleton } from '../components/Feedback'
import { Icon } from '../components/Icon'
import { SourceSheet } from '../components/SourceSheet'
import { Rich } from '../lib/rich'
import { useServices } from '../lib/services'
import { useAction } from '../lib/useAsync'
import { useUI } from '../lib/ui'
import { useInteractionCheck } from './InteractionCheckScreen'

/** Moment 3 · 3: the finding, in plain words, with what to ask and what to watch for. */
export function InteractionResult() {
  const { memberId = '', checkId = '' } = useParams()
  const navigate = useNavigate()
  const { check, error, retry } = useInteractionCheck(checkId)
  const [sourceOpen, setSourceOpen] = useState(false)
  const { health } = useServices()
  const { toast } = useUI()
  const add = useAction(async () => {
    if (!check?.medication) return
    const med = await health.addMedication(memberId, check.medication)
    toast(`${med.name} added to her medications`)
    navigate(`/m/${memberId}/meds`)
  })
  const canAdd = !!check?.medication

  const ready = check?.status === 'complete'
  const findings = check?.findings ?? []

  return (
    <div className="screen">
      <Header title="Interaction check" back={`/m/${memberId}/meds/check/${checkId}`} />
      <div className="scroll">
        <main className="col stack main" style={{ gap: 12, minHeight: '100%' }}>
          {!!error && !check && <ErrorState error={error} onRetry={retry} title="Couldn't load the result" />}
          {!error && !ready && <ScreenSkeleton blocks={[150, 90, 90, 80]} />}
          {ready && check && (
            <>
              {findings.length === 0 && (
                <section className="card card--16" style={{ borderLeft: '4px solid #62CB6C' }}>
                  <h1 className="h2" style={{ fontSize: 22 }}>
                    No major interactions found
                  </h1>
                  <p className="p">
                    {check.drug.label} was checked against all of her medications and allergies.
                  </p>
                </section>
              )}

              {findings.map((f) => (
                <div key={f.id} className="stack" style={{ gap: 12 }}>
                  <section
                    style={{
                      background: f.severity === 'major' ? '#FFE6DD' : '#FFFFFF',
                      border: `2px solid ${f.severity === 'major' ? '#FD6530' : '#FDD728'}`,
                      borderRadius: 12,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        alignSelf: 'flex-start',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: f.severity === 'major' ? '#FD6530' : '#FDD728',
                        color: '#2A2B39',
                        fontSize: 13,
                        fontWeight: 700,
                        borderRadius: 12,
                        padding: '4px 10px',
                      }}
                    >
                      <Icon name="alert" size={14} color="#2A2B39" strokeWidth={2.4} />
                      {f.severity === 'major' ? 'Major interaction' : 'Worth a look'}
                    </span>
                    <h1 style={{ margin: 0, fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 24, color: '#012E4D' }}>{f.title}</h1>
                    <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>{f.summary}</p>
                  </section>

                  {f.sections.map((s) => (
                    <section key={s.title} className="card">
                      <h2 className="h2">{s.title}</h2>
                      <p className="p" style={{ lineHeight: 1.5 }}>
                        <Rich text={s.text} />
                      </p>
                    </section>
                  ))}
                </div>
              ))}

              <p className="source-line">
                <Icon name="doc" size={14} color="#535458" />
                Source: {check.source.label} ·{' '}
                <button className="link-btn" onClick={() => setSourceOpen(true)}>
                  Details
                </button>
              </p>

              <div className="stack" style={{ gap: 10, marginTop: 'auto' }}>
                {!!add.error && <ErrorState error={add.error} title="Couldn't add it" onRetry={() => add.run()} />}
                {findings.length > 0 ? (
                  <>
                    <button className="btn btn--primary btn--lg" onClick={() => navigate(`/m/${memberId}/meds/check/${checkId}/care-team`)}>
                      Ask the care team about this
                    </button>
                    {canAdd && (
                      <button className="btn btn--outline btn--48" disabled={add.pending} onClick={() => add.run()}>
                        {add.pending ? 'Adding…' : 'Add to her medications anyway'}
                      </button>
                    )}
                  </>
                ) : canAdd ? (
                  <button className="btn btn--primary btn--lg" disabled={add.pending} onClick={() => add.run()}>
                    {add.pending ? 'Adding…' : `Add ${check.drug.name.toLowerCase()} to her medications`}
                  </button>
                ) : (
                  <button className="btn btn--primary btn--lg" onClick={() => navigate(`/m/${memberId}/meds`)}>
                    Back to her medications
                  </button>
                )}
                <p className="small muted" style={{ margin: 0, textAlign: 'center', lineHeight: 1.45 }}>
                  {check.disclaimer}
                </p>
              </div>
              {sourceOpen && <SourceSheet memberId={memberId} source={check.source} onClose={() => setSourceOpen(false)} />}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
