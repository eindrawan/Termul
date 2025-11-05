import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { ConnectionProfile, ConnectionStatus } from '../types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import '../types/electron' // Import to ensure the electronAPI types are loaded

interface ConnectionState {
    profiles: ConnectionProfile[]
    currentProfile?: ConnectionProfile
    status: ConnectionStatus
    isLoading: boolean
}

type ConnectionAction =
    | { type: 'SET_PROFILES'; payload: ConnectionProfile[] }
    | { type: 'SET_CURRENT_PROFILE'; payload: ConnectionProfile | undefined }
    | { type: 'SET_STATUS'; payload: ConnectionStatus }
    | { type: 'SET_LOADING'; payload: boolean }

const initialState: ConnectionState = {
    profiles: [],
    status: { connected: false, connecting: false },
    isLoading: false,
}

function connectionReducer(state: ConnectionState, action: ConnectionAction): ConnectionState {
    switch (action.type) {
        case 'SET_PROFILES':
            return { ...state, profiles: action.payload }
        case 'SET_CURRENT_PROFILE':
            return { ...state, currentProfile: action.payload }
        case 'SET_STATUS':
            return { ...state, status: action.payload }
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload }
        default:
            return state
    }
}

const ConnectionContext = createContext<{
    state: ConnectionState
    dispatch: React.Dispatch<ConnectionAction>
    connectMutation: any
    disconnectMutation: any
    saveProfileMutation: any
    deleteProfileMutation: any
} | null>(null)

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(connectionReducer, initialState)
    const queryClient = useQueryClient()

    // Query for profiles
    const { data: profiles = [], refetch: refetchProfiles } = useQuery({
        queryKey: ['profiles'],
        queryFn: () => window.electronAPI.getProfiles(),
    })

    // Update profiles state when data changes
    useEffect(() => {
        if (profiles) {
            dispatch({ type: 'SET_PROFILES', payload: profiles })
        }
    }, [profiles])

    // Mutation for connecting
    const connectMutation = useMutation({
        mutationFn: (profile: ConnectionProfile) => window.electronAPI.connectToHost(profile),
        onMutate: () => {
            dispatch({ type: 'SET_LOADING', payload: true })
            dispatch({ type: 'SET_STATUS', payload: { connected: false, connecting: true } })
        },
        onSuccess: (_, profile) => {
            dispatch({ type: 'SET_CURRENT_PROFILE', payload: profile })
            dispatch({ type: 'SET_STATUS', payload: { connected: true, connecting: false, host: profile.host, username: profile.username } })
        },
        onError: (error: any) => {
            dispatch({ type: 'SET_STATUS', payload: { connected: false, connecting: false, error: error.message } })
        },
        onSettled: () => {
            dispatch({ type: 'SET_LOADING', payload: false })
        },
    })

    // Mutation for disconnecting
    const disconnectMutation = useMutation({
        mutationFn: () => window.electronAPI.disconnectFromHost(),
        onSuccess: () => {
            dispatch({ type: 'SET_CURRENT_PROFILE', payload: undefined })
            dispatch({ type: 'SET_STATUS', payload: { connected: false, connecting: false } })
        },
    })

    // Mutation for saving profiles
    const saveProfileMutation = useMutation({
        mutationFn: (profile: ConnectionProfile) => window.electronAPI.saveProfile(profile),
        onSuccess: () => {
            refetchProfiles()
        },
    })

    // Mutation for deleting profiles
    const deleteProfileMutation = useMutation({
        mutationFn: (id: string) => window.electronAPI.deleteProfile(id),
        onSuccess: () => {
            refetchProfiles()
        },
    })

    // Set up connection status listener
    useEffect(() => {
        const handleStatusChange = (status: ConnectionStatus) => {
            dispatch({ type: 'SET_STATUS', payload: status })
        }

        window.electronAPI.onConnectionStatusChange(handleStatusChange)

        return () => {
            window.electronAPI.removeAllListeners('connection-status-change')
        }
    }, [])

    return (
        <ConnectionContext.Provider
            value={{
                state,
                dispatch,
                connectMutation,
                disconnectMutation,
                saveProfileMutation,
                deleteProfileMutation,
            }}
        >
            {children}
        </ConnectionContext.Provider>
    )
}

export function useConnection() {
    const context = useContext(ConnectionContext)
    if (!context) {
        throw new Error('useConnection must be used within a ConnectionProvider')
    }
    return context
}