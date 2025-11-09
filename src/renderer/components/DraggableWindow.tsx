import React, { useState, useRef, useEffect } from 'react'
import { MinusIcon, Square2StackIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface DraggableWindowProps {
    title: string
    subtitle?: string
    isOpen: boolean
    onClose: () => void
    children: React.ReactNode
    defaultWidth?: number
    defaultHeight?: number
    minWidth?: number
    minHeight?: number
    className?: string
}

interface WindowPosition {
    x: number
    y: number
    width: number
    height: number
}

export default function DraggableWindow({
    title,
    subtitle,
    isOpen,
    onClose,
    children,
    defaultWidth = 800,
    defaultHeight = 600,
    minWidth = 400,
    minHeight = 300,
    className = ""
}: DraggableWindowProps) {
    const [isMaximized, setIsMaximized] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [position, setPosition] = useState<WindowPosition>({
        x: 0,
        y: 0,
        width: defaultWidth,
        height: defaultHeight
    })

    const windowRef = useRef<HTMLDivElement>(null)
    const dragStartPos = useRef({ x: 0, y: 0 })
    const windowStartPos = useRef({ x: 0, y: 0 })
    const resizeStartPos = useRef({ x: 0, y: 0, width: 0, height: 0 })

    // Center window on initial open
    useEffect(() => {
        if (isOpen && !isMaximized && !isMinimized) {
            const centerX = (window.innerWidth - defaultWidth) / 2
            const centerY = (window.innerHeight - defaultHeight) / 2
            setPosition(prev => ({
                ...prev,
                x: centerX,
                y: centerY
            }))
        }
    }, [isOpen, defaultWidth, defaultHeight, isMaximized, isMinimized])

    // Handle mouse move for dragging
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging && !isMaximized) {
                const deltaX = e.clientX - dragStartPos.current.x
                const deltaY = e.clientY - dragStartPos.current.y
                setPosition(prev => ({
                    ...prev,
                    x: windowStartPos.current.x + deltaX,
                    y: windowStartPos.current.y + deltaY
                }))
            } else if (isResizing && !isMaximized) {
                const deltaX = e.clientX - resizeStartPos.current.x
                const deltaY = e.clientY - resizeStartPos.current.y
                setPosition(prev => ({
                    ...prev,
                    width: Math.max(minWidth, resizeStartPos.current.width + deltaX),
                    height: Math.max(minHeight, resizeStartPos.current.height + deltaY)
                }))
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
    }, [isDragging, isResizing, isMaximized, minWidth, minHeight])

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isMaximized) return
        setIsDragging(true)
        dragStartPos.current = { x: e.clientX, y: e.clientY }
        windowStartPos.current = { x: position.x, y: position.y }
    }

    const handleResizeMouseDown = (e: React.MouseEvent) => {
        if (isMaximized) return
        e.stopPropagation()
        setIsResizing(true)
        resizeStartPos.current = {
            x: e.clientX,
            y: e.clientY,
            width: position.width,
            height: position.height
        }
    }

    const handleMaximize = () => {
        setIsMaximized(!isMaximized)
        setIsMinimized(false)
    }

    const handleMinimize = () => {
        setIsMinimized(true)
    }

    const handleRestore = () => {
        setIsMinimized(false)
    }

    if (!isOpen) {
        return null
    }

    // Minimized state - show taskbar-like item
    if (isMinimized) {
        return (
            <div className="fixed bottom-4 left-4 z-50">
                <div
                    onClick={handleRestore}
                    className="bg-gray-800 text-white px-4 py-2 rounded-t-lg cursor-pointer hover:bg-gray-700 transition-colors flex items-center space-x-2 shadow-lg"
                >
                    <span className="text-sm">{title}</span>
                    {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
                </div>
            </div>
        )
    }

    const windowStyle: React.CSSProperties = {
        position: 'fixed',
        left: isMaximized ? 0 : position.x,
        top: isMaximized ? 0 : position.y,
        width: isMaximized ? '100vw' : position.width,
        height: isMaximized ? '100vh' : position.height,
        zIndex: 50,
    }

    return (
        <div
            ref={windowRef}
            className={`bg-gray-800 text-white shadow-2xl flex flex-col overflow-hidden ${className}`}
            style={windowStyle}
        >
            {/* Title Bar */}
            <div
                className="flex items-center justify-between px-4 py-2 bg-gray-900 cursor-move border-b border-gray-700"
                onMouseDown={handleMouseDown}
            >
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{title}</div>
                    {subtitle && (
                        <div className="text-xs text-gray-400 truncate">{subtitle}</div>
                    )}
                </div>
                <div className="flex items-center space-x-1 ml-2">
                    <button
                        onClick={handleMinimize}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title="Minimize"
                    >
                        <MinusIcon className="h-4 w-4" />
                    </button>
                    <button
                        onClick={handleMaximize}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title={isMaximized ? "Restore" : "Maximize"}
                    >
                        <Square2StackIcon className="h-4 w-4" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-red-600 rounded transition-colors"
                        title="Close"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden bg-white text-gray-900">
                {children}
            </div>

            {/* Resize Handle */}
            {!isMaximized && (
                <div
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                    onMouseDown={handleResizeMouseDown}
                >
                    <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-gray-600"></div>
                </div>
            )}
        </div>
    )
}