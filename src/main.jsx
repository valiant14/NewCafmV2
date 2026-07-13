import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AppProviders from './providers/AppProviders'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
)
