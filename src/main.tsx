import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './StockDashboard.css'

// The shared cross-app nav: Home / Stocks / Budget / Catan.
//
// Loaded here rather than inside a component because it is plain DOM that injects itself
// into <body>, and because the app routes that need it - /stocks and /mydesk - render
// outside the portfolio's own navbar, so without this they are a dead end with no way
// back to the rest of the site.
//
// Its config (inline, hideOn) is set by a classic script in index.html, NOT here: module
// imports are evaluated before this module's body, so assigning window.PC_NAV on the line
// above the import would run too late and nav.js would render on every page.
import './nav.js'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
