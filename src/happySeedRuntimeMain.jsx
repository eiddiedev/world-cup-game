import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HappySeedMatchBroadcast } from './components/HappySeedMatchBroadcast'
import './styles/happySeedBroadcastV2.css'

createRoot(document.getElementById('happyseed-runtime-root')).render(
  <StrictMode>
    <HappySeedMatchBroadcast />
  </StrictMode>,
)
