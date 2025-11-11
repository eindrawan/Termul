import React, { useEffect, useRef, useState } from 'react'
import { TerminalBookmark } from '../types'
import ConfirmDialog from './ConfirmDialog'

interface TerminalBookmarkListProps {
    bookmarks: TerminalBookmark[]
    onSelectBookmark: (bookmark: TerminalBookmark) => void
    onDeleteBookmark: (id: string) => void
    onClose: () => void
    x: number
    y: number
}

export default function TerminalBookmarkList({
    bookmarks,
    onSelectBookmark,
    onDeleteBookmark,
    onClose,
    x,
    y
}: TerminalBookmarkListProps) {
    const menuRef = useRef<HTMLDivElement>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filteredBookmarks, setFilteredBookmarks] = useState<TerminalBookmark[]>(bookmarks)
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean
        bookmarkId: string
        bookmarkName: string
    }>({ isOpen: false, bookmarkId: '', bookmarkName: '' })

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose()
            }
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [onClose])

    useEffect(() => {
        const filtered = bookmarks.filter(bookmark =>
            bookmark.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bookmark.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (bookmark.description && bookmark.description.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        setFilteredBookmarks(filtered)
    }, [bookmarks, searchTerm])

    const handleSelect = (bookmark: TerminalBookmark) => {
        onSelectBookmark(bookmark)
        onClose()
    }

    const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation()
        setConfirmDialog({
            isOpen: true,
            bookmarkId: id,
            bookmarkName: name
        })
    }

    const handleConfirmDelete = () => {
        onDeleteBookmark(confirmDialog.bookmarkId)
        setConfirmDialog({ isOpen: false, bookmarkId: '', bookmarkName: '' })
    }

    const handleCancelDelete = () => {
        setConfirmDialog({ isOpen: false, bookmarkId: '', bookmarkName: '' })
    }

    // Adjust position if menu would go off screen
    const adjustPosition = () => {
        const menuWidth = 320
        const menuHeight = 400
        const adjustedX = x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth : x
        const adjustedY = y + menuHeight > window.innerHeight ? window.innerHeight - menuHeight : y
        return { x: adjustedX, y: adjustedY }
    }

    const { x: adjustedX, y: adjustedY } = adjustPosition()

    return (
        <>
            <div
                ref={menuRef}
                className="fixed bg-white border border-gray-300 rounded-md shadow-lg z-50 w-80"
                style={{ left: adjustedX, top: adjustedY }}
            >
                {/* Search input */}
                <div className="p-3 border-b border-gray-200">
                    <input
                        type="text"
                        placeholder="Search terminal bookmarks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                    />
                </div>

                {/* Bookmark list */}
                <div className="max-h-80 overflow-y-auto">
                    {filteredBookmarks.length === 0 ? (
                        <div className="text-gray-500 text-center py-4 text-sm">
                            {searchTerm ? 'No bookmarks found' : 'No terminal bookmarks saved yet'}
                        </div>
                    ) : (
                        filteredBookmarks.map((bookmark) => (
                            <div
                                key={bookmark.id}
                                className="hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                onClick={() => handleSelect(bookmark)}
                            >
                                <div className="p-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900 truncate text-sm">
                                                {bookmark.name}
                                            </div>
                                            <div className="text-xs text-gray-600 truncate mt-1 font-mono bg-gray-50 px-2 py-1 rounded">
                                                {bookmark.command}
                                            </div>
                                            {bookmark.description && (
                                                <div className="text-xs text-gray-500 truncate mt-1">
                                                    {bookmark.description}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => handleDelete(e, bookmark.id!, bookmark.name)}
                                            className="ml-2 text-red-500 hover:text-red-700 text-xs p-1"
                                            title="Delete bookmark"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title="Delete Terminal Bookmark"
                message={`Are you sure you want to delete the terminal bookmark "${confirmDialog.bookmarkName}"?`}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                variant="danger"
            />
        </>
    )
}