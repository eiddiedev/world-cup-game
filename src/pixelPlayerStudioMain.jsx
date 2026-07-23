import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PixelKitStudio from './components/PixelKitStudio.jsx'
import './styles/pixelKitStudio.css'

createRoot(document.getElementById('pixel-player-studio-root')).render(
  <StrictMode>
    <PixelKitStudio />
  </StrictMode>,
)
