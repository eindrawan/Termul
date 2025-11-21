import React, { useRef, useEffect, useState } from 'react'
import { ClockIcon, DocumentIcon, TrashIcon } from '@heroicons/react/24/outline'
import ConfirmDialog from './ConfirmDialog'

interface FileHistoryItem {
    id: string
    connectionId: string | null
    path: string
    lastOpenedAt: number
}

interface FileHistoryListProps {
    history: FileHistoryItem[]
    onClose: () => void
    onClearHistory: () => void
    onOpenFile: (path: string, connectionId: string | null) => void
    onDelete: (id: string) => void
    x: number
    y: number
}

export default function FileHistoryList({
    history,
    onClose,
    onClearHistory,
    onOpenFile,
    onDelete,
    x,
    y
}: FileHistoryListProps) {
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean
        itemId: string
        fileName: string
    }>({ isOpen: false, itemId: '', fileName: '' })

    const formatDate = (timestamp?: number) => {
        if (!timestamp) return 'Unknown'

        const date = new Date(timestamp * 1000) // Convert from Unix timestamp
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins} min ago`

        const diffHours = Math.floor(diffMins / 60)
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`

        const diffDays = Math.floor(diffHours / 24)
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

        return date.toLocaleDateString()
    }

    const getFileName = (path: string) => {
        return path.split(/[/\\]/).pop() || path
    }

    const truncatePath = (path: string, maxLength: number = 40) => {
        if (path.length <= maxLength) return path
        return '...' + path.substring(path.length - maxLength + 3)
    }

    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose()
            }
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [onClose])

    // Adjust position if menu would go off screen
    const adjustPosition = () => {
        const menuWidth = 320
        const menuHeight = 400
        const adjustedX = x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth : x
        const adjustedY = y + menuHeight > window.innerHeight ? window.innerHeight - menuHeight : y
        return { x: adjustedX, y: adjustedY }
    }

    const { x: adjustedX, y: adjustedY } = adjustPosition()

    const handleDelete = (e: React.MouseEvent, id: string, path: string) => {
        e.stopPropagation()
        setConfirmDialog({
            isOpen: true,
            itemId: id,
            fileName: getFileName(path)
        })
    }

    const handleConfirmDelete = () => {
        onDelete(confirmDialog.itemId)
        setConfirmDialog({ isOpen: false, itemId: '', fileName: '' })
    }

    const handleCancelDelete = () => {
        setConfirmDialog({ isOpen: false, itemId: '', fileName: '' })
    }

    return (
        <div
            ref={menuRef}
            className="fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50 w-80 flex flex-col"
            style={{ left: adjustedX, top: adjustedY, maxHeight: '400px' }}
        >
            <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div className="flex items-center">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    Recently Opened Files
                </div>
                {onClearHistory && (
                    <button
                        onClick={() => {
                            onClearHistory()
                        }}
                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                        title="Clear history"
                    >
                        <TrashIcon className="h-3 w-3" />
                    </button>
                )}
            </div>

            <div className="overflow-y-auto flex-1">
                {history.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No recently opened files
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {history.map((item) => (
                            <div
                                key={item.id}
                                className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors group"
                                onClick={() => onOpenFile(item.path, item.connectionId)}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center mb-1">
                                            <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate block flex-1" title={getFileName(item.path)}>
                                                {getFileName(item.path)}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1" title={item.path}>
                                            {truncatePath(item.path)}
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-gray-400 dark:text-gray-500">
                                            <span>{item.connectionId ? 'Remote' : 'Local'}</span>
                                            <span>{formatDate(item.lastOpenedAt)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDelete(e, item.id, item.path)}
                                        className="ml-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 text-xs p-1"
                                        title="Remove from this list"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title="Remove from History"
                message={`Are you sure you want to remove "${confirmDialog.fileName}" from history?`}
                confirmText="Remove"
                cancelText="Cancel"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                variant="danger"
            />
        </div>
    )
}
