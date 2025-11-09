import React, { createContext, useContext, useState, ReactNode } from 'react'

interface DeletionProgress {
    isActive: boolean
    current: number
    total: number
    currentFile?: string
}

interface DeletionContextType {
    deletionProgress: DeletionProgress
    startDeletion: (total: number) => void
    updateDeletionProgress: (current: number, currentFile?: string) => void
    finishDeletion: () => void
}

const DeletionContext = createContext<DeletionContextType | undefined>(undefined)

export function DeletionProvider({ children }: { children: ReactNode }) {
    const [deletionProgress, setDeletionProgress] = useState<DeletionProgress>({
        isActive: false,
        current: 0,
        total: 0
    })

    const startDeletion = (total: number) => {
        setDeletionProgress({
            isActive: true,
            current: 0,
            total
        })
    }

    const updateDeletionProgress = (current: number, currentFile?: string) => {
        setDeletionProgress(prev => ({
            ...prev,
            current,
            currentFile
        }))
    }

    const finishDeletion = () => {
        setDeletionProgress({
            isActive: false,
            current: 0,
            total: 0
        })
    }

    return (
        <DeletionContext.Provider value={{
            deletionProgress,
            startDeletion,
            updateDeletionProgress,
            finishDeletion
        }}>
            {children}
        </DeletionContext.Provider>
    )
}

export function useDeletion() {
    const context = useContext(DeletionContext)
    if (context === undefined) {
        throw new Error('useDeletion must be used within a DeletionProvider')
    }
    return context
}