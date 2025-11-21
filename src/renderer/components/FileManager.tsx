import React, { useState, useEffect } from 'react'
import { useConnection } from '../contexts/ConnectionContext'
import { useTransfer } from '../contexts/TransferContext'
import { FileSystemEntry, TransferDescriptor, Bookmark } from '../types'
import FileExplorer from './FileExplorer'
import BookmarkDialog from './BookmarkDialog'
import BookmarkList from './BookmarkList'
import HistoryList from './HistoryList'
import FileHistoryList from './FileHistoryList'
import {
    BookmarkIcon as BookmarkHeroIcon,
    BookOpenIcon,
    ArrowsRightLeftIcon,
    ClockIcon
} from '@heroicons/react/24/outline'
import '../types/electron' // Import to ensure the electronAPI types are loaded

interface FileManagerProps {
    connectionId: string
    isActive: boolean
}

export default function FileManager({
    connectionId,
    isActive
}: FileManagerProps) {
    const [selectedLocalFiles, setSelectedLocalFiles] = useState<FileSystemEntry[]>([])
    const [selectedRemoteFiles, setSelectedRemoteFiles] = useState<FileSystemEntry[]>([])
    const [leftPaneWidth, setLeftPaneWidth] = useState(50) // percentage
    const [isResizing, setIsResizing] = useState(false)
    const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false)
    const [bookmarkListOpen, setBookmarkListOpen] = useState(false)
    const [bookmarkListPosition, setBookmarkListPosition] = useState({ x: 0, y: 0 })
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
    const [historyListOpen, setHistoryListOpen] = useState(false)
    const [historyListPosition, setHistoryListPosition] = useState({ x: 0, y: 0 })
    const [fileHistoryListOpen, setFileHistoryListOpen] = useState(false)
    const [fileHistoryListPosition, setFileHistoryListPosition] = useState({ x: 0, y: 0 })
    const [fileHistory, setFileHistory] = useState<any[]>([])

    const { state: connectionState, dispatch } = useConnection()
    const { state: transferState, enqueueMutation, refetchQueue } = useTransfer()

    const connection = connectionState.activeConnections.get(connectionId)
    const isConnected = connection?.status.connected || false

    // Get paths from connection state
    const localPath = connection?.localPath || 'C:\\'
    const remotePath = connection?.remotePath || '/'

    // Save local path when it changes
    const handleLocalPathChange = (path: string) => {
        if (connectionState.currentConnectionId) {
            dispatch({
                type: 'UPDATE_LOCAL_PATH',
                payload: { connectionId: connectionState.currentConnectionId, localPath: path }
            })
        }
    }

    const handleRemotePathChange = (path: string) => {
        if (connectionState.currentConnectionId) {
            dispatch({
                type: 'UPDATE_REMOTE_PATH',
                payload: { connectionId: connectionState.currentConnectionId, remotePath: path }
            })
        }
    }

    const handleUpload = () => {
        if (selectedLocalFiles.length === 0 || !isConnected) return

        const transfers: TransferDescriptor[] = selectedLocalFiles.map(file => ({
            connectionId,
            sourcePath: file.path,
            destinationPath: `${remotePath}/${file.name}`,
            direction: 'upload' as const,
            overwritePolicy: 'prompt' as const,
            priority: 0,
        }))

        enqueueMutation.mutate(transfers)
        setSelectedLocalFiles([])
    }

    const handleDownload = () => {
        if (selectedRemoteFiles.length === 0 || !isConnected) return

        const transfers: TransferDescriptor[] = selectedRemoteFiles.map(file => ({
            connectionId,
            sourcePath: file.path,
            destinationPath: `${localPath}/${file.name}`,
            direction: 'download' as const,
            overwritePolicy: 'prompt' as const,
            priority: 0,
        }))

        enqueueMutation.mutate(transfers)
        setSelectedRemoteFiles([])
    }

    // Handle mouse down on resizer
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
    }

    // Handle mouse move during resize
    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return

        const container = document.getElementById('file-manager-container')
        if (!container) return

        const containerRect = container.getBoundingClientRect()
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

        // Clamp width between 20% and 80%
        const clampedWidth = Math.min(Math.max(newWidth, 20), 80)
        setLeftPaneWidth(clampedWidth)
    }

    // Handle mouse up to end resize
    const handleMouseUp = () => {
        setIsResizing(false)
    }

    // Add global mouse event listeners when resizing
    React.useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'

            return () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
                document.body.style.cursor = ''
                document.body.style.userSelect = ''
            }
        }
    }, [isResizing])

    // Load bookmarks when connection changes
    useEffect(() => {
        const loadBookmarks = async () => {
            if (connection?.profile?.id) {
                try {
                    const profileBookmarks = await window.electronAPI.getBookmarks(connection.profile.id)
                    setBookmarks(profileBookmarks)
                } catch (error) {
                    console.error('Failed to load bookmarks:', error)
                }
            } else {
                // Clear bookmarks when no connection
                setBookmarks([])
            }
        }

        loadBookmarks()
    }, [connection?.profile?.id])

    const handleSaveBookmark = async (bookmark: Omit<Bookmark, 'id' | 'createdAt'>) => {
        try {
            await window.electronAPI.saveBookmark(bookmark)
            // Reload bookmarks
            if (connection?.profile?.id) {
                const profileBookmarks = await window.electronAPI.getBookmarks(connection.profile.id)
                setBookmarks(profileBookmarks)
            }
        } catch (error) {
            console.error('Failed to save bookmark:', error)
            alert(error instanceof Error ? error.message : 'Failed to save bookmark')
        }
    }

    const handleSelectBookmark = (bookmark: Bookmark) => {
        handleLocalPathChange(bookmark.localPath)
        handleRemotePathChange(bookmark.remotePath)
    }

    const handleDeleteBookmark = async (id: string) => {
        try {
            await window.electronAPI.deleteBookmark(id)
            // Reload bookmarks
            if (connection?.profile?.id) {
                const profileBookmarks = await window.electronAPI.getBookmarks(connection.profile.id)
                setBookmarks(profileBookmarks)
            }
        } catch (error) {
            console.error('Failed to delete bookmark:', error)
            alert('Failed to delete bookmark')
        }
    }

    const handleClearHistory = async () => {
        // Clear all transfers (history and active ones)
        const activeCount = transferState.activeTransfers.length
        const message = activeCount > 0
            ? `Are you sure you want to clear all transfer history? This will also cancel ${activeCount} active transfer(s).`
            : 'Are you sure you want to clear all transfer history?'

        if (confirm(message)) {
            try {
                await window.electronAPI.clearTransferHistory()
                // Refetch the transfer queue to update the UI
                refetchQueue()
            } catch (error) {
                console.error('Failed to clear transfer history:', error)
                alert('Failed to clear transfer history')
            }
        }
    }

    const handleOpenFileHistory = async () => {
        try {
            const history = await window.electronAPI.getFileHistory()
            setFileHistory(history)
        } catch (error) {
            console.error('Failed to load file history:', error)
        }
    }

    const handleClearFileHistory = async () => {
        if (confirm('Are you sure you want to clear the opened file history?')) {
            try {
                await window.electronAPI.clearFileHistory()
                setFileHistory([])
            } catch (error) {
                console.error('Failed to clear file history:', error)
                alert('Failed to clear file history')
            }
        }
    }

    const handleOpenFileFromHistory = (path: string, historyProfileId: string | null) => {
        let activeConnectionId: string | undefined = undefined
        let isLocal = true

        if (historyProfileId) {
            // Find active connection with this profile ID
            const activeConnection = Array.from(connectionState.activeConnections.values())
                .find(c => c.profile.id === historyProfileId)

            if (!activeConnection || !activeConnection.status.connected) {
                alert('You must be connected to the correct server to open this file.')
                return
            }
            activeConnectionId = activeConnection.id // This is the session ID
            isLocal = false
        }

        const file = {
            name: path.split(/[/\\]/).pop() || path,
            path: path,
            isDirectory: false,
            size: 0,
            lastModified: 0,
            permissions: '',
            type: 'file'
        }

        import('./FileEditorManager').then(({ openFileEditor }) => {
            openFileEditor(file, activeConnectionId, isLocal, historyProfileId || undefined)
        })
    }

    return (
        <div className="flex flex-col h-full">
            {/* Compact header */}
            <div className="flex items-center justify-between px-3 py-1 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleUpload}
                        disabled={selectedLocalFiles.length === 0 || !isConnected}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors"
                    >
                        Upload ({selectedLocalFiles.length})
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={selectedRemoteFiles.length === 0 || !isConnected}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors"
                    >
                        Download ({selectedRemoteFiles.length})
                    </button>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => setBookmarkDialogOpen(true)}
                        disabled={!isConnected}
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 transition-colors"
                        title="Save bookmark"
                    >
                        <BookmarkHeroIcon className="h-4 w-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setBookmarkListPosition({
                                x: rect.left,
                                y: rect.bottom + 2
                            })
                            setBookmarkListOpen(true)
                        }}
                        disabled={bookmarks.length === 0}
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 transition-colors"
                        title="View bookmarks"
                    >
                        <BookOpenIcon className="h-4 w-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setHistoryListPosition({
                                x: rect.left,
                                y: rect.bottom + 2
                            })
                            setHistoryListOpen(true)
                        }}
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Transfer history"
                    >
                        <ArrowsRightLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setFileHistoryListPosition({
                                x: rect.left,
                                y: rect.bottom + 2
                            })
                            handleOpenFileHistory()
                            setFileHistoryListOpen(true)
                        }}
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Opened files history"
                    >
                        <ClockIcon className="h-4 w-4" />
                    </button>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                        {!isConnected && 'Not connected'}
                    </div>
                </div>
            </div>

            {/* File panes container - take remaining space */}
            <div id="file-manager-container" className="flex flex-1 min-h-0 relative">
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Pane (Local) */}
                    <div style={{ width: `${leftPaneWidth}%` }} className="flex flex-col border-r border-gray-200 dark:border-gray-700">
                        <FileExplorer
                            title="Local Files"
                            path={localPath}
                            onPathChange={handleLocalPathChange}
                            selectedFiles={selectedLocalFiles}
                            onSelectionChange={setSelectedLocalFiles}
                            isLocal={true}
                            onUpload={handleUpload}
                            isActive={isActive}
                        />
                    </div>

                    {/* Resizer */}
                    <div
                        className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors z-10"
                        onMouseDown={handleMouseDown}
                    />

                    {/* Right Pane (Remote) */}
                    <div style={{ width: `${100 - leftPaneWidth}%` }} className="flex flex-col">
                        <FileExplorer
                            connectionId={connectionId}
                            profileId={connection?.profile?.id}
                            title={connection?.profile?.name || 'Remote Files'}
                            path={remotePath}
                            onPathChange={handleRemotePathChange}
                            selectedFiles={selectedRemoteFiles}
                            onSelectionChange={setSelectedRemoteFiles}
                            isLocal={false}
                            disabled={!isConnected}
                            onDownload={handleDownload}
                            isActive={isActive}
                        />
                    </div>
                </div>

                {/* Bookmark Dialog */}
                {bookmarkDialogOpen && (
                    <BookmarkDialog
                        isOpen={bookmarkDialogOpen}
                        onClose={() => setBookmarkDialogOpen(false)}
                        onSave={handleSaveBookmark}
                        profileId={connection?.profile?.id || ''}
                        localPath={localPath}
                        remotePath={remotePath}
                    />
                )}

                {/* Bookmark List */}
                {bookmarkListOpen && (
                    <BookmarkList
                        bookmarks={bookmarks}
                        onSelectBookmark={handleSelectBookmark}
                        onDeleteBookmark={handleDeleteBookmark}
                        onClose={() => setBookmarkListOpen(false)}
                        x={bookmarkListPosition.x}
                        y={bookmarkListPosition.y}
                    />
                )}

                {/* History List */}
                {historyListOpen && (
                    <HistoryList
                        transfers={transferState.completedTransfers}
                        onClose={() => setHistoryListOpen(false)}
                        onClearHistory={handleClearHistory}
                        x={historyListPosition.x}
                        y={historyListPosition.y}
                    />
                )}

                {/* File History List */}
                {fileHistoryListOpen && (
                    <FileHistoryList
                        history={fileHistory}
                        onClose={() => setFileHistoryListOpen(false)}
                        onClearHistory={handleClearFileHistory}
                        onOpenFile={handleOpenFileFromHistory}
                        onDelete={async (id) => {
                            try {
                                await window.electronAPI.removeFileHistoryItem(id)
                                // Refresh history
                                const history = await window.electronAPI.getFileHistory()
                                setFileHistory(history)
                            } catch (error) {
                                console.error('Failed to remove file history item:', error)
                            }
                        }}
                        x={fileHistoryListPosition.x}
                        y={fileHistoryListPosition.y}
                    />
                )}
            </div>
        </div>
    )
}