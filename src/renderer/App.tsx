import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectionProvider } from './contexts/ConnectionContext'
import { TransferProvider } from './contexts/TransferContext'
import { TerminalProvider } from './contexts/TerminalContext'
import { DeletionProvider } from './contexts/DeletionContext'
import { WindowManagerProvider } from './contexts/WindowManagerContext'
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
    return (
        <QueryClientProvider client={queryClient}>
            <ConnectionProvider>
                <TransferProvider>
                    <TerminalProvider>
                        <DeletionProvider>
                            <WindowManagerProvider>
                                <MainLayout />
                            </WindowManagerProvider>
                        </DeletionProvider>
                    </TerminalProvider>
                </TransferProvider>
            </ConnectionProvider>
        </QueryClientProvider>
    )
}

export default App