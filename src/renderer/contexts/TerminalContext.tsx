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
            return { ...state, session: action.payload }
        case 'SET_OUTPUT':
            return { ...state, output: action.payload }
        case 'ADD_OUTPUT':
            return { ...state, output: [...state.output, action.payload] }
        case 'SET_CONNECTED':
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
        mutationFn: () => window.electronAPI.openTerminal(),
        onSuccess: (session: TerminalSession) => {
            dispatch({ type: 'SET_SESSION', payload: session })
            dispatch({ type: 'SET_CONNECTED', payload: true })
        },
    })

    // Mutation for closing terminal
    const closeMutation = useMutation({
        mutationFn: () => window.electronAPI.closeTerminal(),
        onSuccess: () => {
            dispatch({ type: 'SET_SESSION', payload: undefined })
            dispatch({ type: 'SET_CONNECTED', payload: false })
            dispatch({ type: 'SET_OUTPUT', payload: [] })
        },
    })

    // Mutation for sending input
    const sendInputMutation = useMutation({
        mutationFn: (data: string) => window.electronAPI.sendTerminalInput(data),
    })

    // Set up terminal output listener
    useEffect(() => {
        const handleOutput = (data: string) => {
            dispatch({ type: 'ADD_OUTPUT', payload: data })
        }

        window.electronAPI.onTerminalOutput(handleOutput)

        return () => {
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