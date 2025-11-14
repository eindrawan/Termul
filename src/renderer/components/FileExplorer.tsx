import React, { useState, useEffect, useMemo } from 'react'
import { FileSystemEntry } from '../types'
import { useQuery } from '@tanstack/react-query'
import { useDeletion } from '../contexts/DeletionContext'
import { useTheme } from '../contexts/ThemeContext'
import { openFileEditor } from './FileEditorManager'
import ContextMenu from './ContextMenu'
import {
    DocumentPlusIcon,
    FolderPlusIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline'
import '../types/electron' // Import to ensure the electronAPI types are loaded
import ConfirmDialog from './ConfirmDialog'
import AlertDialog from './AlertDialog'
import NameInputDialog from './NameInputDialog'

type SortField = 'name' | 'size' | 'modified' | 'permissions'
type SortDirection = 'asc' | 'desc'
type ColumnField = 'name' | 'size' | 'modified' | 'permissions'

interface FileExplorerProps {
    connectionId?: string
    title: string
    path: string
    onPathChange: (path: string) => void
    selectedFiles: FileSystemEntry[]
    onSelectionChange: (files: FileSystemEntry[]) => void
    isLocal: boolean
    disabled?: boolean
    onUpload?: (files: FileSystemEntry[]) => void
    onDownload?: (files: FileSystemEntry[]) => void
}

export default function FileExplorer({
    connectionId,
    title,
    path,
    onPathChange,
    selectedFiles,
    onSelectionChange,
    isLocal,
    disabled = false,
    onUpload,
    onDownload,
}: FileExplorerProps) {
    const [files, setFiles] = useState<FileSystemEntry[]>([])
    const [sortField, setSortField] = useState<SortField>('name')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
    const [isRefreshing, setIsRefreshing] = useState(false)
    const { theme } = useTheme()
    const { startDeletion, updateDeletionProgress, finishDeletion } = useDeletion()
    const [columnWidths, setColumnWidths] = useState({
        name: 40, // percentage
        size: 20,
        modified: 25,
        permissions: 15
    })

    // Define minimum widths for each column (percentage)
    const minColumnWidths: Record<ColumnField, number> = {
        name: 10, // minimum 10%
        size: 8,  // minimum 8%
        modified: 10, // minimum 10%
        permissions: 8 // minimum 8%
    }
    const [isResizing, setIsResizing] = useState<ColumnField | null>(null)
    const [resizeStartX, setResizeStartX] = useState(0)
    const [resizeStartWidth, setResizeStartWidth] = useState(0)

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number
        y: number
        file: FileSystemEntry | null
    } | null>(null)

    // Breadcrumb edit state
    const [isEditingPath, setIsEditingPath] = useState(false)
    const [editingPath, setEditingPath] = useState('')

    // Dialog states
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

    // Name input dialog state
    const [nameInputDialog, setNameInputDialog] = useState<{
        isOpen: boolean
        title: string
        initialValue: string
        placeholder: string
        onConfirm: (name: string) => void
        validate?: (name: string) => string | null
    }>({ isOpen: false, title: '', initialValue: '', placeholder: '', onConfirm: () => { } })

    // Query for file listings
    const { data: fetchedFiles = [], isLoading, error, refetch } = useQuery({
        queryKey: [isLocal ? 'local-files' : 'remote-files', connectionId, path, !disabled],
        queryFn: () => {
            return isLocal
                ? window.electronAPI.listLocalFiles(path)
                : window.electronAPI.listRemoteFiles(connectionId!, path)
        },
        enabled: !disabled && (isLocal || !!connectionId),
        retry: 1,
        retryDelay: 1000,
        staleTime: 0, // Always consider data stale to ensure fresh fetches
        gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        refetchOnReconnect: true,
    })

    // Update files state when data changes
    useEffect(() => {
        if (fetchedFiles) {
            setFiles(fetchedFiles)
        }
    }, [fetchedFiles])

    // Listen for transfer completion events to refresh file list
    useEffect(() => {
        const handleTransferComplete = (event: CustomEvent) => {
            const { sourcePath, destinationPath, direction } = event.detail

            // Extract directory paths from the file paths
            const getSourceDir = (filePath: string) => {
                const parts = filePath.split(/[/\\]/)
                return parts.slice(0, -1).join(isLocal ? '\\' : '/')
            }

            const getDestinationDir = (filePath: string) => {
                const parts = filePath.split(/[/\\]/)
                return parts.slice(0, -1).join(isLocal ? '\\' : '/')
            }

            // Check if the transfer affects the current directory
            let shouldRefresh = false

            if (direction === 'upload') {
                // For upload, refresh the remote destination directory
                const destDir = getDestinationDir(destinationPath)
                shouldRefresh = !isLocal && destDir === path
            } else if (direction === 'download') {
                // For download, refresh the local destination directory
                const destDir = getDestinationDir(destinationPath)
                shouldRefresh = isLocal && destDir === path
            }

            if (shouldRefresh) {
                // Add a small delay to ensure the file is fully written
                setTimeout(() => {
                    refetch()
                }, 500)
            }
        }

        // Add event listener
        window.addEventListener('transfer-complete-for-refresh', handleTransferComplete as EventListener)

        // Clean up
        return () => {
            window.removeEventListener('transfer-complete-for-refresh', handleTransferComplete as EventListener)
        }
    }, [path, isLocal, refetch])

    // Sort files based on current sort field and direction
    const sortedFiles = useMemo(() => {
        const sorted = [...files].sort((a, b) => {
            // Always put directories first when sorting by name
            if (sortField === 'name') {
                if (a.type === 'directory' && b.type === 'file') return -1
                if (a.type === 'file' && b.type === 'directory') return 1
            }

            let aValue: any
            let bValue: any

            switch (sortField) {
                case 'name':
                    aValue = a.name.toLowerCase()
                    bValue = b.name.toLowerCase()
                    break
                case 'size':
                    aValue = a.size || 0
                    bValue = b.size || 0
                    break
                case 'modified':
                    aValue = a.modified || 0
                    bValue = b.modified || 0
                    break
                case 'permissions':
                    aValue = a.permissions || ''
                    bValue = b.permissions || ''
                    break
                default:
                    return 0
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
            return 0
        })

        return sorted
    }, [files, sortField, sortDirection])

    // Handle table mouse events for resizing
    const handleTableMouseDown = (e: React.MouseEvent<HTMLTableElement>) => {
        const target = e.target as HTMLElement
        const th = target.closest('th')

        if (!th) return

        // Check if we're in the resize area (right edge of the th)
        const rect = th.getBoundingClientRect()
        const isNearRightEdge = e.clientX >= rect.right - 10 && e.clientX <= rect.right + 10

        if (!isNearRightEdge) return

        e.preventDefault()
        e.stopPropagation()

        const headers = Array.from(th.parentElement?.children || [])
        const columnIndex = headers.indexOf(th)
        const fieldNames = ['name', 'size', 'modified', 'permissions'] as const
        const field = fieldNames[columnIndex]

        if (field) {
            setIsResizing(field)
            setResizeStartX(e.clientX)
            setResizeStartWidth(columnWidths[field])
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
        }
    }

    // Handle mouse move during resize
    const handleTableMouseMove = (e: MouseEvent) => {
        if (!isResizing) return

        const container = document.getElementById('file-explorer-table')
        if (!container) return

        const containerRect = container.getBoundingClientRect()
        const widthPercent = ((e.clientX - containerRect.left) / containerRect.width) * 100
        const deltaPercent = widthPercent - ((resizeStartX - containerRect.left) / containerRect.width) * 100
        const newWidth = Math.max(minColumnWidths[isResizing], Math.min(95, resizeStartWidth + deltaPercent)) // use min width from config

        setColumnWidths(prev => ({
            ...prev,
            [isResizing]: newWidth
        }))
    }

    // Handle mouse up to end resize
    const handleTableMouseUp = () => {
        setIsResizing(null)
        setResizeStartX(0)
        setResizeStartWidth(0)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }

    // Add global mouse event listeners when resizing
    React.useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleTableMouseMove)
            document.addEventListener('mouseup', handleTableMouseUp)

            return () => {
                document.removeEventListener('mousemove', handleTableMouseMove)
                document.removeEventListener('mouseup', handleTableMouseUp)
            }
        }
    }, [isResizing, resizeStartX, resizeStartWidth])

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    const getSortIcon = (field: SortField) => {
        if (sortField !== field) return '↕️'
        return sortDirection === 'asc' ? '↑' : '↓'
    }

    // Track double-click timing
    const [lastClickTime, setLastClickTime] = useState<number>(0)
    const [lastClickedFile, setLastClickedFile] = useState<string | null>(null)

    // Track last selected file for range selection (Shift+click)
    const [lastSelectedFile, setLastSelectedFile] = useState<FileSystemEntry | null>(null)

    const handleFileClick = (file: FileSystemEntry, event: React.MouseEvent) => {
        // Prevent text selection
        event.preventDefault()

        const currentTime = Date.now()
        const timeDiff = currentTime - lastClickTime
        const isDoubleClick = timeDiff < 300 && lastClickedFile === file.path

        const isSelected = selectedFiles.some(f => f.path === file.path)

        if (isDoubleClick) {
            // Double click detected
            if (file.type === 'directory') {
                onPathChange(file.path)
            }
            setLastClickTime(0)
            setLastClickedFile(null)
            return
        }

        // Single click - provide immediate visual feedback
        if (event.ctrlKey) {
            // Ctrl+click: add/remove from selection (multi-select)
            if (isSelected) {
                onSelectionChange(selectedFiles.filter(f => f.path !== file.path))
            } else {
                onSelectionChange([...selectedFiles, file])
            }
            setLastSelectedFile(file)
        } else if (event.shiftKey && lastSelectedFile) {
            // Shift+click: select range from last selected file to current file
            const lastSelectedIndex = sortedFiles.findIndex(f => f.path === lastSelectedFile.path)
            const currentIndex = sortedFiles.findIndex(f => f.path === file.path)

            if (lastSelectedIndex !== -1 && currentIndex !== -1) {
                const startIndex = Math.min(lastSelectedIndex, currentIndex)
                const endIndex = Math.max(lastSelectedIndex, currentIndex)
                const rangeFiles = sortedFiles.slice(startIndex, endIndex + 1)

                // If Ctrl is also pressed, add to existing selection, otherwise replace
                if (event.ctrlKey || event.metaKey) {
                    // Add range to existing selection, avoiding duplicates
                    const newSelection = [...selectedFiles]
                    rangeFiles.forEach(rangeFile => {
                        if (!newSelection.some(f => f.path === rangeFile.path)) {
                            newSelection.push(rangeFile)
                        }
                    })
                    onSelectionChange(newSelection)
                } else {
                    // Replace selection with range
                    onSelectionChange(rangeFiles)
                }
            }
        } else {
            // Normal click: select only this file (clear previous selection)
            onSelectionChange([file])
            setLastSelectedFile(file)
        }

        // Store click info for double-click detection
        setLastClickTime(currentTime)
        setLastClickedFile(file.path)
    }

    const handleContextMenu = (file: FileSystemEntry | null, event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()

        if (file) {
            // Select the file if it's not already selected
            if (!selectedFiles.some(f => f.path === file.path)) {
                onSelectionChange([file])
            }
        }

        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            file
        })
    }

    const handleContextMenuClose = () => {
        setContextMenu(null)
    }

    const performDelete = async (file: FileSystemEntry, skipConfirmation = false) => {
        try {
            // For bulk operations, don't manage progress here (it's handled by ContextMenu)
            if (!skipConfirmation) {
                // Start deletion progress for single file
                startDeletion(1)
                updateDeletionProgress(0, file.name)
            }

            if (isLocal) {
                await window.electronAPI.deleteLocalFile(file.path)
            } else if (connectionId) {
                await window.electronAPI.deleteRemoteFile(connectionId, file.path)
            }

            // For single file operations, update progress to complete
            if (!skipConfirmation) {
                updateDeletionProgress(1, file.name)
                // Finish deletion and refresh the file list
                finishDeletion()
                refetch()
            }
        } catch (error) {
            console.error('Failed to delete file:', error)

            // For single file operations, show error dialog and finish deletion
            if (!skipConfirmation) {
                setAlertDialog({
                    isOpen: true,
                    message: `Failed to delete ${file.name}: ${error}`,
                    variant: 'error'
                })
                finishDeletion()
            }
            // For bulk operations, re-throw to let ContextMenu handle it
            throw error
        }
    }

    const handleDelete = async (file: FileSystemEntry, skipConfirmation = false) => {
        // Add confirmation dialog before deletion (unless skipped for bulk operations)
        if (!skipConfirmation) {
            const isDirectory = file.type === 'directory'
            const confirmMessage = isDirectory
                ? `Are you sure you want to delete the directory "${file.name}" and all its contents?`
                : `Are you sure you want to delete "${file.name}"?`

            setConfirmDialog({
                isOpen: true,
                message: confirmMessage,
                onConfirm: () => {
                    setConfirmDialog({ ...confirmDialog, isOpen: false })
                    performDelete(file, skipConfirmation)
                }
            })
        } else {
            await performDelete(file, skipConfirmation)
        }
    }

    const handleEdit = (file: FileSystemEntry) => {
        openFileEditor(file, connectionId, isLocal)
        handleContextMenuClose()
    }

    const handleBreadcrumbClick = (index: number) => {
        const breadcrumbs = getBreadcrumbs()
        if (index < breadcrumbs.length) {
            onPathChange(breadcrumbs[index].path)
        }
    }

    const handleBreadcrumbDoubleClick = () => {
        setEditingPath(path)
        setIsEditingPath(true)
    }

    const handlePathEditSubmit = () => {
        if (editingPath.trim() && editingPath.trim() !== path) {
            onPathChange(editingPath.trim())
        }
        setIsEditingPath(false)
    }

    const handlePathEditCancel = () => {
        setIsEditingPath(false)
        setEditingPath(path)
    }

    const handlePathEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handlePathEditSubmit()
        } else if (e.key === 'Escape') {
            handlePathEditCancel()
        }
    }

    const handleCreateFolder = () => {
        setNameInputDialog({
            isOpen: true,
            title: 'New Folder',
            initialValue: 'New Folder',
            placeholder: 'Folder name',
            validate: (name) => {
                // Check for invalid characters
                if (/[<>:"/\\|?*]/.test(name)) {
                    return 'Folder name contains invalid characters'
                }

                // Check if name already exists in current directory
                if (files.some(file => file.name === name)) {
                    return 'A folder with this name already exists'
                }

                return null
            },
            onConfirm: async (name) => {
                try {
                    const folderPath = isLocal
                        ? `${path.replace(/\/$/, '')}\\${name}`
                        : `${path.replace(/\/$/, '')}/${name}`

                    if (isLocal) {
                        await window.electronAPI.createLocalDirectory(folderPath)
                    } else if (connectionId) {
                        await window.electronAPI.createRemoteDirectory(connectionId, folderPath)
                    }

                    // Refresh file list
                    refetch()

                    // Close the dialog after successful creation
                    setNameInputDialog({ ...nameInputDialog, isOpen: false })
                } catch (error) {
                    setAlertDialog({
                        isOpen: true,
                        message: `Failed to create folder: ${error}`,
                        variant: 'error'
                    })
                }
            }
        })
        handleContextMenuClose()
    }

    const handleCreateFile = () => {
        setNameInputDialog({
            isOpen: true,
            title: 'New File',
            initialValue: 'New File.txt',
            placeholder: 'File name',
            validate: (name) => {
                // Check for invalid characters
                if (/[<>:"/\\|?*]/.test(name)) {
                    return 'File name contains invalid characters'
                }

                // Check if name already exists in current directory
                if (files.some(file => file.name === name)) {
                    return 'A file with this name already exists'
                }

                return null
            },
            onConfirm: async (name) => {
                try {
                    const filePath = isLocal
                        ? `${path.replace(/\/$/, '')}\\${name}`
                        : `${path.replace(/\/$/, '')}/${name}`

                    if (isLocal) {
                        await window.electronAPI.createLocalFile(filePath, '')
                    } else if (connectionId) {
                        await window.electronAPI.createRemoteFile(connectionId, filePath, '')
                    }

                    // Refresh file list
                    refetch()

                    // Close the dialog after successful creation
                    setNameInputDialog({ ...nameInputDialog, isOpen: false })
                } catch (error) {
                    setAlertDialog({
                        isOpen: true,
                        message: `Failed to create file: ${error}`,
                        variant: 'error'
                    })
                }
            }
        })
        handleContextMenuClose()
    }

    const handleRename = (file: FileSystemEntry) => {
        setNameInputDialog({
            isOpen: true,
            title: `Rename ${file.type === 'directory' ? 'Folder' : 'File'}`,
            initialValue: file.name,
            placeholder: 'New name',
            validate: (name) => {
                // Check for invalid characters
                if (/[<>:"/\\|?*]/.test(name)) {
                    return 'Name contains invalid characters'
                }

                // Check if name is the same as current
                if (name === file.name) {
                    return 'New name is the same as the current name'
                }

                // Check if name already exists in current directory
                if (files.some(f => f.name === name && f.path !== file.path)) {
                    return `A ${file.type} with this name already exists`
                }

                return null
            },
            onConfirm: async (newName) => {
                try {
                    const oldPath = file.path
                    const newPath = isLocal
                        ? `${path.replace(/\/$/, '')}\\${newName}`
                        : `${path.replace(/\/$/, '')}/${newName}`

                    if (isLocal) {
                        await window.electronAPI.renameLocalFile(oldPath, newPath)
                    } else if (connectionId) {
                        await window.electronAPI.renameRemoteFile(connectionId, oldPath, newPath)
                    }

                    // Refresh file list
                    refetch()

                    // Close the dialog after successful rename
                    setNameInputDialog({ ...nameInputDialog, isOpen: false })
                } catch (error) {
                    setAlertDialog({
                        isOpen: true,
                        message: `Failed to rename: ${error}`,
                        variant: 'error'
                    })
                }
            }
        })
        handleContextMenuClose()
    }

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '-'
        const units = ['B', 'KB', 'MB', 'GB']
        let size = bytes
        let unitIndex = 0
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024
            unitIndex++
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`
    }

    const formatDate = (timestamp?: number) => {
        if (!timestamp) return '-'
        return new Date(timestamp).toLocaleString()
    }

    const getBreadcrumbs = () => {
        // Handle root directory specially
        if (path === '/' || (isLocal && (path === 'C:\\' || path === 'C:/' || path === 'C:'))) {
            return [{
                name: isLocal ? 'C:\\' : '/',
                path: isLocal ? 'C:\\' : '/',
                isLast: true,
            }]
        }

        const parts = path.split(/[/\\]/).filter(Boolean)
        return parts.map((part, index) => {
            const partialPath = parts.slice(0, index + 1)
            // For remote paths, always include the leading slash
            // For local paths, if the first part is a drive letter (like C), add the backslash
            const fullPath = isLocal
                ? (index === 0 && /^[A-Za-z]:$/.test(part) ? part + '\\' : partialPath.join('\\'))
                : '/' + partialPath.join('/')

            return {
                name: part,
                path: fullPath,
                isLast: index === parts.length - 1,
            }
        })
    }

    return (
        <>
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                variant="danger"
            />

            <AlertDialog
                isOpen={alertDialog.isOpen}
                message={alertDialog.message}
                variant={alertDialog.variant}
                onConfirm={() => setAlertDialog({ ...alertDialog, isOpen: false })}
            />

            <div className={`flex flex-col h-full file-explorer-container ${disabled ? 'opacity-50' : ''}`}>
                {/* Header */}
                <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700">
                    <h3 className="font-medium">{title}</h3>
                    <div className="flex gap-1">
                        <button
                            onClick={handleCreateFile}
                            className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 dark:text-green-400 rounded transition-colors"
                            title="New File"
                        >
                            <DocumentPlusIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleCreateFolder}
                            className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 dark:text-blue-400 rounded transition-colors"
                            title="New Folder"
                        >
                            <FolderPlusIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={async () => {
                                setIsRefreshing(true)
                                try {
                                    await refetch()
                                } finally {
                                    setIsRefreshing(false)
                                }
                            }}
                            className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-900 dark:text-gray-400 rounded transition-colors"
                            title="Refresh"
                            disabled={isLoading || isRefreshing}
                        >
                            <ArrowPathIcon className={`w-5 h-5 ${(isLoading || isRefreshing) ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Breadcrumb Navigation */}
                <div className="flex items-center p-2 bg-white dark:bg-gray-900 border-b dark:border-gray-700 text-sm">
                    {isEditingPath ? (
                        <input
                            type="text"
                            value={editingPath}
                            onChange={(e) => setEditingPath(e.target.value)}
                            onKeyDown={handlePathEditKeyDown}
                            onBlur={handlePathEditSubmit}
                            className="flex-1 px-2 py-1 text-sm border border-blue-400 dark:border-blue-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            autoFocus
                        />
                    ) : (
                        <div
                            className="flex items-center flex-1 cursor-text"
                            onDoubleClick={handleBreadcrumbDoubleClick}
                            title="Double-click to edit path"
                        >
                            {getBreadcrumbs().map((crumb, index) => (
                                <React.Fragment key={index}>
                                    <button
                                        onClick={() => handleBreadcrumbClick(index)}
                                        disabled={crumb.isLast}
                                        className={`hover:text-primary-600 dark:hover:text-primary-400 ${crumb.isLast ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
                                            }`}
                                    >
                                        {crumb.name}
                                    </button>
                                    {!crumb.isLast && (
                                        <span className="mx-1 text-gray-400 dark:text-gray-500">
                                            {isLocal ? '\\' : '/'}
                                        </span>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>

                {/* File List */}
                <div className="flex-1 overflow-auto">
                    {isLoading && (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 text-red-600">
                            Error loading files: {String(error)}
                        </div>
                    )}

                    {!isLoading && !error && (
                        <div
                            className="w-full overflow-hidden"
                            onContextMenu={(e) => {
                                // Handle context menu on empty space in the file list area
                                const target = e.target as HTMLElement
                                const isFileRow = target.closest('tr[data-file-row]')
                                if (!isFileRow) {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleContextMenu(null, e)
                                }
                            }}
                        >
                            <table
                                id="file-explorer-table"
                                className="file-table w-full"
                                onMouseDown={handleTableMouseDown}
                            >
                                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                    <tr>
                                        <th
                                            className="sortable-header text-left relative"
                                            style={{ width: `${columnWidths.name}%`, minWidth: 0 }}
                                            onClick={() => handleSort('name')}
                                        >
                                            <div className="flex items-center overflow-hidden">
                                                Name
                                                <span className="ml-1 flex-shrink-0">{getSortIcon('name')}</span>
                                            </div>
                                        </th>
                                        <th
                                            className="sortable-header text-left relative"
                                            style={{ width: `${columnWidths.size}%`, minWidth: 0 }}
                                            onClick={() => handleSort('size')}
                                        >
                                            <div className="flex items-center overflow-hidden">
                                                Size
                                                <span className="ml-1 flex-shrink-0">{getSortIcon('size')}</span>
                                            </div>
                                        </th>
                                        <th
                                            className="sortable-header text-left relative"
                                            style={{ width: `${columnWidths.modified}%`, minWidth: 0 }}
                                            onClick={() => handleSort('modified')}
                                        >
                                            <div className="flex items-center overflow-hidden">
                                                Modified
                                                <span className="ml-1 flex-shrink-0">{getSortIcon('modified')}</span>
                                            </div>
                                        </th>
                                        <th
                                            className="sortable-header text-left relative"
                                            style={{ width: `${columnWidths.permissions}%`, minWidth: 0 }}
                                            onClick={() => handleSort('permissions')}
                                        >
                                            <div className="flex items-center overflow-hidden">
                                                Permissions
                                                <span className="ml-1 flex-shrink-0">{getSortIcon('permissions')}</span>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody
                                    onContextMenu={(e) => {
                                        // Check if the click is on empty space (not on a file row)
                                        const target = e.target as HTMLElement
                                        const row = target.closest('tr')
                                        if (!row || row.querySelector('td[colspan]')) {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleContextMenu(null, e)
                                        }
                                    }}
                                >
                                    {sortedFiles.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-4 text-gray-500 dark:text-gray-400">
                                                No files found
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedFiles.map((file) => (
                                            <tr
                                                key={file.path}
                                                data-file-row="true"
                                                onClick={(e) => handleFileClick(file, e)}
                                                onContextMenu={(e) => handleContextMenu(file, e)}
                                                className={`${selectedFiles.some(f => f.path === file.path) ? 'selected' : ''}`}
                                            >
                                                <td style={{ width: `${columnWidths.name}%`, minWidth: 0 }}>
                                                    <div className="flex items-center overflow-hidden">
                                                        <span className="mr-2 flex-shrink-0">
                                                            {file.type === 'directory' ? '📁' : '📄'}
                                                        </span>
                                                        <span className="truncate">{file.name}</span>
                                                    </div>
                                                </td>
                                                <td style={{ width: `${columnWidths.size}%`, minWidth: 0 }} className="truncate">
                                                    {formatFileSize(file.size)}
                                                </td>
                                                <td style={{ width: `${columnWidths.modified}%`, minWidth: 0 }} className="truncate">
                                                    {formatDate(file.modified)}
                                                </td>
                                                <td style={{ width: `${columnWidths.permissions}%`, minWidth: 0 }} className="truncate">
                                                    {file.permissions || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Context Menu */}
                {contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        file={contextMenu.file}
                        isLocal={isLocal}
                        connectionId={connectionId}
                        onClose={handleContextMenuClose}
                        onUpload={onUpload || (() => { })}
                        onDownload={onDownload || (() => { })}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        selectedFiles={selectedFiles}
                        onCreateFolder={handleCreateFolder}
                        onCreateFile={handleCreateFile}
                        onRename={handleRename}
                    />
                )}

                {/* Name Input Dialog */}
                <NameInputDialog
                    isOpen={nameInputDialog.isOpen}
                    title={nameInputDialog.title}
                    initialValue={nameInputDialog.initialValue}
                    placeholder={nameInputDialog.placeholder}
                    validate={nameInputDialog.validate}
                    onConfirm={nameInputDialog.onConfirm}
                    onCancel={() => setNameInputDialog({ ...nameInputDialog, isOpen: false })}
                />
            </div>
        </>
    )
}