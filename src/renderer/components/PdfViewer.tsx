import React, { useState, useEffect, useRef } from 'react'
import { FileSystemEntry } from '../types'
import { useWindowManager } from '../contexts/WindowManagerContext'

interface PdfViewerProps {
    file: FileSystemEntry
    isOpen: boolean
    onClose: () => void
    connectionId?: string
    isLocal: boolean
}

// Generate unique ID for each PdfViewer instance
let instanceCounter = 0

export default function PdfViewer({
    file,
    isOpen,
    onClose,
    connectionId,
    isLocal
}: PdfViewerProps) {
    const { registerWindow, unregisterWindow, getWindow, updateWindow } = useWindowManager()
    const [pdfData, setPdfData] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const instanceId = useRef(++instanceCounter)
    const windowId = useRef(`pdf-viewer-${instanceId.current}-${file.path}`)
    const onCloseRef = useRef(onClose)

    // Update refs when values change
    useEffect(() => {
        onCloseRef.current = onClose
    }, [onClose])

    // Handle window close from Window component
    const handleWindowClose = () => {
        unregisterWindow(windowId.current)
        onCloseRef.current()
    }

    // Load PDF content
    const loadPdf = async () => {
        setIsLoading(true)
        setError(null)
        try {
            let base64Data: string
            if (isLocal) {
                base64Data = await window.electronAPI.readLocalFileBase64(file.path)
            } else if (connectionId) {
                base64Data = await window.electronAPI.readRemoteFileBase64(connectionId, file.path)
            } else {
                throw new Error('No connection available for remote file')
            }

            setPdfData(`data:application/pdf;base64,${base64Data}`)
        } catch (err) {
            console.error('Failed to load PDF:', err)
            setError(`Failed to load PDF: ${err}`)
        } finally {
            setIsLoading(false)
        }
    }

    // Initial load
    useEffect(() => {
        if (isOpen && file) {
            loadPdf()
        }
    }, [isOpen, file, isLocal, connectionId])

    // Register/unregister window with WindowManager
    useEffect(() => {
        const previousWindowId = windowId.current
        let newWindowId: string | null = null

        if (isOpen && file) {
            newWindowId = `pdf-viewer-${instanceId.current}-${file.path}`

            // If window ID changed, unregister the old window
            if (previousWindowId && previousWindowId !== newWindowId) {
                unregisterWindow(previousWindowId)
            }

            windowId.current = newWindowId

            if (!getWindow(windowId.current)) {
                registerWindow({
                    id: windowId.current,
                    title: 'View PDF',
                    subtitle: file.name,
                    content: null, // Content will be rendered by the component
                    defaultPosition: {
                        width: 900,
                        height: 800
                    },
                    minSize: {
                        width: 400,
                        height: 300
                    },
                    position: {
                        x: 0,
                        y: 0,
                        width: 900,
                        height: 800
                    },
                    onClose: () => handleWindowClose()
                })
            }
        } else if (!isOpen && windowId.current) {
            unregisterWindow(windowId.current)
        }

        return () => {
            if (newWindowId && windowId.current === newWindowId) {
                unregisterWindow(windowId.current)
            }
        }
    }, [isOpen, file])

    // Update window content
    useEffect(() => {
        if (isOpen && file && windowId.current && getWindow(windowId.current)) {
            const windowContent = (
                <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
                    {/* Toolbar - Optional, browser PDF viewer usually has its own */}
                    <div className="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                        {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                    </div>

                    {/* PDF Area */}
                    <div className="flex-1 overflow-hidden relative">
                        {isLoading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
                                <span className="text-gray-500">Loading PDF...</span>
                            </div>
                        ) : error ? (
                            <div className="absolute inset-0 flex items-center justify-center p-4">
                                <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                                    {error}
                                </div>
                            </div>
                        ) : pdfData ? (
                            <iframe
                                src={pdfData}
                                className="w-full h-full border-none"
                                title={file.name}
                            />
                        ) : null}
                    </div>
                </div>
            )

            updateWindow(windowId.current, {
                title: 'View PDF',
                subtitle: file.name,
                content: windowContent,
                onClose: () => handleWindowClose()
            })
        }
    }, [isOpen, file, pdfData, isLoading, error])

    return null
}
