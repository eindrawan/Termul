import React from 'react'
import FileEditor from './FileEditor'
import ImageViewer from './ImageViewer'
import PdfViewer from './PdfViewer'

interface FileEditorInstance {
    id: string
    file: any
    connectionId?: string
    isLocal: boolean
}

// Global state to track open file editors
const openFileEditors: Map<string, FileEditorInstance> = new Map()

export function openFileEditor(file: any, connectionId: string | undefined, isLocal: boolean, profileId?: string) {
    const editorId = `${isLocal ? 'local' : 'remote'}-${connectionId || 'local'}-${file.path}`

    // Check if already open
    if (openFileEditors.has(editorId)) {
        console.log('[FileEditorManager] File already open:', editorId)
        return
    }

    openFileEditors.set(editorId, {
        id: editorId,
        file,
        connectionId,
        isLocal
    })

    // Trigger re-render by dispatching a custom event
    window.dispatchEvent(new CustomEvent('file-editors-changed'))

    // Add to history using profileId if available (for stable history across sessions), otherwise connectionId
    // For local files, both are null/undefined
    window.electronAPI.addFileHistory(profileId || connectionId || null, file.path).catch(err => {
        console.error('Failed to add file to history:', err)
    })
}

export function closeFileEditor(editorId: string) {
    openFileEditors.delete(editorId)
    window.dispatchEvent(new CustomEvent('file-editors-changed'))
}

export default function FileEditorManager() {
    const [editors, setEditors] = React.useState<FileEditorInstance[]>([])

    React.useEffect(() => {
        const updateEditors = () => {
            setEditors(Array.from(openFileEditors.values()))
        }

        // Initial load
        updateEditors()

        // Listen for changes
        window.addEventListener('file-editors-changed', updateEditors)

        return () => {
            window.removeEventListener('file-editors-changed', updateEditors)
        }
    }, [])

    return (
        <>
            {editors.map((editor) => {
                const isImage = /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(editor.file.name)

                if (isImage) {
                    return (
                        <ImageViewer
                            key={editor.id}
                            file={editor.file}
                            isOpen={true}
                            onClose={() => closeFileEditor(editor.id)}
                            connectionId={editor.connectionId}
                            isLocal={editor.isLocal}
                        />
                    )
                }

                const isPdf = /\.pdf$/i.test(editor.file.name)
                if (isPdf) {
                    return (
                        <PdfViewer
                            key={editor.id}
                            file={editor.file}
                            isOpen={true}
                            onClose={() => closeFileEditor(editor.id)}
                            connectionId={editor.connectionId}
                            isLocal={editor.isLocal}
                        />
                    )
                }

                return (
                    <FileEditor
                        key={editor.id}
                        file={editor.file}
                        isOpen={true}
                        onClose={() => closeFileEditor(editor.id)}
                        connectionId={editor.connectionId}
                        isLocal={editor.isLocal}
                    />
                )
            })}
        </>
    )
}
