import { useNavigate, useParams } from 'react-router'
import { Header } from '../components/Header'
import { Async } from '../components/Feedback'
import { useServices } from '../lib/services'
import { useAsync } from '../lib/useAsync'
import { monthDay } from '../lib/format'

/** Not one of the 12 designs: a plain list that leads into Moment 3. */
export function MedicationList() {
  const { memberId = '' } = useParams()
  const { health, store } = useServices()
  const navigate = useNavigate()

  const state = useAsync(async () => {
    const [meds, team, family] = await Promise.all([health.getMedications(memberId), health.getCareTeam(memberId), store.getFamily()])
    return { meds, team, member: family.members.find((m) => m.healthMemberId === memberId) }
  }, [memberId])

  const relation = state.status === 'success' ? (state.data.member?.relation ?? '') : ''

  return (
    <div className="screen">
      <Header title={relation ? `${relation}'s medications` : 'Medications'} back={`/m/${memberId}`} contextFor={memberId} />
      <div className="scroll">
        <main className="col stack main">
          <Async state={state} errorTitle="Couldn't load medications">
            {({ meds, team }) => (
              <>
                <section className="card" style={{ padding: '4px 16px' }} aria-label="Current medications">
                  {meds.map((m, i) => {
                    const doc = team.find((c) => c.id === m.prescriberId)
                    return (
                      <div key={m.id} className="stack" style={{ gap: 2, padding: '14px 0', borderTop: i ? '1px solid #EDEDED' : 0 }}>
                        <span style={{ fontSize: 16 }}>
                          <strong>{m.name}</strong> {m.strength} · {m.schedule}
                        </span>
                        <span className="small muted">
                          {doc ? (doc.role === 'GP' ? doc.name : `${doc.name}, ${doc.role.toLowerCase()}`) : ''} · {m.purpose}
                          {m.lastRefill ? ` · refilled ${monthDay(m.lastRefill.date)}` : ''}
                        </span>
                      </div>
                    )
                  })}
                </section>
                <p className="small muted" style={{ margin: 0 }}>
                  From her medical records in MyChart.
                </p>
                <button className="btn btn--primary btn--lg" onClick={() => navigate(`/m/${memberId}/meds/new`)}>
                  + Add a new medication
                </button>
              </>
            )}
          </Async>
        </main>
      </div>
    </div>
  )
}
