import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './landing/landing.css'

// The diorama owns GPU resources and an audio graph; mounting it twice in
// development (React StrictMode) would churn both. A single mount is deliberate.
createRoot(document.getElementById('root')!).render(<App />)
