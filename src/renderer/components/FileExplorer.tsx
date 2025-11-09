import React, { useState, useEffect, useMemo } from 'react'
import { FileSystemEntry } from '../types'
import { useQuery } from '@tanstack/react-query'
import '../types/electron' // Import to ensure the electronAPI types are loaded

type SortField = 'name' | 'size' | 'modified' | 'permissions'
type SortDirection = 'asc' | 'desc'

interface FileExplorerProps {
    title: string
    path: string
    onPathChange: (path: string) => void
    selectedFiles: FileSystemEntry[]
    onSelectionChange: (files: FileSystemEntry[]) => void
    isLocal: boolean
    disabled?: boolean
}

export default function FileExplorer({
    title,
    path,
    onPathChange,
    selectedFiles,
    onSelectionChange,
    isLocal,
    disabled = false,
}: FileExplorerProps) {
    const [files, setFiles] = useState<FileSystemEntry[]>([])
    const [sortField, setSortField] = useState<SortField>('name')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

    // Query for file listings
    const { data: fetchedFiles = [], isLoading, error } = useQuery({
        queryKey: [isLocal ? 'local-files' : 'remote-files', path, !disabled],
        queryFn: () => {
            return isLocal
                ? window.electronAPI.listLocalFiles(path)
                : window.electronAPI.listRemoteFiles(path)
        },
        enabled: !disabled,
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
        } else {
            // Normal click: select only this file (clear previous selection)
            onSelectionChange([file])
        }

        // Store click info for double-click detection
        setLastClickTime(currentTime)
        setLastClickedFile(file.path)
    }

    const handleBreadcrumbClick = (index: number) => {
        const breadcrumbs = getBreadcrumbs()
        if (index < breadcrumbs.length) {
            onPathChange(breadcrumbs[index].path)
        }
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
        if (path === '/' || (isLocal && (path === 'C:\\' || path === 'C:/'))) {
            return [{
                name: isLocal ? 'C:\\' : '/',
                path: path,
                isLast: true,
            }]
        }

        const parts = path.split(/[/\\]/).filter(Boolean)
        return parts.map((part, index) => {
            const partialPath = parts.slice(0, index + 1)
            // For remote paths, always include the leading slash
            const fullPath = isLocal
                ? partialPath.join('\\')
                : '/' + partialPath.join('/')

            return {
                name: part,
                path: fullPath,
                isLast: index === parts.length - 1,
            }
        })
    }

    return (
        <div className={`flex flex-col h-full ${disabled ? 'opacity-50' : ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-2 bg-gray-100 border-b">
                <h3 className="font-medium">{title}</h3>
                <div className="text-sm text-gray-600">{path}</div>
            </div>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center p-2 bg-white border-b text-sm">
                {getBreadcrumbs().map((crumb, index) => (
                    <React.Fragment key={index}>
                        <button
                            onClick={() => handleBreadcrumbClick(index)}
                            disabled={crumb.isLast}
                            className={`hover:text-primary-600 ${crumb.isLast ? 'font-medium text-gray-900' : 'text-gray-600'
                                }`}
                        >
                            {crumb.name}
                        </button>
                        {!crumb.isLast && (
                            <span className="mx-1 text-gray-400">
                                {isLocal ? '\\' : '/'}
                            </span>
                        )}
                    </React.Fragment>
                ))}
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
                    <div className="w-full overflow-hidden">
                        <table className="file-table table-fixed w-full">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th
                                        className="sortable-header text-left"
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center">
                                            Name
                                            <span className="ml-1">{getSortIcon('name')}</span>
                                        </div>
                                    </th>
                                    <th
                                        className="sortable-header text-left"
                                        onClick={() => handleSort('size')}
                                    >
                                        <div className="flex items-center">
                                            Size
                                            <span className="ml-1">{getSortIcon('size')}</span>
                                        </div>
                                    </th>
                                    <th
                                        className="sortable-header text-left"
                                        onClick={() => handleSort('modified')}
                                    >
                                        <div className="flex items-center">
                                            Modified
                                            <span className="ml-1">{getSortIcon('modified')}</span>
                                        </div>
                                    </th>
                                    <th
                                        className="sortable-header text-left"
                                        onClick={() => handleSort('permissions')}
                                    >
                                        <div className="flex items-center">
                                            Permissions
                                            <span className="ml-1">{getSortIcon('permissions')}</span>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedFiles.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-4 text-gray-500">
                                            No files found
                                        </td>
                                    </tr>
                                ) : (
                                    sortedFiles.map((file) => (
                                        <tr
                                            key={file.path}
                                            onClick={(e) => handleFileClick(file, e)}
                                            className={`${selectedFiles.some(f => f.path === file.path) ? 'selected' : ''}`}
                                        >
                                            <td>
                                                <div className="flex items-center overflow-hidden">
                                                    <span className="mr-2 flex-shrink-0">
                                                        {file.type === 'directory' ? '📁' : '📄'}
                                                    </span>
                                                    <span className="truncate">{file.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {formatFileSize(file.size)}
                                            </td>
                                            <td>
                                                {formatDate(file.modified)}
                                            </td>
                                            <td>
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
        </div>
    )
}