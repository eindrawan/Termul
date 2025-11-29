import React, { useState, useEffect, useRef } from 'react'
import { FileSystemEntry } from '../types'
import '../types/electron' // Import to ensure the electronAPI types are loaded
import ConfirmDialog from './ConfirmDialog'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// Configure Monaco loader to use local package instead of CDN
loader.config({ monaco })
import { useWindowManager } from '../contexts/WindowManagerContext'
import { useTheme } from '../contexts/ThemeContext'

interface FileEditorProps {
    file: FileSystemEntry | null
    isOpen: boolean
    onClose: () => void
    connectionId?: string
    isLocal: boolean
}

// Generate unique ID for each FileEditor instance
let instanceCounter = 0

export default function FileEditor({
    file,
    isOpen,
    onClose,
    connectionId,
    isLocal
}: FileEditorProps) {
    const { registerWindow, unregisterWindow, getWindow, updateWindow } = useWindowManager()
    const { theme: globalTheme } = useTheme()
    const [content, setContent] = useState('')
    const [originalContent, setOriginalContent] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showCloseConfirm, setShowCloseConfirm] = useState(false)
    const [language, setLanguage] = useState('plaintext')
    const editorRef = useRef<any>(null)

    // Map global theme to Monaco editor theme
    const getMonacoTheme = () => {
        return globalTheme === 'dark' ? 'vs-dark' : 'vs'
    }
    const instanceId = useRef(++instanceCounter)
    const windowId = useRef(`file-editor-${instanceId.current}-${file?.path || 'unknown'}`)
    const onCloseRef = useRef(onClose)
    const contentRef = useRef(content)
    const originalContentRef = useRef(originalContent)

    // Update refs when values change
    useEffect(() => {
        onCloseRef.current = onClose
        contentRef.current = content
        originalContentRef.current = originalContent
    }, [onClose, content, originalContent])

    // Handle window close from Window component
    const handleWindowClose = () => {
        // Check for unsaved changes
        if (contentRef.current !== originalContentRef.current) {
            setShowCloseConfirm(true)
        } else {
            // Directly close the window and notify parent
            unregisterWindow(windowId.current)
            onCloseRef.current()
        }
    }

    // Register/unregister window with WindowManager
    useEffect(() => {
        const previousWindowId = windowId.current
        let newWindowId: string | null = null

        if (isOpen && file) {
            newWindowId = `file-editor-${instanceId.current}-${file.path}`

            // If window ID changed, unregister the old window
            if (previousWindowId && previousWindowId !== newWindowId) {
                unregisterWindow(previousWindowId)
            }

            windowId.current = newWindowId

            if (!getWindow(windowId.current)) {
                registerWindow({
                    id: windowId.current,
                    title: 'Edit File',
                    subtitle: file.path,
                    content: null, // Content will be rendered by the component
                    defaultPosition: {
                        width: 900,
                        height: 700
                    },
                    minSize: {
                        width: 400,
                        height: 300
                    },
                    position: {
                        x: 0,
                        y: 0,
                        width: 900,
                        height: 700
                    },
                    onClose: () => handleWindowClose()
                })
            }
        } else if (!isOpen && windowId.current) {
            unregisterWindow(windowId.current)
        }

        return () => {
            // Cleanup on unmount - only unregister if this is still the current window
            if (newWindowId && windowId.current === newWindowId) {
                unregisterWindow(windowId.current)
            }
        }
    }, [isOpen, file])

    // Update window content when state changes
    useEffect(() => {
        if (isOpen && file && windowId.current && getWindow(windowId.current)) {
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
                                <span className="ml-2">Loading file...</span>
                            </div>
                        ) : (
                            <Editor
                                height="100%"
                                path={file?.path}
                                language={language}
                                value={content}
                                onChange={(value) => setContent(value || '')}
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
                        )}
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
                                Language: <span className="font-medium">{language}</span>
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleClose}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:ring-offset-1 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isLoading || isSaving || content === originalContent}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded focus:outline-none focus:ring-1 focus:ring-primary-500 focus:ring-offset-1 transition-colors shadow-sm"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )

            updateWindow(windowId.current, {
                title: 'Edit File',
                subtitle: file.path,
                content: windowContent,
                onClose: () => handleWindowClose()
            })
        }
    }, [isOpen, file, content, originalContent, error, isLoading, isSaving, language, globalTheme])

    // Load file content when editor opens
    useEffect(() => {
        if (isOpen && file && file.type === 'file') {
            loadFileContent()
        }
    }, [isOpen, file, isLocal, connectionId])

    // Detect language based on file extension
    useEffect(() => {
        if (file && file.type === 'file') {
            const extension = file.path.split('.').pop()?.toLowerCase()
            const detectedLanguage = getLanguageFromExtension(extension || '')
            setLanguage(detectedLanguage)
        }
    }, [file])

    // Function to map file extensions to Monaco language IDs
    const getLanguageFromExtension = (extension: string): string => {
        const languageMap: { [key: string]: string } = {
            // Web technologies
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'html': 'html',
            'htm': 'html',
            'css': 'css',
            'scss': 'scss',
            'sass': 'sass',
            'less': 'less',
            'json': 'json',
            'xml': 'xml',

            // Programming languages
            'py': 'python',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'cc': 'cpp',
            'cxx': 'cpp',
            'h': 'c',
            'hpp': 'cpp',
            'cs': 'csharp',
            'php': 'php',
            'rb': 'ruby',
            'go': 'go',
            'rs': 'rust',
            'swift': 'swift',
            'kt': 'kotlin',
            'scala': 'scala',
            'dart': 'dart',

            // Configuration and data files
            'yml': 'yaml',
            'yaml': 'yaml',
            'toml': 'toml',
            'ini': 'ini',
            'sql': 'sql',
            'sh': 'shell',
            'bash': 'shell',
            'zsh': 'shell',
            'fish': 'shell',
            'ps1': 'powershell',
            'bat': 'batch',
            'cmd': 'batch',

            // Documentation
            'md': 'markdown',
            'markdown': 'markdown',
            'txt': 'plaintext',
            'log': 'plaintext',

            // Other
            'dockerfile': 'dockerfile',
            'gitignore': 'plaintext',
            'env': 'plaintext',
        }

        return languageMap[extension] || 'plaintext'
    }

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

    const loadFileContent = async () => {
        if (!file) return

        setIsLoading(true)
        setError(null)

        try {
            let fileContent: string
            if (isLocal) {
                fileContent = await window.electronAPI.readLocalFile(file.path)
            } else if (connectionId) {
                fileContent = await window.electronAPI.readRemoteFile(connectionId, file.path)
            } else {
                throw new Error('No connection available for remote file')
            }

            setContent(fileContent)
            setOriginalContent(fileContent)
        } catch (err) {
            setError(`Failed to load file: ${err}`)
            console.error('Failed to load file:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        if (!file) return

        setIsSaving(true)
        setError(null)

        try {
            if (isLocal) {
                await window.electronAPI.writeLocalFile(file.path, content)
            } else if (connectionId) {
                await window.electronAPI.writeRemoteFile(connectionId, file.path, content)
            } else {
                throw new Error('No connection available for remote file')
            }

            setOriginalContent(content)
            // Don't close the window after successful save
        } catch (err) {
            setError(`Failed to save file: ${err}`)
            console.error('Failed to save file:', err)
        } finally {
            setIsSaving(false)
        }
    }

    const handleClose = () => {
        if (content !== originalContent) {
            setShowCloseConfirm(true)
        } else {
            onClose()
        }
    }

    const confirmClose = () => {
        setShowCloseConfirm(false)
        unregisterWindow(windowId.current)
        onCloseRef.current()
    }

    return (
        <ConfirmDialog
            isOpen={showCloseConfirm}
            title="Unsaved Changes"
            message="You have unsaved changes. Are you sure you want to close?"
            confirmText="Close"
            cancelText="Cancel"
            onConfirm={confirmClose}
            onCancel={() => setShowCloseConfirm(false)}
            variant="warning"
        />
    )
}