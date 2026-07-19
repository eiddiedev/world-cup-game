import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import HappySeedDecisionReview from './components/HappySeedDecisionReview.jsx'
import './styles/happySeedDecisionReview.css'

createRoot(document.getElementById('happyseed-decision-review-root')).render(
  <StrictMode>
    <HappySeedDecisionReview />
  </StrictMode>,
)
