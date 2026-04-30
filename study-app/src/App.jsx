import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider, Outlet, useLocation } from 'react-router-dom'
import { ParticipantProvider, useParticipant } from './context/ParticipantContext'
import LandingPage from './pages/LandingPage'
import ConsentPage from './pages/ConsentPage'
import DemographicsPage from './pages/DemographicsPage'
import InstructionsPage from './pages/InstructionsPage'
import StudyPage from './pages/StudyPage'
import ThanksPage from './pages/ThanksPage'
import WithdrawnPage from './pages/WithdrawnPage'
import ErrorPage from './pages/ErrorPage'
import ResearcherPage from './pages/ResearcherPage'

function RouteProgressShell() {
  const { state } = useParticipant()
  const location = useLocation()

  useEffect(() => {
    if (!state.participantId) return

    const progressKey = `study_progress_${state.participantId}`

    if (state.status === 'completed' || state.status === 'withdrawn') {
      localStorage.removeItem(progressKey)
      return
    }

    const payload = {
      route: `${location.pathname}${location.search}`,
      stimulusIndex: state.currentStimulusIndex,
      sessionStimuli: state.sessionStimuli,
    }

    try {
      localStorage.setItem(progressKey, JSON.stringify(payload))
    } catch {
      // non-fatal localStorage quota failure
    }
  }, [
    location.pathname,
    location.search,
    state.participantId,
    state.currentStimulusIndex,
    state.sessionStimuli,
    state.status,
  ])

  return <Outlet />
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RouteProgressShell />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'consent', element: <ConsentPage /> },
      { path: 'demographics', element: <DemographicsPage /> },
      { path: 'instructions', element: <InstructionsPage /> },
      { path: 'study', element: <StudyPage /> },
      { path: 'thanks', element: <ThanksPage /> },
      { path: 'withdrawn', element: <WithdrawnPage /> },
      { path: 'error', element: <ErrorPage /> },
      { path: 'researcher', element: <ResearcherPage /> },
    ],
  },
])

export default function App() {
  return (
    <ParticipantProvider>
      <RouterProvider router={router} />
    </ParticipantProvider>
  )
}
