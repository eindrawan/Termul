import React, { useState } from 'react'
import { Bookmark } from '../types'

interface BookmarkDialogProps {
    isOpen: boolean
    onClose: () => void
    onSave: (bookmark: Omit<Bookmark, 'id' | 'createdAt'>) => void
    profileId: string
    localPath: string
    remotePath: string
    initialName?: string
}

export default function BookmarkDialog({
    isOpen,
    onClose,
    onSave,
    profileId,
    localPath,
    remotePath,
    initialName = ''
}: BookmarkDialogProps) {
    const [name, setName] = useState(initialName)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        onSave({
            profileId,
            name: name.trim(),
            localPath,
            remotePath
        })
        setName('')
        onClose()
    }

    const handleCancel = () => {
        setName('')
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-[420px] overflow-hidden">
                {/* Header */}
                <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-b border-blue-200 dark:border-blue-700">
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Save Bookmark</h2>
                </div>

                <form onSubmit={handleSubmit} className="px-4 py-3">
                    {/* Bookmark Name */}
                    <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 transition-colors"
                            placeholder="Enter bookmark name"
                            autoFocus
                        />
                    </div>

                    {/* Paths */}
                    <div className="space-y-2 mb-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                                Local Path
                            </label>
                            <div className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-600 font-mono truncate">
                                {localPath}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                                Remote Path
                            </label>
                            <div className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-600 font-mono truncate">
                                {remotePath}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}