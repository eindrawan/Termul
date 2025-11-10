import React, { useState, useEffect } from 'react'
import { FileSystemEntry } from '../types'
import '../types/electron' // Import to ensure the electronAPI types are loaded
import DraggableWindow from './DraggableWindow'
import ConfirmDialog from './ConfirmDialog'

interface FileEditorProps {
    file: FileSystemEntry | null
    isOpen: boolean
    onClose: () => void
    connectionId?: string
    isLocal: boolean
}

export default function FileEditor({
    file,
    isOpen,
    onClose,
    connectionId,
    isLocal
}: FileEditorProps) {
    const [content, setContent] = useState('')
    const [originalContent, setOriginalContent] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showCloseConfirm, setShowCloseConfirm] = useState(false)

    // Load file content when editor opens
    useEffect(() => {
        if (isOpen && file && file.type === 'file') {
            loadFileContent()
        }
    }, [isOpen, file, isLocal, connectionId])

    const loadFileContent = async () => {
        if (!file) return

        setIsLoading(true)
        setError(null)

        try {
            let fileContent: string
            if (isLocal) {
                fileContent = await window.electronAPI.readLocalFile(file.path)
            } else if (connectionId) {
                fileContent = await window.electronAPI.readRemoteFile(connectionId, file.path)
            } else {
                throw new Error('No connection available for remote file')
            }

            setContent(fileContent)
            setOriginalContent(fileContent)
        } catch (err) {
            setError(`Failed to load file: ${err}`)
            console.error('Failed to load file:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        if (!file) return

        setIsSaving(true)
        setError(null)

        try {
            if (isLocal) {
                await window.electronAPI.writeLocalFile(file.path, content)
            } else if (connectionId) {
                await window.electronAPI.writeRemoteFile(connectionId, file.path, content)
            } else {
                throw new Error('No connection available for remote file')
            }

            setOriginalContent(content)
            onClose()
        } catch (err) {
            setError(`Failed to save file: ${err}`)
            console.error('Failed to save file:', err)
        } finally {
            setIsSaving(false)
        }
    }

    const handleClose = () => {
        if (content !== originalContent) {
            setShowCloseConfirm(true)
        } else {
            onClose()
        }
    }

    const confirmClose = () => {
        setShowCloseConfirm(false)
        onClose()
    }

    if (!isOpen || !file) {
        return null
    }

    return (
        <>
            <ConfirmDialog
                isOpen={showCloseConfirm}
                title="Unsaved Changes"
                message="You have unsaved changes. Are you sure you want to close?"
                confirmText="Close"
                cancelText="Cancel"
                onConfirm={confirmClose}
                onCancel={() => setShowCloseConfirm(false)}
                variant="warning"
            />

            <DraggableWindow
                title="Edit File"
                subtitle={file.path}
                isOpen={isOpen}
                onClose={handleClose}
                defaultWidth={900}
                defaultHeight={700}
            >
                <div className="flex flex-col h-full">
                    {/* Error message */}
                    {error && (
                        <div className="p-4 bg-red-50 border-b border-red-200">
                            <p className="text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 p-4 overflow-hidden">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                                <span className="ml-2">Loading file...</span>
                            </div>
                        ) : (
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                className="w-full h-full p-2 border border-gray-300 rounded font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="File content will appear here..."
                                spellCheck={false}
                            />
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                        <div className="text-sm text-gray-600">
                            {content !== originalContent && (
                                <span className="text-orange-600">● Unsaved changes</span>
                            )}
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isLoading || isSaving || content === originalContent}
                                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            </DraggableWindow>
        </>
    )
}