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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
                <h2 className="text-lg font-semibold mb-4">Save Bookmark</h2>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Bookmark Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter bookmark name"
                            autoFocus
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Local Path
                        </label>
                        <div className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded">
                            {localPath}
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Remote Path
                        </label>
                        <div className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded">
                            {remotePath}
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}