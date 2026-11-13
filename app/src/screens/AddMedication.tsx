import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Header } from '../components/Header'
import { Async, ErrorState, Skeleton } from '../components/Feedback'
import { AgentInline } from '../components/Agent'
import { Icon } from '../components/Icon'
import { useServices } from '../lib/services'
import { useAsync, useAction } from '../lib/useAsync'
import { useUI } from '../lib/ui'
import type { DrugMatch, NewMedication } from '../services/types'

const EMPTY: NewMedication = { name: '', frequency: '', prescribedBy: '', reason: '' }

/** Moment 3 · 1: add a new prescription (pre-filled from the ER order when there is one). */
export function AddMedication() {
  const { memberId = '' } = useParams()
  const { health, store } = useServices()
  const { toast } = useUI()
  const navigate = useNavigate()
  const [form, setForm] = useState<NewMedication | null>(null)
  const [match, setMatch] = useState<DrugMatch | null | undefined>(undefined)

  const state = useAsync(async () => {
    const [family, meds, encounter] = await Promise.all([
      store.getFamily(),
      health.getMedications(memberId),
      health.getCurrentEncounter(memberId),
    ])
    return { member: family.members.find((m) => m.healthMemberId === memberId), meds, encounter }
  }, [memberId])

  // start from the encounter's newest order, if there is one
  const values: NewMedication =
    form ?? (state.status === 'success' ? { ...EMPTY, ...state.data.encounter?.newOrders[0] } : EMPTY)

  // look the name up in the drug list as the user types
  useEffect(() => {
    if (!values.name.trim()) {
      setMatch(undefined)
      return
    }
    let live = true
    const t = window.setTimeout(() => {
      health.lookupDrug(values.name).then(
        (m) => live && setMatch(m),
        () => live && setMatch(undefined),
      )
    }, 300)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [values.name, health])

  const start = useAction(async () => {
    const check = await health.startInteractionCheck(memberId, values)
    navigate(`/m/${memberId}/meds/check/${check.id}`, { state: { check } })
  })

  const set = (k: keyof NewMedication) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...values, [k]: e.target.value })
  const relation = state.status === 'success' ? (state.data.member?.relation ?? 'them') : ''

  return (
    <div className="screen">
      <Header close back={`/m/${memberId}`} title={relation ? `New medication for ${relation}` : 'New medication'} contextFor={memberId} />
      <div className="scroll">
        <main className="col stack main" style={{ paddingTop: 20, gap: 16, minHeight: '100%' }}>
          <Async
            state={state}
            errorTitle="Couldn't open the form"
            skeleton={
              <div className="stack" style={{ gap: 16 }} role="status" aria-label="Loading">
                <div className="grid-2">
                  <Skeleton h={88} />
                  <Skeleton h={88} />
                </div>
                <Skeleton h={340} />
              </div>
            }
          >
            {({ meds }) => (
              <>
                <div className="grid-2" role="group" aria-label="How to add it">
                  <button
                    className="tile"
                    style={{ border: '1.5px solid #E4E4E4', minHeight: 88 }}
                    onClick={() => toast("Scanning isn't part of this demo. The ER order is already filled in below.")}
                  >
                    <Icon name="camera" color="#0C4668" strokeWidth={1.8} />
                    <span className="tile__title" style={{ fontSize: 15 }}>
                      Scan the order or label
                    </span>
                  </button>
                  <button className="tile" style={{ border: '2px solid #23B5AF', minHeight: 88 }} aria-pressed="true">
                    <Icon name="type" color="#0C4668" strokeWidth={1.8} />
                    <span className="tile__title" style={{ fontSize: 15 }}>
                      Type the name
                    </span>
                  </button>
                </div>

                <form
                  id="med-form"
                  className="card card--16"
                  style={{ gap: 14 }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (values.name.trim()) start.run()
                  }}
                >
                  <div className="field">
                    <label className="field__label" htmlFor="med-name">
                      Medication
                    </label>
                    <input id="med-name" className={`input ${match ? 'input--active' : ''}`} value={values.name} onChange={set('name')} autoComplete="off" aria-describedby="med-match" />
                    <span id="med-match" className="small muted" aria-live="polite">
                      {match
                        ? `${match.name}${match.drugClass ? ` · ${match.drugClass}` : ''} · matched in RxNorm`
                        : match === null
                          ? 'Not found in RxNorm. Check the spelling.'
                          : ' '}
                    </span>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="med-how">
                      How often
                    </label>
                    <input id="med-how" className="input" value={values.frequency} onChange={set('frequency')} />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="med-who">
                      Prescribed by
                    </label>
                    <input id="med-who" className="input" value={values.prescribedBy} onChange={set('prescribedBy')} />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="med-why">
                      What it's for (optional)
                    </label>
                    <input id="med-why" className="input" value={values.reason ?? ''} onChange={set('reason')} />
                  </div>
                </form>

                <AgentInline>
                  I'll check it against all {meds.length} of {relation}'s medications before you add it.
                </AgentInline>

                {!!start.error && <ErrorState error={start.error} title="Couldn't start the check" onRetry={() => start.run()} />}

                <button
                  type="submit"
                  form="med-form"
                  className="btn btn--primary btn--lg"
                  style={{ marginTop: 'auto' }}
                  disabled={!values.name.trim() || start.pending}
                >
                  {start.pending ? 'Starting the check…' : `Check against ${relation}'s meds`}
                </button>
              </>
            )}
          </Async>
        </main>
      </div>
    </div>
  )
}
