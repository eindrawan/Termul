import React, { useState, useRef, useEffect } from 'react'
import { RectangleStackIcon } from '@heroicons/react/24/outline'
import { useWindowManager } from '../contexts/WindowManagerContext'

export default function WindowList() {
    const { state, focusWindow, restoreWindow } = useWindowManager()
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    
    const windows = Array.from(state.windows.values())
    
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => {
                document.removeEventListener('mousedown', handleClickOutside)
            }
        }
    }, [isOpen])
    
    const handleWindowClick = (windowId: string) => {
        const window = state.windows.get(windowId)
        if (!window) return
        
        if (window.state === 'minimized') {
            restoreWindow(windowId)
        }
        focusWindow(windowId)
        setIsOpen(false)
    }
    
    if (windows.length === 0) {
        return null
    }
    
    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-1 px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
                title="Open Windows"
            >
                <RectangleStackIcon className="h-3.5 w-3.5" />
                <span className="text-xs">{windows.length}</span>
            </button>
            
            {isOpen && (
                <div className="absolute bottom-full right-0 mb-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-xs font-semibold text-gray-700">Open Windows</h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {windows.map((window) => {
                            const isFocused = state.focusedWindowId === window.id
                            const isMinimized = window.state === 'minimized'
                            
                            return (
                                <button
                                    key={window.id}
                                    onClick={() => handleWindowClick(window.id)}
                                    className={`w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                                        isFocused ? 'bg-blue-100' : ''
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-2">
                                                <div className="text-xs font-medium text-gray-900 truncate">
                                                    {window.title}
                                                </div>
                                                {isFocused && (
                                                    <span className="flex-shrink-0 text-xs text-blue-600 font-medium">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            {window.subtitle && (
                                                <div className="text-xs text-gray-500 truncate mt-0.5">
                                                    {window.subtitle}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-shrink-0 ml-2">
                                            {isMinimized && (
                                                <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                                                    Minimized
                                                </span>
                                            )}
                                            {window.state === 'maximized' && (
                                                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                                                    Maximized
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

