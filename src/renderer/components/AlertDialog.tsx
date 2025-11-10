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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                <div className="flex items-start space-x-3">
                    <div className="text-2xl">{styles.icon}</div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">{displayTitle}</h3>
                        <p className="text-gray-700 mb-6 whitespace-pre-wrap">{message}</p>
                    </div>
                </div>
                
                <div className="flex justify-end">
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${styles.button}`}
                        autoFocus
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}

