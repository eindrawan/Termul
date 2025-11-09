import React, { useState } from 'react'
import { useConnection } from '../contexts/ConnectionContext'
import { useTransfer } from '../contexts/TransferContext'
import { FileSystemEntry, TransferDescriptor } from '../types'
import FileExplorer from './FileExplorer'
import '../types/electron' // Import to ensure the electronAPI types are loaded

interface FileManagerProps {
    connectionId: string
    localPath: string
    onLocalPathChange: (path: string) => void
    remotePath: string
    onRemotePathChange: (path: string) => void
}

export default function FileManager({
    connectionId,
    localPath,
    onLocalPathChange,
    remotePath,
    onRemotePathChange
}: FileManagerProps) {
    const [selectedLocalFiles, setSelectedLocalFiles] = useState<FileSystemEntry[]>([])
    const [selectedRemoteFiles, setSelectedRemoteFiles] = useState<FileSystemEntry[]>([])
    const [leftPaneWidth, setLeftPaneWidth] = useState(50) // percentage
    const [isResizing, setIsResizing] = useState(false)

    const { state: connectionState } = useConnection()
    const { enqueueMutation } = useTransfer()

    const connection = connectionState.activeConnections.get(connectionId)
    const isConnected = connection?.status.connected || false

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

    return (
        <div className="flex flex-col h-full">
            {/* Compact header */}
            <div className="flex items-center justify-between px-3 py-1 bg-white border-b flex-shrink-0">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleUpload}
                        disabled={selectedLocalFiles.length === 0 || !isConnected}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                        Upload ({selectedLocalFiles.length})
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={selectedRemoteFiles.length === 0 || !isConnected}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                        Download ({selectedRemoteFiles.length})
                    </button>
                </div>
                <div className="text-xs text-gray-600">
                    {!isConnected && 'Not connected'}
                </div>
            </div>

            {/* File panes container - take remaining space */}
            <div id="file-manager-container" className="flex flex-1 min-h-0 relative">
                {/* Local File Explorer */}
                <div
                    className="border-r transition-all duration-150"
                    style={{ width: `${leftPaneWidth}%` }}
                >
                    <FileExplorer
                        title="Local Files"
                        path={localPath}
                        onPathChange={onLocalPathChange}
                        selectedFiles={selectedLocalFiles}
                        onSelectionChange={setSelectedLocalFiles}
                        isLocal={true}
                    />
                </div>

                {/* Resizer */}
                <div
                    className={`w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors ${isResizing ? 'bg-blue-500' : ''
                        }`}
                    onMouseDown={handleMouseDown}
                >
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-0.5 h-8 bg-gray-400 rounded"></div>
                    </div>
                </div>

                {/* Remote File Explorer */}
                <div
                    className="transition-all duration-150"
                    style={{ width: `${100 - leftPaneWidth}%` }}
                >
                    <FileExplorer
                        connectionId={connectionId}
                        title="Remote Files"
                        path={remotePath}
                        onPathChange={onRemotePathChange}
                        selectedFiles={selectedRemoteFiles}
                        onSelectionChange={setSelectedRemoteFiles}
                        isLocal={false}
                        disabled={!isConnected}
                    />
                </div>
            </div>
        </div>
    )
}