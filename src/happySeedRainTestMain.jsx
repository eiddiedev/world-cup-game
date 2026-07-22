import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HappySeedMatchBroadcast } from './components/HappySeedMatchBroadcast'
import './styles/happySeedBroadcastV2.css'

// 强制雨天：在组件挂载前预设天气，boot 时不会被随机覆盖
window.__happySeedWeather = 'rain'

createRoot(document.getElementById('happyseed-rain-root')).render(
  <StrictMode>
    <HappySeedMatchBroadcast />
  </StrictMode>,
)
