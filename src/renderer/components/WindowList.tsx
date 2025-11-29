import React, { useState, useRef, useEffect } from 'react'
import { Tooltip } from './Tooltip'
import { RectangleStackIcon } from '@heroicons/react/24/outline'
import { useWindowManager } from '../contexts/WindowManagerContext'
import { useTheme } from '../contexts/ThemeContext'

export default function WindowList() {
    const { state, focusWindow, restoreWindow } = useWindowManager()
    const { theme } = useTheme()
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
            <Tooltip content="Open Windows" position="left">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded transition-colors ${theme === 'dark'
                        ? 'hover:bg-gray-700 text-gray-300'
                        : 'hover:bg-gray-200 text-gray-700'
                        }`}
                >
                    <RectangleStackIcon className="h-3.5 w-3.5" />
                    <span className="text-xs">{windows.length}</span>
                </button>
            </Tooltip>

            {isOpen && (
                <div style={{ zIndex: 10000 }} className={`absolute bottom-full right-0 mb-1 w-64 rounded-lg shadow-xl overflow-hidden ${theme === 'dark'
                    ? 'bg-gray-800 border border-gray-700'
                    : 'bg-white border border-gray-200'
                    }`}>
                    <div className={`px-3 py-2 border-b ${theme === 'dark'
                        ? 'bg-gray-700 border-gray-600'
                        : 'bg-gray-50 border-gray-200'
                        }`}>
                        <h3 className={`text-xs font-semibold ${theme === 'dark'
                            ? 'text-gray-200'
                            : 'text-gray-700'
                            }`}>Open Windows</h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {windows.map((window) => {
                            const isFocused = state.focusedWindowId === window.id
                            const isMinimized = window.state === 'minimized'

                            return (
                                <button
                                    key={window.id}
                                    onClick={() => handleWindowClick(window.id)}
                                    className={`w-full px-3 py-2 text-left transition-colors border-b last:border-b-0 ${theme === 'dark'
                                        ? 'hover:bg-gray-700 border-gray-700'
                                        : 'hover:bg-blue-50 border-gray-100'
                                        } ${isFocused
                                            ? theme === 'dark'
                                                ? 'bg-gray-700'
                                                : 'bg-blue-100'
                                            : ''
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-2">
                                                <div className={`text-xs font-medium truncate ${theme === 'dark'
                                                    ? 'text-gray-100'
                                                    : 'text-gray-900'
                                                    }`}>
                                                    {window.title}
                                                </div>
                                                {isFocused && (
                                                    <span className={`flex-shrink-0 text-xs font-medium ${theme === 'dark'
                                                        ? 'text-blue-400'
                                                        : 'text-blue-600'
                                                        }`}>
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            {window.subtitle && (
                                                <div className={`text-xs truncate mt-0.5 ${theme === 'dark'
                                                    ? 'text-gray-400'
                                                    : 'text-gray-500'
                                                    }`}>
                                                    {window.subtitle}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-shrink-0 ml-2">
                                            {isMinimized && (
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${theme === 'dark'
                                                    ? 'bg-yellow-900 text-yellow-300'
                                                    : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    Minimized
                                                </span>
                                            )}
                                            {window.state === 'maximized' && (
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${theme === 'dark'
                                                    ? 'bg-green-900 text-green-300'
                                                    : 'bg-green-100 text-green-700'
                                                    }`}>
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

