import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import GothicLockPicker from './GothicLockPicker'

export default function App() {
  return (
    <>
      <GothicLockPicker />
      <SpeedInsights />
      <Analytics />
    </>
  )
}