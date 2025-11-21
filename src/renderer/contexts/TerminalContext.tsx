import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { TerminalSession } from '../types'
import { useMutation } from '@tanstack/react-query'
import '../types/electron' // Import to ensure the electronAPI types are loaded

interface TerminalSessionState {
    session?: TerminalSession
    output: string[]
    isConnected: boolean
    error?: string
}

interface TerminalState {
    sessions: Record<string, TerminalSessionState>
    maxOutputLines: number // Maximum number of output lines to keep in memory
}

type TerminalAction =
    | { type: 'SET_SESSION'; payload: { connectionId: string; session: TerminalSession | undefined } }
    | { type: 'SET_OUTPUT'; payload: { connectionId: string; output: string[] } }
    | { type: 'ADD_OUTPUT'; payload: { connectionId: string; data: string } }
    | { type: 'SET_CONNECTED'; payload: { connectionId: string; connected: boolean } }
    | { type: 'SET_ERROR'; payload: { connectionId: string; error: string | undefined } }
    | { type: 'INIT_SESSION'; payload: { connectionId: string } }

const initialState: TerminalState = {
    sessions: {},
    maxOutputLines: 1000,
}

const initialSessionState: TerminalSessionState = {
    output: [],
    isConnected: false,
}

function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
    const connectionId = action.payload.connectionId
    const currentSessionState = state.sessions[connectionId] || initialSessionState

    switch (action.type) {
        case 'INIT_SESSION':
            return {
                ...state,
                sessions: {
                    ...state.sessions,
                    [connectionId]: { ...initialSessionState }
                }
            }
        case 'SET_SESSION':
            console.log('[TerminalReducer] SET_SESSION:', action.payload)
            return {
                ...state,
                sessions: {
                    ...state.sessions,
                    [connectionId]: {
                        ...currentSessionState,
                        session: action.payload.session
                    }
                }
            }
        case 'SET_OUTPUT':
            console.log('[TerminalReducer] SET_OUTPUT:', action.payload.output.length, 'items')
            const trimmedOutput = action.payload.output.length > state.maxOutputLines
                ? action.payload.output.slice(-state.maxOutputLines)
                : action.payload.output
            return {
                ...state,
                sessions: {
                    ...state.sessions,
                    [connectionId]: {
                        ...currentSessionState,
                        output: trimmedOutput
                    }
                }
            }
        case 'ADD_OUTPUT':
            // console.log('[TerminalReducer] ADD_OUTPUT:', JSON.stringify(action.payload))
            let newOutput = [...currentSessionState.output, action.payload.data]
            // Trim output if it exceeds maxOutputLines
            if (newOutput.length > state.maxOutputLines) {
                newOutput = newOutput.slice(-state.maxOutputLines)
                // console.log('[TerminalReducer] Output trimmed to max lines:', state.maxOutputLines)
            }
            return {
                ...state,
                sessions: {
                    ...state.sessions,
                    [connectionId]: {
                        ...currentSessionState,
                        output: newOutput
                    }
                }
            }
        case 'SET_CONNECTED':
            console.log('[TerminalReducer] SET_CONNECTED:', action.payload)
            return {
                ...state,
                sessions: {
                    ...state.sessions,
                    [connectionId]: {
                        ...currentSessionState,
                        isConnected: action.payload.connected
                    }
                }
            }
        case 'SET_ERROR':
            console.log('[TerminalReducer] SET_ERROR:', action.payload)
            return {
                ...state,
                sessions: {
                    ...state.sessions,
                    [connectionId]: {
                        ...currentSessionState,
                        error: action.payload.error
                    }
                }
            }
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
    clearError: (connectionId: string) => void
    getSessionState: (connectionId: string) => TerminalSessionState
} | null>(null)

export function TerminalProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(terminalReducer, initialState)

    // Mutation for opening terminal
    const openMutation = useMutation({
        mutationFn: (connectionId: string) => window.electronAPI.openTerminal(connectionId),
        onSuccess: (session: TerminalSession, variables) => {
            dispatch({ type: 'SET_SESSION', payload: { connectionId: variables, session } })
            dispatch({ type: 'SET_CONNECTED', payload: { connectionId: variables, connected: true } })
        },
    })

    // Mutation for closing terminal
    const closeMutation = useMutation({
        mutationFn: (connectionId: string) => window.electronAPI.closeTerminal(connectionId),
        onSuccess: (_, variables) => {
            dispatch({ type: 'SET_SESSION', payload: { connectionId: variables, session: undefined } })
            dispatch({ type: 'SET_CONNECTED', payload: { connectionId: variables, connected: false } })
            dispatch({ type: 'SET_OUTPUT', payload: { connectionId: variables, output: [] } })
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
            // console.log('[TerminalContext] Received output from backend:', JSON.stringify(data))
            dispatch({ type: 'ADD_OUTPUT', payload: { connectionId: data.connectionId, data: data.data } })
        }

        const handleSessionUpdate = (data: { connectionId: string; session: any }) => {
            console.log('[TerminalContext] Session update received:', data)
            if (data.session) {
                dispatch({ type: 'SET_SESSION', payload: { connectionId: data.connectionId, session: data.session } })
                dispatch({ type: 'SET_CONNECTED', payload: { connectionId: data.connectionId, connected: data.session.connected } })
            }
        }

        const handleError = (data: { connectionId: string; error: string }) => {
            console.log('[TerminalContext] Terminal error received:', data)
            dispatch({ type: 'SET_ERROR', payload: { connectionId: data.connectionId, error: data.error } })
            dispatch({ type: 'SET_CONNECTED', payload: { connectionId: data.connectionId, connected: false } })
        }

        // Set up listeners
        window.electronAPI.onTerminalOutput(handleOutput)
        window.electronAPI.onTerminalSessionUpdate(handleSessionUpdate)
        window.electronAPI.onTerminalError(handleError)

        return () => {
            console.log('[TerminalContext] Cleaning up terminal listeners')
            window.electronAPI.removeAllListeners('terminal-output')
            window.electronAPI.removeAllListeners('terminal-session-update')
            window.electronAPI.removeAllListeners('terminal-error')
        }
    }, [])

    // Function to clear error state
    const clearError = useCallback((connectionId: string) => {
        dispatch({ type: 'SET_ERROR', payload: { connectionId, error: undefined } })
    }, [])

    const getSessionState = useCallback((connectionId: string) => {
        return state.sessions[connectionId] || initialSessionState
    }, [state.sessions])

    return (
        <TerminalContext.Provider
            value={{
                state,
                dispatch,
                openMutation,
                closeMutation,
                sendInputMutation,
                clearError,
                getSessionState
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