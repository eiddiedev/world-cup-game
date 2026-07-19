import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import HappySeedRuntimeLab from './components/HappySeedRuntimeLab'
import './styles/happySeedRuntime.css'

createRoot(document.getElementById('happyseed-runtime-root')).render(
  <StrictMode>
    <HappySeedRuntimeLab />
  </StrictMode>,
)
