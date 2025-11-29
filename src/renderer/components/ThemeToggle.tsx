import React from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { Tooltip } from './Tooltip'

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme()

    return (
        <Tooltip content={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} position="bottom">
            <button
                onClick={toggleTheme}
                className="p-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
                {theme === 'light' ? (
                    <MoonIcon className="h-5 w-5" />
                ) : (
                    <SunIcon className="h-5 w-5" />
                )}
            </button>
        </Tooltip>
    )
}