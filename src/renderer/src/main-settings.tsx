import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { SettingsApp } from '@/app/SettingsApp'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import { SettingsProvider } from '@/context/SettingsContext'
import { createQueryClient } from '@/lib/queryClient'
import '@/styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Renderer root element is missing')

createRoot(container).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={createQueryClient()}>
        <SettingsProvider>
          <AuthProvider>
            <SettingsApp />
          </AuthProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>
)
