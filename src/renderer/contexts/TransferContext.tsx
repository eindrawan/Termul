import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { TransferItem, TransferDescriptor } from '../types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import '../types/electron' // Import to ensure the electronAPI types are loaded

interface TransferProgress {
    isActive: boolean
    activeCount: number
    totalCount: number
    currentFile?: string
    overallProgress: number
}

interface TransferState {
    queue: TransferItem[]
    activeTransfers: TransferItem[]
    completedTransfers: TransferItem[]
    transferProgress: TransferProgress
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
    transferProgress: {
        isActive: false,
        activeCount: 0,
        totalCount: 0,
        overallProgress: 0
    }
}

function transferReducer(state: TransferState, action: TransferAction): TransferState {
    switch (action.type) {
        case 'SET_QUEUE':
            const activeTransfers = action.payload.filter(t => t.status === 'active' || t.status === 'pending')
            const completedTransfers = action.payload.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled')

            // Calculate transfer progress
            const isActive = activeTransfers.length > 0
            const overallProgress = action.payload.length > 0
                ? action.payload.reduce((sum, t) => sum + t.progress, 0) / action.payload.length
                : 0
            const currentFile = activeTransfers.length > 0 ? activeTransfers[0].sourcePath.split(/[/\\]/).pop() : undefined

            return {
                ...state,
                queue: action.payload,
                activeTransfers,
                completedTransfers,
                transferProgress: {
                    isActive,
                    activeCount: activeTransfers.length,
                    totalCount: action.payload.length,
                    currentFile,
                    overallProgress
                }
            }
        case 'UPDATE_TRANSFER':
            const updatedQueue = state.queue.map(t => t.id === action.payload.id ? action.payload : t)
            const updatedActiveTransfers = updatedQueue.filter(t => t.status === 'active' || t.status === 'pending')
            const updatedCompletedTransfers = updatedQueue.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled')

            // Recalculate transfer progress
            const isUpdatedActive = updatedActiveTransfers.length > 0
            const updatedOverallProgress = updatedQueue.length > 0
                ? updatedQueue.reduce((sum, t) => sum + t.progress, 0) / updatedQueue.length
                : 0
            const updatedCurrentFile = updatedActiveTransfers.length > 0 ? updatedActiveTransfers[0].sourcePath.split(/[/\\]/).pop() : undefined

            return {
                ...state,
                queue: updatedQueue,
                activeTransfers: updatedActiveTransfers,
                completedTransfers: updatedCompletedTransfers,
                transferProgress: {
                    isActive: isUpdatedActive,
                    activeCount: updatedActiveTransfers.length,
                    totalCount: updatedQueue.length,
                    currentFile: updatedCurrentFile,
                    overallProgress: updatedOverallProgress
                }
            }
        case 'ADD_TRANSFER':
            const newQueue = [...state.queue, action.payload]
            const newActiveTransfers = [...state.activeTransfers, action.payload]

            return {
                ...state,
                queue: newQueue,
                activeTransfers: newActiveTransfers,
                transferProgress: {
                    isActive: true,
                    activeCount: newActiveTransfers.length,
                    totalCount: newQueue.length,
                    currentFile: action.payload.sourcePath.split(/[/\\]/).pop(),
                    overallProgress: newQueue.reduce((sum, t) => sum + t.progress, 0) / newQueue.length
                }
            }
        case 'REMOVE_TRANSFER':
            const filteredQueue = state.queue.filter(t => t.id !== action.payload)
            const filteredActiveTransfers = filteredQueue.filter(t => t.status === 'active' || t.status === 'pending')
            const filteredCompletedTransfers = filteredQueue.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled')

            // Recalculate transfer progress
            const isFilteredActive = filteredActiveTransfers.length > 0
            const filteredOverallProgress = filteredQueue.length > 0
                ? filteredQueue.reduce((sum, t) => sum + t.progress, 0) / filteredQueue.length
                : 0
            const filteredCurrentFile = filteredActiveTransfers.length > 0 ? filteredActiveTransfers[0].sourcePath.split(/[/\\]/).pop() : undefined

            return {
                ...state,
                queue: filteredQueue,
                activeTransfers: filteredActiveTransfers,
                completedTransfers: filteredCompletedTransfers,
                transferProgress: {
                    isActive: isFilteredActive,
                    activeCount: filteredActiveTransfers.length,
                    totalCount: filteredQueue.length,
                    currentFile: filteredCurrentFile,
                    overallProgress: filteredOverallProgress
                }
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

            // Emit custom event for file explorer refresh
            if (result.sourcePath && result.destinationPath && result.direction) {
                const refreshEvent = new CustomEvent('transfer-complete-for-refresh', {
                    detail: {
                        sourcePath: result.sourcePath,
                        destinationPath: result.destinationPath,
                        direction: result.direction
                    }
                })
                window.dispatchEvent(refreshEvent)
            }
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