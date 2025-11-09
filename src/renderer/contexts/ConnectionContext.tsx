import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { ConnectionProfile, ConnectionStatus, ActiveConnection } from '../types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import '../types/electron' // Import to ensure the electronAPI types are loaded

interface ConnectionState {
    profiles: ConnectionProfile[]
    activeConnections: Map<string, ActiveConnection>
    currentConnectionId?: string
    isLoading: boolean
}

type ConnectionAction =
    | { type: 'SET_PROFILES'; payload: ConnectionProfile[] }
    | { type: 'ADD_CONNECTION'; payload: ActiveConnection }
    | { type: 'REMOVE_CONNECTION'; payload: string }
    | { type: 'UPDATE_CONNECTION_STATUS'; payload: { connectionId: string; status: ConnectionStatus } }
    | { type: 'SET_CURRENT_CONNECTION'; payload: string | undefined }
    | { type: 'UPDATE_REMOTE_PATH'; payload: { connectionId: string; remotePath: string } }
    | { type: 'UPDATE_LOCAL_PATH'; payload: { connectionId: string; localPath: string } }
    | { type: 'SET_LOADING'; payload: boolean }

const initialState: ConnectionState = {
    profiles: [],
    activeConnections: new Map(),
    isLoading: false,
}

function connectionReducer(state: ConnectionState, action: ConnectionAction): ConnectionState {
    switch (action.type) {
        case 'SET_PROFILES':
            return { ...state, profiles: action.payload }
        case 'ADD_CONNECTION': {
            const newConnections = new Map(state.activeConnections)
            newConnections.set(action.payload.id, action.payload)
            return { ...state, activeConnections: newConnections, currentConnectionId: action.payload.id }
        }
        case 'REMOVE_CONNECTION': {
            const newConnections = new Map(state.activeConnections)
            newConnections.delete(action.payload)
            const newCurrentId = state.currentConnectionId === action.payload
                ? Array.from(newConnections.keys())[0]
                : state.currentConnectionId
            return { ...state, activeConnections: newConnections, currentConnectionId: newCurrentId }
        }
        case 'UPDATE_CONNECTION_STATUS': {
            const newConnections = new Map(state.activeConnections)
            const connection = newConnections.get(action.payload.connectionId)
            if (connection) {
                newConnections.set(action.payload.connectionId, {
                    ...connection,
                    status: action.payload.status
                })
            }
            return { ...state, activeConnections: newConnections }
        }
        case 'SET_CURRENT_CONNECTION':
            return { ...state, currentConnectionId: action.payload }
        case 'UPDATE_LOCAL_PATH': {
            const newConnections = new Map(state.activeConnections)
            const connection = newConnections.get(action.payload.connectionId)
            if (connection) {
                newConnections.set(action.payload.connectionId, {
                    ...connection,
                    localPath: action.payload.localPath
                })
                // Save path to database using profile ID
                window.electronAPI.saveConnectionPath(connection.profile.id || '', 'local', action.payload.localPath)
                    .catch(error => console.warn('Failed to save local path:', error))
            }
            return { ...state, activeConnections: newConnections }
        }
        case 'UPDATE_REMOTE_PATH': {
            const newConnections = new Map(state.activeConnections)
            const connection = newConnections.get(action.payload.connectionId)
            if (connection) {
                newConnections.set(action.payload.connectionId, {
                    ...connection,
                    remotePath: action.payload.remotePath
                })
                // Save path to database using profile ID
                window.electronAPI.saveConnectionPath(connection.profile.id || '', 'remote', action.payload.remotePath)
                    .catch(error => console.warn('Failed to save remote path:', error))
            }
            return { ...state, activeConnections: newConnections }
        }
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
        },
        onSuccess: async (result: { connectionId: string; status: ConnectionStatus }, profile) => {
            // Try to load saved paths for this profile
            let savedPaths: { local?: string; remote?: string } = {}
            try {
                savedPaths = await window.electronAPI.getAllConnectionPaths(profile.id || '')
            } catch (error) {
                console.warn('Failed to load saved paths:', error)
            }

            const newConnection: ActiveConnection = {
                id: result.connectionId,
                profile,
                status: result.status,
                remotePath: savedPaths.remote || '/',
                localPath: savedPaths.local || undefined
            }
            dispatch({ type: 'ADD_CONNECTION', payload: newConnection })
        },
        onError: (error: any) => {
            console.error('Connection error:', error)
        },
        onSettled: () => {
            dispatch({ type: 'SET_LOADING', payload: false })
        },
    })

    // Mutation for disconnecting
    const disconnectMutation = useMutation({
        mutationFn: (connectionId: string) => window.electronAPI.disconnectFromHost(connectionId),
        onSuccess: (_, connectionId) => {
            dispatch({ type: 'REMOVE_CONNECTION', payload: connectionId })
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
        const handleStatusChange = (data: { connectionId: string; status: ConnectionStatus }) => {
            dispatch({ type: 'UPDATE_CONNECTION_STATUS', payload: data })
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