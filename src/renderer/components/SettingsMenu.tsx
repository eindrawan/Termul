import React, { useState, useRef, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { Cog6ToothIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { Tooltip } from './Tooltip'

export default function SettingsMenu() {
    const { theme, toggleTheme } = useTheme()
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    return (
        <div className="relative" ref={menuRef}>
            <Tooltip content="Settings" position="top">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                    <Cog6ToothIcon className="h-5 w-5" />
                </button>
            </Tooltip>

            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-50">
                    <div className="py-1">
                        <button
                            onClick={() => {
                                toggleTheme()
                                setIsOpen(false)
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                        >
                            <span>Theme</span>
                            <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {theme === 'light' ? 'Light' : 'Dark'}
                                </span>
                                {theme === 'light' ? (
                                    <SunIcon className="h-4 w-4 text-gray-500" />
                                ) : (
                                    <MoonIcon className="h-4 w-4 text-gray-400" />
                                )}
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}