import React from 'react'
import { ClockIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, TrashIcon } from '@heroicons/react/24/outline'
import { TransferItem } from '../types'
import { Tooltip } from './Tooltip'

interface HistoryListProps {
    transfers: TransferItem[]
    onClose: () => void
    onClearHistory?: () => void
    x: number
    y: number
}

export default function HistoryList({
    transfers,
    onClose,
    onClearHistory,
    x,
    y
}: HistoryListProps) {
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

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return 'Unknown'
        const units = ['B', 'KB', 'MB', 'GB']
        let size = bytes
        let unitIndex = 0
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024
            unitIndex++
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`
    }

    const getFileName = (path: string) => {
        return path.split(/[/\\]/).pop() || path
    }

    const truncatePath = (path: string, maxLength: number = 40) => {
        if (path.length <= maxLength) return path
        return '...' + path.substring(path.length - maxLength + 3)
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-600 dark:text-green-400'
            case 'failed': return 'text-red-600 dark:text-red-400'
            case 'cancelled': return 'text-gray-600 dark:text-gray-400'
            case 'active': return 'text-blue-600 dark:text-blue-400'
            case 'paused': return 'text-yellow-600 dark:text-yellow-400'
            default: return 'text-gray-600 dark:text-gray-400'
        }
    }

    // Filter to only show completed, failed, or cancelled transfers
    const historyTransfers = transfers.filter(t =>
        t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'
    )

    const menuRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
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

    return (
        <div
            ref={menuRef}
            className="fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg py-1 z-50 w-80 max-h-[400px] overflow-y-auto"
            style={{ left: adjustedX, top: adjustedY }}
        >
            <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div className="flex items-center">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    Transfer History
                </div>
                {onClearHistory && (
                    <Tooltip content="Clear history">
                        <button
                            onClick={() => {
                                onClearHistory()
                            }}
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                        >
                            <TrashIcon className="h-3 w-3" />
                        </button>
                    </Tooltip>
                )}
            </div>

            {historyTransfers.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No transfer history yet
                </div>
            ) : (
                historyTransfers.slice().reverse().map((transfer) => (
                    <div
                        key={transfer.id}
                        className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex flex-col items-start text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                        <div className="flex items-center w-full justify-between">
                            <div className="flex items-center flex-1 min-w-0">
                                {transfer.direction === 'upload' ? (
                                    <ArrowUpTrayIcon className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2 flex-shrink-0" />
                                ) : (
                                    <ArrowDownTrayIcon className="h-4 w-4 text-green-500 dark:text-green-400 mr-2 flex-shrink-0" />
                                )}
                                <Tooltip content={transfer.sourcePath}>
                                    <span className="truncate flex-1">
                                        {getFileName(transfer.sourcePath)}
                                    </span>
                                </Tooltip>
                            </div>
                            <span className={`text-xs font-medium ${getStatusColor(transfer.status)} ml-2 flex-shrink-0`}>
                                {transfer.status}
                            </span>
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 w-full">
                            <div className="flex justify-between">
                                <Tooltip content={transfer.sourcePath}>
                                    <span className="truncate flex-1">
                                        From: {truncatePath(transfer.sourcePath)}
                                    </span>
                                </Tooltip>
                                <span className="ml-2 flex-shrink-0">
                                    {formatFileSize(transfer.size)}
                                </span>
                            </div>
                            <Tooltip content={transfer.destinationPath}>
                                <div className="truncate mt-1">
                                    To: {truncatePath(transfer.destinationPath)}
                                </div>
                            </Tooltip>
                            <div className="mt-1">
                                {formatDate(transfer.completedAt)}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}