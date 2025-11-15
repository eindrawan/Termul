import React, { useState, useEffect, useRef } from 'react'

interface PromptDialogProps {
    isOpen: boolean
    title?: string
    message: string
    defaultValue?: string
    confirmText?: string
    cancelText?: string
    onConfirm: (value: string) => void
    onCancel: () => void
    inputType?: 'text' | 'password'
}

export default function PromptDialog({
    isOpen,
    title = 'Input Required',
    message,
    defaultValue = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    inputType = 'text'
}: PromptDialogProps) {
    const [value, setValue] = useState(defaultValue)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue)
            // Focus the input when dialog opens
            setTimeout(() => {
                inputRef.current?.focus()
                inputRef.current?.select()
            }, 100)
        }
    }, [isOpen, defaultValue])

    if (!isOpen) return null

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onConfirm(value)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onCancel()
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[100] backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden">
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 border-b border-gray-200 dark:border-gray-600 flex items-center space-x-2">
                        <div className="text-lg">💬</div>
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
                    </div>

                    {/* Content */}
                    <div className="px-4 py-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{message}</p>

                        <input
                            ref={inputRef}
                            type={inputType}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 transition-colors"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-2 px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:ring-offset-1 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            type="submit"
                            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1 transition-colors shadow-sm"
                        >
                            {confirmText}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

