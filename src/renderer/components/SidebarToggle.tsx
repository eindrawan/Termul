import React from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Tooltip } from './Tooltip'

interface SidebarToggleProps {
    isSidebarOpen: boolean
    onToggle: () => void
}

export default function SidebarToggle({ isSidebarOpen, onToggle }: SidebarToggleProps) {
    return (
        <Tooltip content={isSidebarOpen ? "Hide sidebar" : "Show sidebar"} position="right">
            <div
                className="w-1 bg-gray-300 dark:bg-gray-600 hover:bg-primary-500 dark:hover:bg-primary-400 cursor-pointer transition-all duration-200 group relative"
                onClick={onToggle}
            >
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {isSidebarOpen ? (
                        <ChevronLeftIcon className="h-4 w-4 text-white" />
                    ) : (
                        <ChevronRightIcon className="h-4 w-4 text-white" />
                    )}
                </div>
            </div>
        </Tooltip>
    )
}