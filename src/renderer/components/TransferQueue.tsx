import React, { useState } from 'react'
import { useTransfer } from '../contexts/TransferContext'
import { TransferItem } from '../types'

export default function TransferQueue() {
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
    const { state, pauseMutation, resumeMutation, cancelMutation } = useTransfer()

    const getFilteredTransfers = () => {
        switch (filter) {
            case 'active':
                return state.activeTransfers
            case 'completed':
                return state.completedTransfers
            default:
                return state.queue
        }
    }

    const formatSpeed = (bytesPerSecond?: number) => {
        if (!bytesPerSecond) return '-'
        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
        let speed = bytesPerSecond
        let unitIndex = 0
        while (speed >= 1024 && unitIndex < units.length - 1) {
            speed /= 1024
            unitIndex++
        }
        return `${speed.toFixed(1)} ${units[unitIndex]}`
    }

    const formatTime = (seconds?: number) => {
        if (!seconds) return '-'
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = Math.floor(seconds % 60)
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`
    }

    const getStatusIcon = (status: TransferItem['status']) => {
        switch (status) {
            case 'pending':
                return '⏳'
            case 'active':
                return '🔄'
            case 'paused':
                return '⏸️'
            case 'completed':
                return '✅'
            case 'failed':
                return '❌'
            case 'cancelled':
                return '🚫'
            default:
                return '❓'
        }
    }

    const getStatusColor = (status: TransferItem['status']) => {
        switch (status) {
            case 'pending':
                return 'text-gray-600'
            case 'active':
                return 'text-blue-600'
            case 'paused':
                return 'text-yellow-600'
            case 'completed':
                return 'text-green-600'
            case 'failed':
                return 'text-red-600'
            case 'cancelled':
                return 'text-gray-500'
            default:
                return 'text-gray-600'
        }
    }

    const handleAction = (transfer: TransferItem, action: 'pause' | 'resume' | 'cancel') => {
        switch (action) {
            case 'pause':
                pauseMutation.mutate(transfer.id)
                break
            case 'resume':
                resumeMutation.mutate(transfer.id)
                break
            case 'cancel':
                cancelMutation.mutate(transfer.id)
                break
        }
    }

    const filteredTransfers = getFilteredTransfers()

    return (
        <div className="flex flex-col h-full">
            {/* Header with filters */}
            <div className="flex items-center justify-between p-4 bg-white border-b">
                <h2 className="text-lg font-semibold">Transfer Queue</h2>
                <div className="flex space-x-2">
                    {(['all', 'active', 'completed'] as const).map((filterOption) => (
                        <button
                            key={filterOption}
                            onClick={() => setFilter(filterOption)}
                            className={`px-3 py-1 rounded-md text-sm ${filter === filterOption
                                    ? 'bg-primary-100 text-primary-700'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)} ({filterOption === 'all' ? state.queue.length : filterOption === 'active' ? state.activeTransfers.length : state.completedTransfers.length})
                        </button>
                    ))}
                </div>
            </div>

            {/* Transfer list */}
            <div className="flex-1 overflow-auto">
                {filteredTransfers.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                        No transfers {filter !== 'all' && `in ${filter} state`}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {filteredTransfers.map((transfer) => (
                            <div key={transfer.id} className="transfer-item">
                                <div className="flex items-center space-x-3">
                                    <span className={`text-lg ${getStatusColor(transfer.status)}`}>
                                        {getStatusIcon(transfer.status)}
                                    </span>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <div className="truncate">
                                                <div className="font-medium text-sm">
                                                    {transfer.direction === 'upload' ? '↑' : '↓'} {transfer.sourcePath.split(/[/\\]/).pop()}
                                                </div>
                                                <div className="text-xs text-gray-500 truncate">
                                                    {transfer.sourcePath} → {transfer.destinationPath}
                                                </div>
                                            </div>
                                            <div className="text-right text-sm">
                                                <div>{formatSpeed(transfer.speed)}</div>
                                                <div className="text-xs text-gray-500">
                                                    {transfer.progress.toFixed(1)}% • {formatTime(transfer.eta)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="mt-1">
                                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                <div
                                                    className={`h-1.5 rounded-full ${transfer.status === 'completed' ? 'bg-green-500' :
                                                            transfer.status === 'failed' ? 'bg-red-500' :
                                                                transfer.status === 'cancelled' ? 'bg-gray-500' :
                                                                    'bg-blue-500'
                                                        }`}
                                                    style={{ width: `${transfer.progress}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {transfer.error && (
                                            <div className="text-xs text-red-600 mt-1">
                                                Error: {transfer.error}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex space-x-1">
                                        {transfer.status === 'active' && (
                                            <button
                                                onClick={() => handleAction(transfer, 'pause')}
                                                className="btn btn-ghost text-xs"
                                                title="Pause"
                                            >
                                                ⏸️
                                            </button>
                                        )}
                                        {transfer.status === 'paused' && (
                                            <button
                                                onClick={() => handleAction(transfer, 'resume')}
                                                className="btn btn-ghost text-xs"
                                                title="Resume"
                                            >
                                                ▶️
                                            </button>
                                        )}
                                        {(transfer.status === 'active' || transfer.status === 'paused' || transfer.status === 'pending') && (
                                            <button
                                                onClick={() => handleAction(transfer, 'cancel')}
                                                className="btn btn-ghost text-xs"
                                                title="Cancel"
                                            >
                                                🚫
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}