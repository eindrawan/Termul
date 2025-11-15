import React, { useState, useEffect } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

interface PassphraseDialogProps {
    isOpen: boolean
    keyPath: string
    onSubmit: (passphrase: string) => void
    onCancel: () => void
}

export default function PassphraseDialog({ isOpen, keyPath, onSubmit, onCancel }: PassphraseDialogProps) {
    const [passphrase, setPassphrase] = useState('')
    const [showPassphrase, setShowPassphrase] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setPassphrase('')
            setShowPassphrase(false)
        }
    }, [isOpen])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (passphrase.trim()) {
            onSubmit(passphrase.trim())
        }
    }

    const handleCancel = () => {
        setPassphrase('')
        setShowPassphrase(false)
        onCancel()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Enter Passphrase</h2>

                <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        The private key file at the following path requires a passphrase:
                    </p>
                    <p className="text-xs font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded break-all text-gray-800 dark:text-gray-200">
                        {keyPath}
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Passphrase</label>
                        <div className="relative">
                            <input
                                type={showPassphrase ? "text" : "password"}
                                value={passphrase}
                                onChange={(e) => setPassphrase(e.target.value)}
                                className="w-full p-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                                placeholder="Enter passphrase"
                                autoFocus
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                onClick={() => setShowPassphrase(!showPassphrase)}
                            >
                                {showPassphrase ? (
                                    <EyeSlashIcon className="h-5 w-5" />
                                ) : (
                                    <EyeIcon className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!passphrase.trim()}
                            className="px-4 py-2 text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Connect
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}