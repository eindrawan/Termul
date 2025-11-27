import React, { useState, useEffect, useRef } from 'react'
import { XMarkIcon, DocumentCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useWindowManager } from '../contexts/WindowManagerContext'
import { useTheme } from '../contexts/ThemeContext'
import Editor from '@monaco-editor/react'
import '../types/electron' // Import to ensure the electronAPI types are loaded

interface CrontabEditorProps {
    connectionId: string
    connectionName: string
    crontabType?: 'user' | 'root'
    isOpen?: boolean
    onClose?: () => void
}

export default function CrontabEditor({ connectionId, connectionName, crontabType = 'user', isOpen = true, onClose }: CrontabEditorProps) {
    const { registerWindow, unregisterWindow, getWindow, updateWindow } = useWindowManager()
    const { theme: globalTheme } = useTheme()
    const [content, setContent] = useState('')
    const [originalContent, setOriginalContent] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [showPasswordDialog, setShowPasswordDialog] = useState(false)
    const [sudoPassword, setSudoPassword] = useState('')
    const editorRef = useRef<any>(null)

    // Generate unique ID for each CrontabEditor instance
    const windowId = `crontab-editor-${crontabType}-${connectionId}`

    // Map global theme to Monaco editor theme
    const getMonacoTheme = () => {
        return globalTheme === 'dark' ? 'vs-dark' : 'vs'
    }

    // Register/unregister window with WindowManager
    useEffect(() => {
        if (!isOpen) {
            if (windowId) {
                unregisterWindow(windowId)
            }
            return
        }

        registerWindow({
            id: windowId,
            title: 'Edit File',
            subtitle: connectionName,
            content: null, // Content will be rendered by the component
            defaultPosition: {
                width: 1000,
                height: 700
            },
            minSize: {
                width: 600,
                height: 400
            },
            position: {
                x: 0,
                y: 0,
                width: 1000,
                height: 700
            },
            onClose: () => {
                if (content !== originalContent) {
                    if (confirm('You have unsaved changes. Are you sure you want to close?')) {
                        unregisterWindow(windowId)
                        onClose?.()
                    }
                } else {
                    unregisterWindow(windowId)
                    onClose?.()
                }
            }
        })

        // Load crontab when window is registered
        loadCrontab()

        return () => {
            unregisterWindow(windowId)
        }
    }, [isOpen, connectionId])

    // Handle editor mount
    const handleEditorDidMount = (editor: any, monaco: any) => {
        editorRef.current = editor

        // Configure editor options
        editor.updateOptions({
            wordWrap: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        })
    }

    // Update window content when state changes
    useEffect(() => {
        if (isOpen && windowId && getWindow(windowId)) {
            const windowContent = (
                <div className="flex flex-col h-full">
                    {/* Error message */}
                    {error && (
                        <div className="p-4 bg-red-50 border-b border-red-200">
                            <p className="text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 p-0 overflow-hidden">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                                <span className="ml-2">Loading crontab...</span>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="flex-1 flex overflow-hidden">
                                    {/* Editor */}
                                    <div className="flex-1 p-4 flex flex-col">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Crontab Content
                                            </label>
                                            <button
                                                onClick={() => {
                                                    const helpText = getCronHelp()
                                                    // Insert at cursor position or append
                                                    if (editorRef.current) {
                                                        const position = editorRef.current.getPosition()
                                                        editorRef.current.executeEdits('insert-help', [{
                                                            range: {
                                                                startLineNumber: position?.lineNumber || 1,
                                                                startColumn: position?.column || 1,
                                                                endLineNumber: position?.lineNumber || 1,
                                                                endColumn: position?.column || 1
                                                            },
                                                            text: helpText,
                                                            forceMoveMarkers: true
                                                        }])
                                                    } else {
                                                        setContent(prev => prev + '\n' + helpText)
                                                    }
                                                }}
                                                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                            >
                                                Insert Help Template
                                            </button>
                                        </div>
                                        <div className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
                                            <Editor
                                                height="100%"
                                                language="shell"
                                                value={content}
                                                onChange={(value) => handleContentChange(value || '')}
                                                onMount={handleEditorDidMount}
                                                theme={getMonacoTheme()}
                                                options={{
                                                    selectOnLineNumbers: true,
                                                    automaticLayout: true,
                                                    wordWrap: 'on',
                                                    minimap: { enabled: false },
                                                    scrollBeyondLastLine: false,
                                                    fontSize: 14,
                                                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                                                    renderLineHighlight: 'line',
                                                    scrollbar: {
                                                        vertical: 'auto',
                                                        horizontal: 'auto',
                                                        useShadows: false,
                                                        verticalHasArrows: false,
                                                        horizontalHasArrows: false,
                                                    },
                                                }}
                                                loading={
                                                    <div className="flex items-center justify-center h-full">
                                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                                                        <span className="ml-2">Loading editor...</span>
                                                    </div>
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Help sidebar */}
                                    <div className="w-80 p-4 border-l dark:border-gray-700 overflow-y-auto">
                                        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Quick Reference</h3>
                                        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                                            <div>
                                                <strong className="text-gray-800 dark:text-gray-200">Fields:</strong>
                                                <div className="mt-1 font-mono text-xs">min hour day month weekday command</div>
                                            </div>
                                            <div>
                                                <strong className="text-gray-800 dark:text-gray-200">Values:</strong>
                                                <ul className="mt-1 space-y-1 text-xs">
                                                    <li>• minute: 0-59</li>
                                                    <li>• hour: 0-23</li>
                                                    <li>• day: 1-31</li>
                                                    <li>• month: 1-12</li>
                                                    <li>• weekday: 0-6 (0=Sunday)</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <strong className="text-gray-800 dark:text-gray-200">Special chars:</strong>
                                                <ul className="mt-1 space-y-1 text-xs">
                                                    <li>• * = any value</li>
                                                    <li>• , = list separator</li>
                                                    <li>• - = range</li>
                                                    <li>• / = step values</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <strong className="text-gray-800 dark:text-gray-200">Examples:</strong>
                                                <ul className="mt-1 space-y-1 text-xs font-mono">
                                                    <li>0 2 * * * /backup.sh</li>
                                                    <li>*/15 * * * * /check.sh</li>
                                                    <li>0 9-17 * * 1-5 /work.sh</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                    <div className="flex items-center space-x-3">
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                            {content !== originalContent && (
                                                <span className="text-orange-600 dark:text-orange-400">● Unsaved changes</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                            {validationError && (
                                                <span className="text-red-600 dark:text-red-400">● {validationError}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => unregisterWindow(windowId)}
                                            disabled={isLoading || isSaving}
                                            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:ring-offset-1 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={isLoading || isSaving || content === originalContent || !!validationError}
                                            className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded focus:outline-none focus:ring-1 focus:ring-primary-500 focus:ring-offset-1 transition-colors shadow-sm"
                                        >
                                            {isSaving ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )

            updateWindow(windowId, {
                title: `${crontabType === 'root' ? 'Root' : 'User'} Crontab Editor`,
                subtitle: connectionName,
                content: windowContent,
                onClose: () => {
                    if (content !== originalContent) {
                        if (confirm('You have unsaved changes. Are you sure you want to close?')) {
                            unregisterWindow(windowId)
                            onClose?.()
                        }
                    } else {
                        unregisterWindow(windowId)
                        onClose?.()
                    }
                }
            })
        }
    }, [isOpen, connectionId, connectionName, content, originalContent, error, isLoading, isSaving, validationError, globalTheme])

    const loadCrontab = async () => {
        setIsLoading(true)
        setError(null)

        try {
            // @ts-ignore - Temporarily ignore TypeScript error until API is implemented
            const crontabContent = await window.electronAPI.readCrontab(connectionId, crontabType)
            setContent(crontabContent)
            setOriginalContent(crontabContent)
        } catch (error: any) {
            if (error.message?.includes('Sudo password required')) {
                setShowPasswordDialog(true)
            } else {
                setError(error.message || 'Failed to load crontab')
            }
        } finally {
            setIsLoading(false)
        }
    }

    const validateContent = async (text: string) => {
        try {
            // @ts-ignore - Temporarily ignore TypeScript error until API is implemented
            const result = await window.electronAPI.validateCrontab(text)
            if (result.valid) {
                setValidationError(null)
            } else {
                setValidationError(result.error || 'Invalid crontab syntax')
            }
            return result.valid
        } catch (error) {
            setValidationError('Validation failed')
            return false
        }
    }

    const handleContentChange = async (newContent: string) => {
        setContent(newContent)
        if (newContent.trim()) {
            await validateContent(newContent)
        } else {
            setValidationError(null)
        }
    }

    const handleSave = async () => {
        if (validationError) {
            setError('Please fix validation errors before saving')
            return
        }

        setIsSaving(true)
        setError(null)

        try {
            // @ts-ignore - Temporarily ignore TypeScript error until API is implemented
            await window.electronAPI.writeCrontab(connectionId, content, crontabType)
            setOriginalContent(content)
            unregisterWindow(windowId)
            onClose?.()
        } catch (error: any) {
            if (error.message?.includes('Sudo password required')) {
                setShowPasswordDialog(true)
            } else {
                setError(error.message || 'Failed to save crontab')
            }
        } finally {
            setIsSaving(false)
        }
    }

    const getCronHelp = () => {
        return `# Crontab Format Help
# ┌───────────── minute (0 - 59)
# │ ┌───────────── hour (0 - 23)
# │ │ ┌───────────── day of month (1 - 31)
# │ │ │ ┌───────────── month (1 - 12)
# │ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
# │ │ │ │
# * * * * *  command to execute
# │ │ │ │
# │ │ │ └───── day of week (0 - 6 or SUN-SAT)
# │ │ └────────── month (1 - 12 or JAN-DEC)
# │ └───────────── day of month (1 - 31)
# └──────────────── hour (0 - 23)
# └────────────────── minute (0 - 59)

# Examples:
# 0 2 * * * /usr/bin/backup.sh          # Run backup daily at 2 AM
# 15 14 1 * * /usr/bin/monthly.sh      # Run monthly on 1st at 2:15 PM
# 0,30 * * * * /usr/bin/every-30min.sh # Run every 30 minutes
# */15 * * * * /usr/bin/every-15min.sh # Run every 15 minutes
# 0 9-17 * * 1-5 /usr/bin/work-hours.sh  # Run every hour from 9 AM to 5 PM on weekdays

# Special characters:
# *    - any value
# ,    - value list separator
# -    - range of values
# /    - step values

# Environment variables:
# PATH=/usr/local/bin:/usr/bin:/bin
# SHELL=/bin/bash
# MAILTO=user@example.com`
    }

    const handlePasswordSubmit = async () => {
        if (!sudoPassword.trim()) {
            setError('Password is required')
            return
        }

        try {
            // @ts-ignore - Temporarily ignore TypeScript error until API is implemented
            await window.electronAPI.setCrontabSudoPassword(connectionId, sudoPassword)
            setShowPasswordDialog(false)
            setSudoPassword('')

            // Retry the operation that failed
            if (isLoading) {
                await loadCrontab()
            } else if (isSaving) {
                await handleSave()
            }
        } catch (error: any) {
            setError(error.message || 'Failed to set sudo password')
        }
    }

    // Sudo Password Dialog
    if (showPasswordDialog) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Sudo Password Required
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Enter sudo password to access crontab for {connectionName}
                    </p>
                    <input
                        type="password"
                        value={sudoPassword}
                        onChange={(e) => setSudoPassword(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handlePasswordSubmit()
                            } else if (e.key === 'Escape') {
                                setShowPasswordDialog(false)
                                setSudoPassword('')
                            }
                        }}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter sudo password"
                        autoFocus
                    />
                    <div className="flex justify-end space-x-2 mt-4">
                        <button
                            onClick={() => {
                                setShowPasswordDialog(false)
                                setSudoPassword('')
                            }}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handlePasswordSubmit}
                            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
                        >
                            Submit
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return null // Component content is rendered through window system
}
