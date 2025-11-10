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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                <form onSubmit={handleSubmit}>
                    <div className="flex items-start space-x-3 mb-4">
                        <div className="text-2xl">💬</div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">{title}</h3>
                            <p className="text-gray-700 mb-4">{message}</p>
                        </div>
                    </div>
                    
                    <input
                        ref={inputRef}
                        type={inputType}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full p-2 border border-gray-300 rounded mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        >
                            {confirmText}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

