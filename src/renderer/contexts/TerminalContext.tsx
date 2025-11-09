import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { TerminalSession } from '../types'
import { useMutation } from '@tanstack/react-query'
import '../types/electron' // Import to ensure the electronAPI types are loaded

interface TerminalState {
    session?: TerminalSession
    output: string[]
    isConnected: boolean
}

type TerminalAction =
    | { type: 'SET_SESSION'; payload: TerminalSession | undefined }
    | { type: 'SET_OUTPUT'; payload: string[] }
    | { type: 'ADD_OUTPUT'; payload: string }
    | { type: 'SET_CONNECTED'; payload: boolean }

const initialState: TerminalState = {
    output: [],
    isConnected: false,
}

function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
    switch (action.type) {
        case 'SET_SESSION':
            console.log('[TerminalReducer] SET_SESSION:', action.payload)
            return { ...state, session: action.payload }
        case 'SET_OUTPUT':
            console.log('[TerminalReducer] SET_OUTPUT:', action.payload.length, 'items')
            return { ...state, output: action.payload }
        case 'ADD_OUTPUT':
            console.log('[TerminalReducer] ADD_OUTPUT:', JSON.stringify(action.payload))
            const newOutput = [...state.output, action.payload]
            console.log('[TerminalReducer] New output array length:', newOutput.length)
            return { ...state, output: newOutput }
        case 'SET_CONNECTED':
            console.log('[TerminalReducer] SET_CONNECTED:', action.payload)
            return { ...state, isConnected: action.payload }
        default:
            return state
    }
}

const TerminalContext = createContext<{
    state: TerminalState
    dispatch: React.Dispatch<TerminalAction>
    openMutation: any
    closeMutation: any
    sendInputMutation: any
} | null>(null)

export function TerminalProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(terminalReducer, initialState)

    // Mutation for opening terminal
    const openMutation = useMutation({
        mutationFn: (connectionId: string) => window.electronAPI.openTerminal(connectionId),
        onSuccess: (session: TerminalSession) => {
            dispatch({ type: 'SET_SESSION', payload: session })
            dispatch({ type: 'SET_CONNECTED', payload: true })
        },
    })

    // Mutation for closing terminal
    const closeMutation = useMutation({
        mutationFn: (connectionId: string) => window.electronAPI.closeTerminal(connectionId),
        onSuccess: () => {
            dispatch({ type: 'SET_SESSION', payload: undefined })
            dispatch({ type: 'SET_CONNECTED', payload: false })
            dispatch({ type: 'SET_OUTPUT', payload: [] })
        },
    })

    // Mutation for sending input
    const sendInputMutation = useMutation({
        mutationFn: ({ connectionId, data }: { connectionId: string; data: string }) =>
            window.electronAPI.sendTerminalInput(connectionId, data),
    })

    // Set up terminal output listener
    useEffect(() => {
        console.log('[TerminalContext] Setting up terminal output listener')

        const handleOutput = (data: { connectionId: string; data: string }) => {
            console.log('[TerminalContext] Received output from backend:', JSON.stringify(data))
            dispatch({ type: 'ADD_OUTPUT', payload: data.data })
        }

        window.electronAPI.onTerminalOutput(handleOutput)

        return () => {
            console.log('[TerminalContext] Cleaning up terminal output listener')
            window.electronAPI.removeAllListeners('terminal-output')
        }
    }, [])

    return (
        <TerminalContext.Provider
            value={{
                state,
                dispatch,
                openMutation,
                closeMutation,
                sendInputMutation,
            }}
        >
            {children}
        </TerminalContext.Provider>
    )
}

export function useTerminal() {
    const context = useContext(TerminalContext)
    if (!context) {
        throw new Error('useTerminal must be used within a TerminalProvider')
    }
    return context
}