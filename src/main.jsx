import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initTermlyCookieBanner } from './lib/termly'

initTermlyCookieBanner()

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
