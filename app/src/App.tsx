import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { HashRouter, Route, Routes, useNavigate } from 'react-router'
import { createServices } from './services'
import { ServicesProvider } from './lib/services'
import { UIProvider } from './lib/ui'
import { ThreadsProvider, clearThreads } from './state/threads'
import { DemoMenu } from './components/DemoMenu'
import { AuthGate } from './components/AuthGate'
import { demoState, SCENES, type SceneId } from './services/demo/demoState'
import { resetMockAppStore } from './services/mock/MockAppStore'
import { resetAddedMedications } from './services/mock/MockHealthApi'
import { FamilyHome } from './screens/FamilyHome'
import { MemberProfile } from './screens/MemberProfile'
import { AskThread } from './screens/AskThread'
import { PrepSheetScreen } from './screens/PrepSheetScreen'
import { NurseCardScreen } from './screens/NurseCardScreen'
import { MedicationList } from './screens/MedicationList'
import { AddMedication } from './screens/AddMedication'
import { InteractionCheckScreen } from './screens/InteractionCheckScreen'
import { InteractionResult } from './screens/InteractionResult'
import { AskCareTeam } from './screens/AskCareTeam'
import { FamilyCalendar } from './screens/FamilyCalendar'
import { VisitDetail } from './screens/VisitDetail'
import { NotFound } from './screens/NotFound'

const services = createServices()

/** Phone frame only on non-touch desktops; ?frame=1 / ?frame=0 overrides. */
function useFramed(): boolean {
  return useMemo(() => {
    const p = new URLSearchParams(window.location.search).get('frame')
    if (p === '1') return true
    if (p === '0') return false
    return navigator.maxTouchPoints === 0 && window.innerWidth >= 600
  }, [])
}

function Shell() {
  const framed = useFramed()
  const navigate = useNavigate()
  const [deviceEl, setDeviceEl] = useState<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const { epoch } = useSyncExternalStore(demoState.subscribe, demoState.get)

  const restart = useCallback(
    (scene: SceneId) => {
      clearThreads()
      resetMockAppStore()
      resetAddedMedications()
      demoState.set({ scene, epoch: demoState.get().epoch + 1, failNext: false })
      setMenuOpen(false)
      navigate(SCENES.find((s) => s.id === scene)!.startPath, { replace: true })
    },
    [navigate],
  )

  return (
    <div className={`stage ${framed ? 'stage--framed' : ''}`}>
      <div className="device" ref={setDeviceEl}>
        <AuthGate>
        <UIProvider deviceEl={deviceEl} openDemoMenu={() => setMenuOpen(true)}>
          <ThreadsProvider key={epoch}>
            <Routes key={epoch}>
              <Route path="/" element={<FamilyHome />} />
              <Route path="/m/:memberId" element={<MemberProfile />} />
              <Route path="/m/:memberId/ask" element={<AskThread />} />
              <Route path="/m/:memberId/prep/:visitId" element={<PrepSheetScreen />} />
              <Route path="/m/:memberId/nurse" element={<NurseCardScreen />} />
              <Route path="/m/:memberId/meds" element={<MedicationList />} />
              <Route path="/m/:memberId/meds/new" element={<AddMedication />} />
              <Route path="/m/:memberId/meds/check/:checkId" element={<InteractionCheckScreen />} />
              <Route path="/m/:memberId/meds/check/:checkId/result" element={<InteractionResult />} />
              <Route path="/m/:memberId/meds/check/:checkId/care-team" element={<AskCareTeam />} />
              <Route path="/calendar" element={<FamilyCalendar />} />
              <Route path="/calendar/visit/:appointmentId" element={<VisitDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ThreadsProvider>
          {menuOpen && (
            <DemoMenu
              onClose={() => setMenuOpen(false)}
              onJump={restart}
              onReset={() => restart(demoState.get().scene)}
            />
          )}
        </UIProvider>
        </AuthGate>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ServicesProvider services={services}>
      <HashRouter>
        <Shell />
      </HashRouter>
    </ServicesProvider>
  )
}
