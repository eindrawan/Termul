import React from 'react'

interface AlertDialogProps {
    isOpen: boolean
    title?: string
    message: string
    confirmText?: string
    onConfirm: () => void
    variant?: 'success' | 'error' | 'warning' | 'info'
}

export default function AlertDialog({
    isOpen,
    title,
    message,
    confirmText = 'OK',
    onConfirm,
    variant = 'info'
}: AlertDialogProps) {
    if (!isOpen) return null

    const getVariantStyles = () => {
        switch (variant) {
            case 'success':
                return {
                    button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
                    icon: '✓',
                    defaultTitle: 'Success'
                }
            case 'error':
                return {
                    button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
                    icon: '✕',
                    defaultTitle: 'Error'
                }
            case 'warning':
                return {
                    button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
                    icon: '⚠️',
                    defaultTitle: 'Warning'
                }
            default:
                return {
                    button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
                    icon: 'ℹ️',
                    defaultTitle: 'Information'
                }
        }
    }

    const styles = getVariantStyles()
    const displayTitle = title || styles.defaultTitle

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[100] backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 border-b border-gray-200 dark:border-gray-600 flex items-center space-x-2">
                    <div className="text-lg">{styles.icon}</div>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{displayTitle}</h3>
                </div>

                {/* Content */}
                <div className="px-4 py-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{message}</p>
                </div>

                {/* Actions */}
                <div className="flex justify-end px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                    <button
                        onClick={onConfirm}
                        className={`px-3 py-1.5 text-xs font-medium text-white rounded focus:outline-none focus:ring-1 focus:ring-offset-1 transition-colors shadow-sm ${styles.button}`}
                        autoFocus
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}

