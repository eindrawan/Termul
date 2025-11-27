import React, { useEffect, useRef, useState } from 'react'
import { FileSystemEntry } from '../types'
import { useDeletion } from '../contexts/DeletionContext'
import { useQueryClient } from '@tanstack/react-query'
import ConfirmDialog from './ConfirmDialog'
import AlertDialog from './AlertDialog'
import {
    ArrowUpTrayIcon,
    ArrowDownTrayIcon,
    PencilIcon,
    TrashIcon,
    FolderIcon,
    DocumentIcon,
    AtSymbolIcon,
    EyeIcon,
} from '@heroicons/react/24/outline'

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
    onCreateFolder: () => void
    onCreateFile: () => void
    onRename: (file: FileSystemEntry) => void
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
    selectedFiles,
    onCreateFolder,
    onCreateFile,
    onRename
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null)
    const { startDeletion, updateDeletionProgress, finishDeletion } = useDeletion()
    const queryClient = useQueryClient()

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean
        message: string
        onConfirm: () => void
    }>({ isOpen: false, message: '', onConfirm: () => { } })

    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean
        message: string
        variant: 'success' | 'error' | 'warning' | 'info'
    }>({ isOpen: false, message: '', variant: 'info' })

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Don't close if clicking on the dialog
            const target = event.target as Element
            if (target.closest('.fixed.inset-0')) {
                return
            }

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
            let result

            // Use optimized bulk deletion service
            if (isLocal) {
                result = await window.electronAPI.bulkDeleteLocal(
                    selectedFiles,
                    (progress: { current: number; total: number; currentFile: string }) => {
                        updateDeletionProgress(progress.current, progress.currentFile)
                    }
                )
            } else {
                result = await window.electronAPI.bulkDeleteRemote(
                    connectionId!,
                    selectedFiles,
                    (progress: { current: number; total: number; currentFile: string }) => {
                        updateDeletionProgress(progress.current, progress.currentFile)
                    }
                )
            }

            // Refresh the file list after bulk deletion
            const queryKey = isLocal ? 'local-files' : 'remote-files'
            queryClient.invalidateQueries({ queryKey: [queryKey] })

            // Show detailed results to user
            const successRate = Math.round((result.deletedCount / selectedFiles.length) * 100)
            if (result.failedCount === 0) {
                // All files deleted successfully
                setAlertDialog({
                    isOpen: true,
                    message: `✅ Successfully deleted ${result.deletedCount} file${result.deletedCount !== 1 ? 's' : ''} using optimized bulk deletion.`,
                    variant: 'success'
                })
            } else if (result.deletedCount === 0) {
                // All files failed to delete
                setAlertDialog({
                    isOpen: true,
                    message: `❌ Failed to delete all ${result.failedCount} file${result.failedCount !== 1 ? 's' : ''}: ${result.failedFiles.map((f: { path: string; error: string }) => f.path.split('/').pop() || f.path).join(', ')}`,
                    variant: 'error'
                })
            } else {
                // Partial success
                setAlertDialog({
                    isOpen: true,
                    message: `⚠️ Partially completed: Deleted ${result.deletedCount} of ${selectedFiles.length} files (${successRate}% success rate). Failed: ${result.failedFiles.map((f: { path: string; error: string }) => f.path.split('/').pop() || f.path).join(', ')}`,
                    variant: 'warning'
                })
            }
        } catch (error) {
            console.error('Bulk deletion error:', error)
            setAlertDialog({
                isOpen: true,
                message: `❌ An unexpected error occurred during bulk deletion: ${error}`,
                variant: 'error'
            })
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
                onConfirm: async () => {
                    setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } })
                    await performBulkDelete()
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
                onConfirm={() => {
                    // Execute the onConfirm callback from state
                    confirmDialog.onConfirm()
                    onClose()
                }}
                onCancel={() => {
                    setConfirmDialog({ ...confirmDialog, isOpen: false })
                    onClose()
                }}
                variant="danger"
            />

            <AlertDialog
                isOpen={alertDialog.isOpen}
                message={alertDialog.message}
                variant={alertDialog.variant}
                onConfirm={() => setAlertDialog({ ...alertDialog, isOpen: false })}
            />

            <div
                ref={menuRef}
                className="fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg py-1 z-50 min-w-[150px]"
                style={{ left: adjustedX, top: adjustedY }}
            >
                {selectedFiles.length > 1 ? (
                    <>
                        {isLocal && (
                            <button
                                onClick={handleBulkUpload}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center text-gray-700 dark:text-gray-200"
                            >
                                <ArrowUpTrayIcon className="mr-2 h-4 w-4" />
                                Upload ({selectedFiles.length})
                            </button>
                        )}
                        {!isLocal && connectionId && (
                            <button
                                onClick={handleBulkDownload}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center text-gray-700 dark:text-gray-200"
                            >
                                <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                                Download ({selectedFiles.length})
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleBulkDelete()
                                // Don't call onClose() here - let the dialog handle closing
                                return false
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center text-red-600 dark:text-red-400"
                        >
                            <TrashIcon className="mr-2 h-4 w-4" />
                            Delete ({selectedFiles.length})
                        </button>
                    </>
                ) : file ? (
                    <>
                        {isLocal && (
                            <button
                                onClick={handleUpload}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center text-gray-700 dark:text-gray-200"
                            >
                                <ArrowUpTrayIcon className="mr-2 h-4 w-4" />
                                Upload
                            </button>
                        )}
                        {!isLocal && connectionId && (
                            <button
                                onClick={handleDownload}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center text-gray-700 dark:text-gray-200"
                            >
                                <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                                Download
                            </button>
                        )}
                        {file.type === 'file' && file.name.match(/\.jpg$|\.jpeg$|\.png$|\.gif$|\.bmp$|\.svg$/i) && (
                            <button
                                onClick={handleEdit}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center text-gray-700 dark:text-gray-200"
                            >
                                <EyeIcon className="mr-2 h-4 w-4" />
                                Open
                            </button>
                        )}
                        {file.type === 'file' && !file.name.match(/\.jpg$|\.jpeg$|\.png$|\.gif$|\.bmp$|\.svg$/i) && (
                            <button
                                onClick={handleEdit}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center text-gray-700 dark:text-gray-200"
                            >
                                <PencilIcon className="mr-2 h-4 w-4" />
                                Edit
                            </button>
                        )}
                        <button
                            onClick={() => {
                                onRename(file)
                                onClose()
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center text-gray-700 dark:text-gray-200"
                        >
                            <AtSymbolIcon className="mr-2 h-4 w-4 italic" />
                            Rename
                        </button>
                        <button
                            onClick={handleDelete}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center text-red-600 dark:text-red-400"
                        >
                            <TrashIcon className="mr-2 h-4 w-4" />
                            Delete
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => {
                                onCreateFolder()
                                onClose()
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center text-gray-700 dark:text-gray-200"
                        >
                            <FolderIcon className="mr-2 h-4 w-4" />
                            New Folder
                        </button>
                        <button
                            onClick={() => {
                                onCreateFile()
                                onClose()
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center text-gray-700 dark:text-gray-200"
                        >
                            <DocumentIcon className="mr-2 h-4 w-4" />
                            New File
                        </button>
                    </>
                )}
            </div>
        </>
    )
}