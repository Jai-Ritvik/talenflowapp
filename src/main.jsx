// src/main.jsx (or main.tsx)
import React from 'react'
import ReactDOM from 'react-dom/client'
// Import the main component
import TalentFlowApp from './TalentFlowApp.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <TalentFlowApp />
    </React.StrictMode>,
)