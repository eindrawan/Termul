import React, { useEffect, useRef } from 'react'
import { FileSystemEntry } from '../types'

interface ContextMenuProps {
    x: number
    y: number
    file: FileSystemEntry | null
    isLocal: boolean
    connectionId?: string
    onClose: () => void
    onUpload: (files: FileSystemEntry[]) => void
    onDownload: (files: FileSystemEntry[]) => void
    onDelete: (file: FileSystemEntry) => void
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

    const handleBulkDelete = () => {
        if (selectedFiles.length > 0) {
            selectedFiles.forEach(f => onDelete(f))
        }
        onClose()
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
    )
}