import React, { useState } from 'react'
import { useConnection } from '../contexts/ConnectionContext'
import { useTransfer } from '../contexts/TransferContext'
import { FileSystemEntry, TransferDescriptor } from '../types'
import FileExplorer from './FileExplorer'
import '../types/electron' // Import to ensure the electronAPI types are loaded

interface FileManagerProps {
    localPath: string
    onLocalPathChange: (path: string) => void
    remotePath: string
    onRemotePathChange: (path: string) => void
}

export default function FileManager({
    localPath,
    onLocalPathChange,
    remotePath,
    onRemotePathChange
}: FileManagerProps) {
    const [selectedLocalFiles, setSelectedLocalFiles] = useState<FileSystemEntry[]>([])
    const [selectedRemoteFiles, setSelectedRemoteFiles] = useState<FileSystemEntry[]>([])

    const { state: connectionState } = useConnection()
    const { enqueueMutation } = useTransfer()

    const handleUpload = () => {
        if (selectedLocalFiles.length === 0 || !connectionState.status.connected) return

        const transfers: TransferDescriptor[] = selectedLocalFiles.map(file => ({
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
        if (selectedRemoteFiles.length === 0 || !connectionState.status.connected) return

        const transfers: TransferDescriptor[] = selectedRemoteFiles.map(file => ({
            sourcePath: file.path,
            destinationPath: `${localPath}/${file.name}`,
            direction: 'download' as const,
            overwritePolicy: 'prompt' as const,
            priority: 0,
        }))

        enqueueMutation.mutate(transfers)
        setSelectedRemoteFiles([])
    }

    return (
        <div className="flex flex-col h-full">
            {/* Compact header */}
            <div className="flex items-center justify-between px-3 py-1 bg-white border-b flex-shrink-0">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleUpload}
                        disabled={selectedLocalFiles.length === 0 || !connectionState.status.connected}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                        Upload ({selectedLocalFiles.length})
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={selectedRemoteFiles.length === 0 || !connectionState.status.connected}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                        Download ({selectedRemoteFiles.length})
                    </button>
                </div>
                <div className="text-xs text-gray-600">
                    {!connectionState.status.connected && 'Not connected'}
                </div>
            </div>

            {/* File panes container - take remaining space */}
            <div className="flex flex-1 min-h-0">
                {/* Local File Explorer */}
                <div className="w-1/2 border-r">
                    <FileExplorer
                        title="Local Files"
                        path={localPath}
                        onPathChange={onLocalPathChange}
                        selectedFiles={selectedLocalFiles}
                        onSelectionChange={setSelectedLocalFiles}
                        isLocal={true}
                    />
                </div>

                {/* Remote File Explorer */}
                <div className="w-1/2">
                    <FileExplorer
                        title="Remote Files"
                        path={remotePath}
                        onPathChange={onRemotePathChange}
                        selectedFiles={selectedRemoteFiles}
                        onSelectionChange={setSelectedRemoteFiles}
                        isLocal={false}
                        disabled={!connectionState.status.connected}
                    />
                </div>
            </div>
        </div>
    )
}