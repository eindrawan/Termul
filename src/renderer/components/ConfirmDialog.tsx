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
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[100] backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 flex items-center space-x-2">
                    <div className="text-lg">{styles.icon}</div>
                    <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
                </div>

                {/* Content */}
                <div className="px-4 py-3">
                    <p className="text-sm text-gray-700">{message}</p>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:ring-offset-1 transition-colors"
                        autoFocus
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-3 py-1.5 text-xs font-medium text-white rounded focus:outline-none focus:ring-1 focus:ring-offset-1 transition-colors shadow-sm ${styles.button}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}

