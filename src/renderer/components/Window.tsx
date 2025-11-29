import React, { useState, useRef, useEffect } from 'react'
import { MinusIcon, Square2StackIcon, XMarkIcon, StopIcon } from '@heroicons/react/24/outline'
import { Tooltip } from './Tooltip'
import { useWindowManager } from '../contexts/WindowManagerContext'

interface WindowProps {
    id: string
    title: string
    subtitle?: string
    children: React.ReactNode
    defaultWidth?: number
    defaultHeight?: number
    minWidth?: number
    minHeight?: number
    onClose?: () => void
}

export default function Window({
    id,
    title,
    subtitle,
    children,
    defaultWidth = 800,
    defaultHeight = 600,
    minWidth = 400,
    minHeight = 300,
    onClose
}: WindowProps) {
    const { state, focusWindow, minimizeWindow, maximizeWindow, restoreWindow, closeWindow, updatePosition } = useWindowManager()
    const windowConfig = state.windows.get(id)

    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const dragStartPos = useRef({ x: 0, y: 0 })
    const windowStartPos = useRef({ x: 0, y: 0 })
    const resizeStartPos = useRef({ x: 0, y: 0, width: 0, height: 0 })

    // Handle mouse move for dragging and resizing
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!windowConfig) return

            if (isDragging && windowConfig.state === 'normal') {
                const deltaX = e.clientX - dragStartPos.current.x
                const deltaY = e.clientY - dragStartPos.current.y
                updatePosition(id, {
                    x: windowStartPos.current.x + deltaX,
                    y: windowStartPos.current.y + deltaY
                })
            } else if (isResizing && windowConfig.state === 'normal') {
                const deltaX = e.clientX - resizeStartPos.current.x
                const deltaY = e.clientY - resizeStartPos.current.y
                updatePosition(id, {
                    width: Math.max(minWidth, resizeStartPos.current.width + deltaX),
                    height: Math.max(minHeight, resizeStartPos.current.height + deltaY)
                })
            }
        }

        const handleMouseUp = () => {
            setIsDragging(false)
            setIsResizing(false)
        }

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            return () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isDragging, isResizing, windowConfig, id, updatePosition, minWidth, minHeight])

    if (!windowConfig) return null

    const handleMouseDown = (e: React.MouseEvent) => {
        if (windowConfig.state !== 'normal') return
        e.preventDefault()
        setIsDragging(true)
        dragStartPos.current = { x: e.clientX, y: e.clientY }
        windowStartPos.current = { x: windowConfig.position.x, y: windowConfig.position.y }
        focusWindow(id)
    }

    const handleResizeMouseDown = (e: React.MouseEvent) => {
        if (windowConfig.state !== 'normal') return
        e.stopPropagation()
        e.preventDefault()
        setIsResizing(true)
        resizeStartPos.current = {
            x: e.clientX,
            y: e.clientY,
            width: windowConfig.position.width,
            height: windowConfig.position.height
        }
    }

    const handleMinimize = () => {
        minimizeWindow(id)
    }

    const handleMaximize = () => {
        if (windowConfig.state === 'maximized') {
            restoreWindow(id)
        } else {
            maximizeWindow(id)
        }
    }

    const handleWindowClick = () => {
        if (state.focusedWindowId !== id) {
            focusWindow(id)
        }
    }

    // Don't render if minimized
    if (windowConfig.state === 'minimized') {
        return null
    }

    const windowStyle: React.CSSProperties = {
        position: 'fixed',
        left: windowConfig.state === 'maximized' ? 0 : windowConfig.position.x,
        top: windowConfig.state === 'maximized' ? 0 : windowConfig.position.y,
        width: windowConfig.state === 'maximized' ? '100vw' : windowConfig.position.width,
        height: windowConfig.state === 'maximized' ? 'calc(100vh - 34px)' : windowConfig.position.height,
        borderRadius: windowConfig.state === 'maximized' ? '0' : '0.5rem',
        zIndex: windowConfig.zIndex,
    }

    const isFocused = state.focusedWindowId === id

    return (
        <div
            className={`bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden rounded-lg transition-shadow ${isFocused ? 'ring-2 ring-gray-800 dark:ring-gray-400' : 'ring-1 ring-gray-300 dark:ring-gray-600'
                }`}
            style={windowStyle}
            onClick={handleWindowClick}
        >
            {/* Title Bar */}
            <div
                className={`flex items-center justify-between px-3 py-1.5 cursor-move border-b select-none ${isFocused ? 'bg-gray-800 text-white border-blue-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600'
                    }`}
                onMouseDown={handleMouseDown}
            >
                <div className="flex-1 min-w-0 flex items-center space-x-2">
                    <div className="font-medium text-xs truncate">{title}</div>
                    {subtitle && (
                        <div className={`text-xs truncate ${isFocused ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                            {subtitle}
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-0.5 ml-2">
                    <Tooltip content="Minimize">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleMinimize()
                            }}
                            className={`p-1 rounded transition-colors ${isFocused
                                ? 'hover:bg-blue-500'
                                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            <MinusIcon className="h-3.5 w-3.5" />
                        </button>
                    </Tooltip>
                    <Tooltip content={windowConfig.state === 'maximized' ? "Restore" : "Maximize"}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleMaximize()
                            }}
                            className={`p-1 rounded transition-colors ${isFocused
                                ? 'hover:bg-blue-500'
                                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            {windowConfig.state === 'maximized' ? (
                                <Square2StackIcon className="h-3.5 w-3.5" />
                            ) : (
                                <StopIcon className="h-3.5 w-3.5" />
                            )}
                        </button>
                    </Tooltip>
                    <Tooltip content="Close">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                closeWindow(id)
                            }}
                            className={`p-1 rounded transition-colors ${isFocused
                                ? 'hover:bg-red-600'
                                : 'hover:bg-red-500 hover:text-white'
                                }`}
                        >
                            <XMarkIcon className="h-3.5 w-3.5" />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden bg-white dark:bg-gray-900">
                {children}
            </div>

            {/* Resize Handle */}
            {windowConfig.state === 'normal' && (
                <div
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
                    onMouseDown={handleResizeMouseDown}
                >
                    <div className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 border-r-2 border-b-2 border-gray-400 dark:border-gray-500 group-hover:border-blue-500 dark:group-hover:border-blue-400"></div>
                </div>
            )}
        </div>
    )
}

