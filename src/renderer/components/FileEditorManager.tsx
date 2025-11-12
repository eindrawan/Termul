import React from 'react'
import FileEditor from './FileEditor'

interface FileEditorInstance {
    id: string
    file: any
    connectionId?: string
    isLocal: boolean
}

// Global state to track open file editors
const openFileEditors: Map<string, FileEditorInstance> = new Map()

export function openFileEditor(file: any, connectionId: string | undefined, isLocal: boolean) {
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
            {editors.map((editor) => (
                <FileEditor
                    key={editor.id}
                    file={editor.file}
                    isOpen={true}
                    onClose={() => closeFileEditor(editor.id)}
                    connectionId={editor.connectionId}
                    isLocal={editor.isLocal}
                />
            ))}
        </>
    )
}
