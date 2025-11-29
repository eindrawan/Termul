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
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[9999] backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 border-b border-gray-200 dark:border-gray-600 flex items-center space-x-2">
                    <div className="text-lg">{styles.icon}</div>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
                </div>

                {/* Content */}
                <div className="px-4 py-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-2 px-4 py-2.5 border-t border-gray-100 dark:border-gray-700">
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:ring-offset-1 transition-colors"
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

