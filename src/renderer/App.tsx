import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectionProvider } from './contexts/ConnectionContext'
import { TransferProvider } from './contexts/TransferContext'
import { TerminalProvider } from './contexts/TerminalContext'
import { DeletionProvider } from './contexts/DeletionContext'
import { WindowManagerProvider } from './contexts/WindowManagerContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { PluginProvider } from './contexts/PluginContext'
import MainLayout from './components/MainLayout'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
})

function App() {
    React.useEffect(() => {
        // Signal that the app is ready to be shown
        window.electronAPI.appReady()
    }, [])

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <ConnectionProvider>
                    <TransferProvider>
                        <TerminalProvider>
                            <DeletionProvider>
                                <WindowManagerProvider>
                                    <PluginProvider>
                                        <MainLayout />
                                    </PluginProvider>
                                </WindowManagerProvider>
                            </DeletionProvider>
                        </TerminalProvider>
                    </TransferProvider>
                </ConnectionProvider>
            </ThemeProvider>
        </QueryClientProvider>
    )
}

export default App