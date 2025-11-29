import React, { useState, useEffect, useRef } from 'react'
import { FileSystemEntry } from '../types'
import { useWindowManager } from '../contexts/WindowManagerContext'
import {
    MagnifyingGlassPlusIcon,
    MagnifyingGlassMinusIcon,
    ArrowPathIcon,
    ArrowsPointingOutIcon
} from '@heroicons/react/24/outline'
import { Tooltip } from './Tooltip'

interface ImageViewerProps {
    file: FileSystemEntry
    isOpen: boolean
    onClose: () => void
    connectionId?: string
    isLocal: boolean
}

// Generate unique ID for each ImageViewer instance
let instanceCounter = 0

export default function ImageViewer({
    file,
    isOpen,
    onClose,
    connectionId,
    isLocal
}: ImageViewerProps) {
    const { registerWindow, unregisterWindow, getWindow, updateWindow } = useWindowManager()
    const [imageData, setImageData] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [zoom, setZoom] = useState(1)
    const [rotation, setRotation] = useState(0)

    const instanceId = useRef(++instanceCounter)
    const windowId = useRef(`image-viewer-${instanceId.current}-${file.path}`)
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

    // Load image content
    const loadImage = async () => {
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

            // Determine mime type based on extension
            const ext = file.name.split('.').pop()?.toLowerCase()
            let mimeType = 'image/jpeg'
            if (ext === 'png') mimeType = 'image/png'
            if (ext === 'gif') mimeType = 'image/gif'
            if (ext === 'svg') mimeType = 'image/svg+xml'
            if (ext === 'webp') mimeType = 'image/webp'
            if (ext === 'bmp') mimeType = 'image/bmp'

            setImageData(`data:${mimeType};base64,${base64Data}`)
        } catch (err) {
            console.error('Failed to load image:', err)
            setError(`Failed to load image: ${err}`)
        } finally {
            setIsLoading(false)
        }
    }

    // Initial load
    useEffect(() => {
        if (isOpen && file) {
            loadImage()
        }
    }, [isOpen, file, isLocal, connectionId])

    // Register/unregister window with WindowManager
    useEffect(() => {
        const previousWindowId = windowId.current
        let newWindowId: string | null = null

        if (isOpen && file) {
            newWindowId = `image-viewer-${instanceId.current}-${file.path}`

            // If window ID changed, unregister the old window
            if (previousWindowId && previousWindowId !== newWindowId) {
                unregisterWindow(previousWindowId)
            }

            windowId.current = newWindowId

            if (!getWindow(windowId.current)) {
                registerWindow({
                    id: windowId.current,
                    title: 'View Image',
                    subtitle: file.name,
                    content: null, // Content will be rendered by the component
                    defaultPosition: {
                        width: 800,
                        height: 600
                    },
                    minSize: {
                        width: 300,
                        height: 200
                    },
                    position: {
                        x: 0,
                        y: 0,
                        width: 800,
                        height: 600
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
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-2">
                            <Tooltip content="Zoom Out">
                                <button
                                    onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}
                                    className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                    <MagnifyingGlassMinusIcon className="w-5 h-5" />
                                </button>
                            </Tooltip>
                            <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[3rem] text-center">
                                {Math.round(zoom * 100)}%
                            </span>
                            <Tooltip content="Zoom In">
                                <button
                                    onClick={() => setZoom(z => Math.min(5, z + 0.1))}
                                    className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                    <MagnifyingGlassPlusIcon className="w-5 h-5" />
                                </button>
                            </Tooltip>
                            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
                            <Tooltip content="Rotate">
                                <button
                                    onClick={() => setRotation(r => (r + 90) % 360)}
                                    className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                    <ArrowPathIcon className="w-5 h-5" />
                                </button>
                            </Tooltip>
                            <Tooltip content="Reset">
                                <button
                                    onClick={() => { setZoom(1); setRotation(0); }}
                                    className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                    <ArrowsPointingOutIcon className="w-5 h-5" />
                                </button>
                            </Tooltip>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                        </div>
                    </div>

                    {/* Image Area */}
                    <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
                                <span className="text-gray-500">Loading image...</span>
                            </div>
                        ) : error ? (
                            <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                                {error}
                            </div>
                        ) : imageData ? (
                            <div
                                style={{
                                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                    transition: 'transform 0.2s ease-in-out'
                                }}
                                className="shadow-lg"
                            >
                                <img
                                    src={imageData}
                                    alt={file.name}
                                    className="max-w-full max-h-full object-contain"
                                    draggable={false}
                                />
                            </div>
                        ) : null}
                    </div>
                </div>
            )

            updateWindow(windowId.current, {
                title: 'View Image',
                subtitle: file.name,
                content: windowContent,
                onClose: () => handleWindowClose()
            })
        }
    }, [isOpen, file, imageData, isLoading, error, zoom, rotation])

    return null
}
