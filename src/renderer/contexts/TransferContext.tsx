import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { TransferItem, TransferDescriptor } from '../types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import '../types/electron' // Import to ensure the electronAPI types are loaded

interface TransferState {
    queue: TransferItem[]
    activeTransfers: TransferItem[]
    completedTransfers: TransferItem[]
}

type TransferAction =
    | { type: 'SET_QUEUE'; payload: TransferItem[] }
    | { type: 'UPDATE_TRANSFER'; payload: TransferItem }
    | { type: 'ADD_TRANSFER'; payload: TransferItem }
    | { type: 'REMOVE_TRANSFER'; payload: string }

const initialState: TransferState = {
    queue: [],
    activeTransfers: [],
    completedTransfers: [],
}

function transferReducer(state: TransferState, action: TransferAction): TransferState {
    switch (action.type) {
        case 'SET_QUEUE':
            return {
                ...state,
                queue: action.payload,
                activeTransfers: action.payload.filter(t => t.status === 'active' || t.status === 'pending'),
                completedTransfers: action.payload.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'),
            }
        case 'UPDATE_TRANSFER':
            return {
                ...state,
                queue: state.queue.map(t => t.id === action.payload.id ? action.payload : t),
                activeTransfers: state.activeTransfers.map(t => t.id === action.payload.id ? action.payload : t),
                completedTransfers: state.completedTransfers.map(t => t.id === action.payload.id ? action.payload : t),
            }
        case 'ADD_TRANSFER':
            return {
                ...state,
                queue: [...state.queue, action.payload],
                activeTransfers: [...state.activeTransfers, action.payload],
            }
        case 'REMOVE_TRANSFER':
            return {
                ...state,
                queue: state.queue.filter(t => t.id !== action.payload),
                activeTransfers: state.activeTransfers.filter(t => t.id !== action.payload),
                completedTransfers: state.completedTransfers.filter(t => t.id !== action.payload),
            }
        default:
            return state
    }
}

const TransferContext = createContext<{
    state: TransferState
    dispatch: React.Dispatch<TransferAction>
    enqueueMutation: any
    pauseMutation: any
    resumeMutation: any
    cancelMutation: any
} | null>(null)

export function TransferProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(transferReducer, initialState)
    const queryClient = useQueryClient()

    // Query for transfer queue
    const { data: queue = [], refetch: refetchQueue } = useQuery({
        queryKey: ['transfer-queue'],
        queryFn: () => window.electronAPI.getTransferQueue(),
    })

    // Update queue state when data changes
    useEffect(() => {
        if (queue) {
            dispatch({ type: 'SET_QUEUE', payload: queue })
        }
    }, [queue])

    // Mutation for enqueuing transfers
    const enqueueMutation = useMutation({
        mutationFn: (transfers: TransferDescriptor[]) => window.electronAPI.enqueueTransfers(transfers),
        onSuccess: () => {
            refetchQueue()
        },
    })

    // Mutation for pausing transfers
    const pauseMutation = useMutation({
        mutationFn: (id: string) => window.electronAPI.pauseTransfer(id),
        onSuccess: () => {
            refetchQueue()
        },
    })

    // Mutation for resuming transfers
    const resumeMutation = useMutation({
        mutationFn: (id: string) => window.electronAPI.resumeTransfer(id),
        onSuccess: () => {
            refetchQueue()
        },
    })

    // Mutation for cancelling transfers
    const cancelMutation = useMutation({
        mutationFn: (id: string) => window.electronAPI.cancelTransfer(id),
        onSuccess: () => {
            refetchQueue()
        },
    })

    // Set up transfer progress listener
    useEffect(() => {
        const handleProgress = (progress: any) => {
            dispatch({ type: 'UPDATE_TRANSFER', payload: progress })
        }

        const handleComplete = (result: any) => {
            dispatch({ type: 'UPDATE_TRANSFER', payload: result })
            refetchQueue()
        }

        window.electronAPI.onTransferProgress(handleProgress)
        window.electronAPI.onTransferComplete(handleComplete)

        return () => {
            window.electronAPI.removeAllListeners('transfer-progress')
            window.electronAPI.removeAllListeners('transfer-complete')
        }
    }, [refetchQueue])

    return (
        <TransferContext.Provider
            value={{
                state,
                dispatch,
                enqueueMutation,
                pauseMutation,
                resumeMutation,
                cancelMutation,
            }}
        >
            {children}
        </TransferContext.Provider>
    )
}

export function useTransfer() {
    const context = useContext(TransferContext)
    if (!context) {
        throw new Error('useTransfer must be used within a TransferProvider')
    }
    return context
}