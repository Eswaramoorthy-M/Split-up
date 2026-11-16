import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { GroupProvider } from './contexts/GroupContext'
import { isSupabaseConfigured } from './lib/supabase'
import { registerPwa } from './pwa'
import { PwaPrompts } from './components/PwaPrompts'
import './index.css'

registerPwa()

const root = document.getElementById('root')!

if (!isSupabaseConfigured) {
  root.innerHTML =
    '<div style="padding:24px;font-family:sans-serif;max-width:480px;margin:0 auto">' +
    '<h2>Setup needed</h2><p>Create a <code>.env</code> file with ' +
    '<code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, ' +
    'then rebuild or restart <code>npm run dev</code>.</p></div>'
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <GroupProvider>
            <App />
            <PwaPrompts />
          </GroupProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
}
