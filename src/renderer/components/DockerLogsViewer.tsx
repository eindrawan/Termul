import { useState, useEffect } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

interface DockerLogsViewerProps {
    connectionId: string
    containerId: string
    onSudoRequired: () => void
}

export default function DockerLogsViewer({ connectionId, containerId, onSudoRequired }: DockerLogsViewerProps) {
    const [logs, setLogs] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchLogs()
    }, [connectionId, containerId])

    const fetchLogs = async () => {
        setLoading(true)
        setError(null)
        try {
            const logsData = await window.electronAPI.getDockerContainerLogs(connectionId, containerId)
            setLogs(logsData)
        } catch (err) {
            console.error('Failed to fetch logs:', err)
            const message = err instanceof Error ? err.message : String(err)
            if (message.includes('SUDO_PASSWORD_REQUIRED')) {
                onSudoRequired()
            } else {
                setError(`Failed to fetch logs: ${message}`)
            }
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-900 text-gray-100">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-500" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 bg-gray-900 text-red-400 font-mono text-sm h-full overflow-auto">
                {error}
                <button
                    onClick={fetchLogs}
                    className="ml-2 underline hover:text-red-300"
                >
                    Retry
                </button>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-auto p-4 bg-gray-900 text-gray-100 font-mono text-sm whitespace-pre-wrap h-full">
            {logs || 'No logs available.'}
        </div>
    )
}
