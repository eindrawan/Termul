import React, { useEffect, useRef } from 'react'
import { ClipboardIcon, DocumentDuplicateIcon, BookmarkIcon } from '@heroicons/react/24/outline'

interface TerminalContextMenuProps {
    x: number
    y: number
    onClose: () => void
    onCopy: () => void
    onPaste: () => void
    onBookmark: () => void
}

export default function TerminalContextMenu({
    x,
    y,
    onClose,
    onCopy,
    onPaste,
    onBookmark
}: TerminalContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [onClose])

    // Adjust position if menu would go off screen
    const menuWidth = 160
    const menuHeight = 120
    const adjustedX = x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 5 : x
    const adjustedY = y + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 5 : y

    return (
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[160px] py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg"
            style={{ left: adjustedX, top: adjustedY }}
        >
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    onCopy()
                    onClose()
                }}
                className="w-full text-left px-4 py-2 text-sm flex items-center text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
            >
                <DocumentDuplicateIcon className="mr-2 h-4 w-4" />
                Copy
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    onPaste()
                    onClose()
                }}
                className="w-full text-left px-4 py-2 text-sm flex items-center text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
            >
                <ClipboardIcon className="mr-2 h-4 w-4" />
                Paste
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    onBookmark()
                    onClose()
                }}
                className="w-full text-left px-4 py-2 text-sm flex items-center text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
            >
                <BookmarkIcon className="mr-2 h-4 w-4" />
                Bookmark Command
            </button>
        </div>
    )
}
