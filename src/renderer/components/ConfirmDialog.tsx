import React from 'react'

interface ConfirmDialogProps {
    isOpen: boolean
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    onCancel: () => void
    variant?: 'danger' | 'warning' | 'info'
}

export default function ConfirmDialog({
    isOpen,
    title = 'Confirm',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'info'
}: ConfirmDialogProps) {
    if (!isOpen) return null

    const getVariantStyles = () => {
        switch (variant) {
            case 'danger':
                return {
                    button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
                    icon: '⚠️'
                }
            case 'warning':
                return {
                    button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
                    icon: '⚠️'
                }
            default:
                return {
                    button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
                    icon: 'ℹ️'
                }
        }
    }

    const styles = getVariantStyles()

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                <div className="flex items-start space-x-3">
                    <div className="text-2xl">{styles.icon}</div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">{title}</h3>
                        <p className="text-gray-700 mb-6">{message}</p>
                    </div>
                </div>
                
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                        autoFocus
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${styles.button}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}

