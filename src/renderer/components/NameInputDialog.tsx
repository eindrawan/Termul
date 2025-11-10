import React, { useState, useEffect, useRef } from 'react'

interface NameInputDialogProps {
    isOpen: boolean
    title: string
    initialValue?: string
    placeholder?: string
    onConfirm: (name: string) => void
    onCancel: () => void
    validate?: (name: string) => string | null // Returns error message if invalid, null if valid
}

export default function NameInputDialog({
    isOpen,
    title,
    initialValue = '',
    placeholder = 'Enter name',
    onConfirm,
    onCancel,
    validate
}: NameInputDialogProps) {
    const [name, setName] = useState(initialValue)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen) {
            setName(initialValue)
            setError(null)
            // Focus input when dialog opens
            setTimeout(() => {
                inputRef.current?.focus()
                inputRef.current?.select()
            }, 100)
        }
    }, [isOpen, initialValue])

    const handleConfirm = () => {
        if (!name.trim()) {
            setError('Name cannot be empty')
            return
        }

        if (validate) {
            const validationError = validate(name.trim())
            if (validationError) {
                setError(validationError)
                return
            }
        }

        onConfirm(name.trim())
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleConfirm()
        } else if (e.key === 'Escape') {
            onCancel()
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value
        setName(newName)

        // Clear error when user starts typing
        if (error) {
            setError(null)
        }

        // Validate on the fly if validator is provided
        if (validate && newName.trim()) {
            const validationError = validate(newName.trim())
            if (validationError) {
                setError(validationError)
            }
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                <h2 className="text-lg font-semibold mb-4">{title}</h2>

                <div className="mb-4">
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300'
                            }`}
                    />
                    {error && (
                        <p className="text-red-500 text-sm mt-1">{error}</p>
                    )}
                </div>

                <div className="flex justify-end space-x-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!name.trim() || !!error}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    )
}