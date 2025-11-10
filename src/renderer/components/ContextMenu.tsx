import React, { useEffect, useRef, useState } from 'react'
import { FileSystemEntry } from '../types'
import { useDeletion } from '../contexts/DeletionContext'
import { useQueryClient } from '@tanstack/react-query'
import ConfirmDialog from './ConfirmDialog'

interface ContextMenuProps {
    x: number
    y: number
    file: FileSystemEntry | null
    isLocal: boolean
    connectionId?: string
    onClose: () => void
    onUpload: (files: FileSystemEntry[]) => void
    onDownload: (files: FileSystemEntry[]) => void
    onDelete: (file: FileSystemEntry, skipConfirmation?: boolean) => void
    onEdit: (file: FileSystemEntry) => void
    selectedFiles: FileSystemEntry[]
}

export default function ContextMenu({
    x,
    y,
    file,
    isLocal,
    connectionId,
    onClose,
    onUpload,
    onDownload,
    onDelete,
    onEdit,
    selectedFiles
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null)
    const { startDeletion, updateDeletionProgress, finishDeletion } = useDeletion()
    const queryClient = useQueryClient()

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean
        message: string
        onConfirm: () => void
    }>({ isOpen: false, message: '', onConfirm: () => { } })

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

    const handleUpload = () => {
        if (file) {
            onUpload([file])
        }
        onClose()
    }

    const handleDownload = () => {
        if (file) {
            onDownload([file])
        }
        onClose()
    }

    const handleDelete = () => {
        if (file) {
            onDelete(file)
        }
        onClose()
    }

    const handleEdit = () => {
        if (file) {
            onEdit(file)
        }
        onClose()
    }

    const handleBulkUpload = () => {
        if (selectedFiles.length > 0) {
            onUpload(selectedFiles)
        }
        onClose()
    }

    const handleBulkDownload = () => {
        if (selectedFiles.length > 0) {
            onDownload(selectedFiles)
        }
        onClose()
    }

    const performBulkDelete = async () => {
        // Start deletion progress for bulk operation
        startDeletion(selectedFiles.length)

        try {
            // Delete files one by one with progress updates
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i]
                updateDeletionProgress(i, file.name)

                // Pass skipConfirmation=true to avoid double confirmations
                await onDelete(file, true)
            }

            // Update progress to complete
            updateDeletionProgress(selectedFiles.length)

            // Refresh the file list after bulk deletion
            const queryKey = isLocal ? 'local-files' : 'remote-files'
            queryClient.invalidateQueries({ queryKey: [queryKey] })
        } catch (error) {
            console.error('Bulk deletion error:', error)
        } finally {
            // Finish deletion progress
            finishDeletion()
        }
        onClose()
    }

    const handleBulkDelete = () => {
        if (selectedFiles.length > 0) {
            const fileCount = selectedFiles.length
            const directoryCount = selectedFiles.filter(f => f.type === 'directory').length
            const fileOnlyCount = fileCount - directoryCount

            let confirmMessage = `Are you sure you want to delete `
            if (directoryCount > 0 && fileOnlyCount > 0) {
                confirmMessage += `${directoryCount} director${directoryCount === 1 ? 'y' : 'ies'} and ${fileOnlyCount} file${fileOnlyCount === 1 ? '' : 's'}?`
            } else if (directoryCount > 0) {
                confirmMessage += `${directoryCount} director${directoryCount === 1 ? 'y' : 'ies'}?`
            } else {
                confirmMessage += `${fileOnlyCount} file${fileOnlyCount === 1 ? '' : 's'}?`
            }

            setConfirmDialog({
                isOpen: true,
                message: confirmMessage,
                onConfirm: () => {
                    setConfirmDialog({ ...confirmDialog, isOpen: false })
                    performBulkDelete()
                }
            })
        } else {
            onClose()
        }
    }

    // Adjust position if menu would go off screen
    const adjustPosition = () => {
        const menuWidth = 200
        const menuHeight = 300
        const adjustedX = x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth : x
        const adjustedY = y + menuHeight > window.innerHeight ? window.innerHeight - menuHeight : y
        return { x: adjustedX, y: adjustedY }
    }

    const { x: adjustedX, y: adjustedY } = adjustPosition()

    return (
        <>
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => {
                    setConfirmDialog({ ...confirmDialog, isOpen: false })
                    onClose()
                }}
                variant="danger"
            />

            <div
                ref={menuRef}
                className="fixed bg-white border border-gray-300 rounded-md shadow-lg py-1 z-50 min-w-[150px]"
                style={{ left: adjustedX, top: adjustedY }}
            >
                {selectedFiles.length > 1 ? (
                    <>
                        {isLocal && (
                            <button
                                onClick={handleBulkUpload}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                            >
                                <span className="mr-2">⬆️</span>
                                Upload ({selectedFiles.length})
                            </button>
                        )}
                        {!isLocal && connectionId && (
                            <button
                                onClick={handleBulkDownload}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                            >
                                <span className="mr-2">⬇️</span>
                                Download ({selectedFiles.length})
                            </button>
                        )}
                        <button
                            onClick={handleBulkDelete}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center text-red-600"
                        >
                            <span className="mr-2">🗑️</span>
                            Delete ({selectedFiles.length})
                        </button>
                    </>
                ) : file ? (
                    <>
                        {isLocal && (
                            <button
                                onClick={handleUpload}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                            >
                                <span className="mr-2">⬆️</span>
                                Upload
                            </button>
                        )}
                        {!isLocal && connectionId && (
                            <button
                                onClick={handleDownload}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                            >
                                <span className="mr-2">⬇️</span>
                                Download
                            </button>
                        )}
                        {file.type === 'file' && (
                            <button
                                onClick={handleEdit}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                            >
                                <span className="mr-2">✏️</span>
                                Edit
                            </button>
                        )}
                        <button
                            onClick={handleDelete}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center text-red-600"
                        >
                            <span className="mr-2">🗑️</span>
                            Delete
                        </button>
                    </>
                ) : (
                    <div className="px-4 py-2 text-sm text-gray-500">
                        No file selected
                    </div>
                )}
            </div>
        </>
    )
}