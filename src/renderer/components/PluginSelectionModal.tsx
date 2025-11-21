import React from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { AVAILABLE_PLUGINS, PluginTemplate } from '../registry/PluginRegistry'

interface PluginSelectionModalProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (plugin: PluginTemplate) => void
}

export default function PluginSelectionModal({ isOpen, onClose, onSelect }: PluginSelectionModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 transform transition-all">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Add New Tab
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 grid grid-cols-2 gap-4">
                    {AVAILABLE_PLUGINS.map((plugin) => (
                        <button
                            key={plugin.id}
                            onClick={() => onSelect(plugin)}
                            className="flex flex-col items-center justify-center p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group text-center"
                        >
                            <span className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-200">
                                {plugin.icon}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
                                {plugin.label}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 text-xs text-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                    Select a tool to open in a new tab
                </div>
            </div>
        </div>
    )
}
