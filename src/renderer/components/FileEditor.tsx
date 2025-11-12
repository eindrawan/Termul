import React, { useState, useEffect, useRef } from 'react'
import { FileSystemEntry } from '../types'
import '../types/electron' // Import to ensure the electronAPI types are loaded
import DraggableWindow from './DraggableWindow'
import ConfirmDialog from './ConfirmDialog'
import Editor from '@monaco-editor/react'

interface FileEditorProps {
    file: FileSystemEntry | null
    isOpen: boolean
    onClose: () => void
    connectionId?: string
    isLocal: boolean
}

export default function FileEditor({
    file,
    isOpen,
    onClose,
    connectionId,
    isLocal
}: FileEditorProps) {
    const [content, setContent] = useState('')
    const [originalContent, setOriginalContent] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showCloseConfirm, setShowCloseConfirm] = useState(false)
    const [language, setLanguage] = useState('plaintext')
    const [theme, setTheme] = useState('vs')
    const editorRef = useRef<any>(null)

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
            onClose()
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
        onClose()
    }

    if (!isOpen || !file) {
        return null
    }

    return (
        <>
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

            <DraggableWindow
                title="Edit File"
                subtitle={file.path}
                isOpen={isOpen}
                onClose={handleClose}
                defaultWidth={900}
                defaultHeight={700}
            >
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
                                language={language}
                                value={content}
                                onChange={(value) => setContent(value || '')}
                                onMount={handleEditorDidMount}
                                theme={theme}
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
                    <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                        <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-600">
                                {content !== originalContent && (
                                    <span className="text-orange-600">● Unsaved changes</span>
                                )}
                            </div>
                            <div className="flex items-center space-x-2">
                                <label htmlFor="theme-select" className="text-sm text-gray-600">Theme:</label>
                                <select
                                    id="theme-select"
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value)}
                                    className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="vs">Light</option>
                                    <option value="vs-dark">Dark</option>
                                    <option value="hc-black">High Contrast</option>
                                </select>
                            </div>
                            <div className="text-sm text-gray-600">
                                Language: <span className="font-medium">{language}</span>
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isLoading || isSaving || content === originalContent}
                                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            </DraggableWindow>
        </>
    )
}