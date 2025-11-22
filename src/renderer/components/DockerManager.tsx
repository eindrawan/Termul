import React, { useState, useEffect } from 'react'
import { useConnection } from '../contexts/ConnectionContext'
import { useTerminal } from '../contexts/TerminalContext'
import { ArrowPathIcon, CommandLineIcon, DocumentTextIcon, CubeIcon } from '@heroicons/react/24/outline'

interface DockerManagerProps {
    connectionId: string
    isActive: boolean
}

interface DockerContainer {
    ID: string
    Image: string
    Command: string
    CreatedAt: string
    RunningFor: string
    Ports: string
    Status: string
    Size: string
    Names: string
    Labels: string
    Mounts: string
    Networks: string
}

export default function DockerManager({ connectionId, isActive }: DockerManagerProps) {
    const [containers, setContainers] = useState<DockerContainer[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedContainer, setSelectedContainer] = useState<DockerContainer | null>(null)
    const [logs, setLogs] = useState<string>('')
    const [loadingLogs, setLoadingLogs] = useState(false)
    const [showLogsModal, setShowLogsModal] = useState(false)

    const [showSudoModal, setShowSudoModal] = useState(false)
    const [sudoPassword, setSudoPassword] = useState('')
    const [pendingAction, setPendingAction] = useState<'list' | 'logs' | 'restart' | null>(null)
    const [pendingContainer, setPendingContainer] = useState<DockerContainer | null>(null)
    const [restartingContainers, setRestartingContainers] = useState<Set<string>>(new Set())
    const [pinnedContainers, setPinnedContainers] = useState<Set<string>>(new Set())

    const { state: connectionState, dispatch } = useConnection()
    const { sendInputMutation } = useTerminal()

    const connection = connectionState.activeConnections.get(connectionId)
    const isConnected = connection?.status.connected || false

    // Generate a persistent key for this connection profile
    const getStorageKey = () => {
        if (!connection?.profile) return null
        // Use profile ID if available, otherwise fallback to host:username
        const profileId = connection.profile.id || `${connection.profile.host}:${connection.profile.username}`
        return `docker-pinned-${profileId}`
    }

    // Load pinned containers from localStorage
    useEffect(() => {
        const storageKey = getStorageKey()
        if (storageKey) {
            const savedPins = localStorage.getItem(storageKey)
            if (savedPins) {
                try {
                    setPinnedContainers(new Set(JSON.parse(savedPins)))
                } catch (e) {
                    console.error('Failed to parse pinned containers', e)
                }
            }
        }
    }, [connectionId, connection?.profile]) // Re-run when connection or profile changes

    const togglePin = (containerId: string) => {
        const newPinned = new Set(pinnedContainers)
        if (newPinned.has(containerId)) {
            newPinned.delete(containerId)
        } else {
            newPinned.add(containerId)
        }
        setPinnedContainers(newPinned)

        const storageKey = getStorageKey()
        if (storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(Array.from(newPinned)))
        }
    }

    const handleSudoRequired = (action: 'list' | 'logs' | 'restart', container?: DockerContainer) => {
        setPendingAction(action)
        if (container) setPendingContainer(container)
        setShowSudoModal(true)
    }

    const handleSudoSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setShowSudoModal(false)
        try {
            await window.electronAPI.setDockerSudoPassword(connectionId, sudoPassword)
            setSudoPassword('')

            // Retry pending action
            if (pendingAction === 'list') {
                fetchContainers()
            } else if (pendingAction === 'logs' && pendingContainer) {
                handleShowLogs(pendingContainer)
            } else if (pendingAction === 'restart' && pendingContainer) {
                handleRestart(pendingContainer)
            }
        } catch (err) {
            console.error('Failed to set sudo password:', err)
            setError('Failed to set sudo password')
        }
    }

    const handleRestart = async (container: DockerContainer) => {
        setRestartingContainers(prev => new Set(prev).add(container.ID))
        try {
            await window.electronAPI.restartDockerContainer(connectionId, container.ID)
            // Refresh list after restart
            await fetchContainers()
        } catch (err) {
            console.error('Failed to restart container:', err)
            const message = err instanceof Error ? err.message : String(err)
            if (message.includes('SUDO_PASSWORD_REQUIRED')) {
                handleSudoRequired('restart', container)
            } else {
                setError(`Failed to restart container: ${message}`)
            }
        } finally {
            setRestartingContainers(prev => {
                const next = new Set(prev)
                next.delete(container.ID)
                return next
            })
        }
    }

    const fetchContainers = async () => {
        if (!isConnected) return
        setLoading(true)
        setError(null)
        try {
            const data = await window.electronAPI.listDockerContainers(connectionId)
            setContainers(data)
        } catch (err) {
            console.error('Failed to fetch docker containers:', err)
            const message = err instanceof Error ? err.message : String(err)
            if (message.includes('SUDO_PASSWORD_REQUIRED')) {
                handleSudoRequired('list')
            } else {
                setError(message)
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isActive && isConnected) {
            fetchContainers()
        }
    }, [isActive, isConnected])

    const handleShowLogs = async (container: DockerContainer) => {
        setSelectedContainer(container)
        setShowLogsModal(true)
        setLoadingLogs(true)
        setLogs('')
        try {
            const logsData = await window.electronAPI.getDockerContainerLogs(connectionId, container.ID)
            setLogs(logsData)
        } catch (err) {
            console.error('Failed to fetch logs:', err)
            const message = err instanceof Error ? err.message : String(err)
            if (message.includes('SUDO_PASSWORD_REQUIRED')) {
                setShowLogsModal(false) // Close logs modal to show sudo modal
                handleSudoRequired('logs', container)
            } else {
                setLogs(`Failed to fetch logs: ${message}`)
            }
        } finally {
            setLoadingLogs(false)
        }
    }

    const handleEnterShell = (container: DockerContainer) => {
        dispatch({
            type: 'SET_ACTIVE_PLUGIN',
            payload: { connectionId, pluginId: 'terminal' }
        })
        // Wait a bit for terminal to mount/focus
        setTimeout(() => {
            sendInputMutation.mutate({
                connectionId,
                data: `docker exec -it ${container.ID} /bin/sh || docker exec -it ${container.ID} /bin/bash\r`
            })
        }, 500)
    }

    // Sort containers: Pinned first, then running, then others
    const sortedContainers = [...containers].sort((a, b) => {
        const aPinned = pinnedContainers.has(a.ID)
        const bPinned = pinnedContainers.has(b.ID)
        if (aPinned && !bPinned) return -1
        if (!aPinned && bPinned) return 1

        const aRunning = a.Status.startsWith('Up')
        const bRunning = b.Status.startsWith('Up')
        if (aRunning && !bRunning) return -1
        if (!aRunning && bRunning) return 1

        return a.Names.localeCompare(b.Names)
    })

    if (!isConnected) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                Please connect to a server to manage Docker containers.
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                    <CubeIcon className="h-8 w-8 mr-3 text-blue-500" />
                    Docker Containers
                </h2>
                <button
                    onClick={fetchContainers}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Refresh"
                >
                    <ArrowPathIcon className={`h-6 w-6 text-gray-600 dark:text-gray-300 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedContainers.map((container) => (
                    <div key={container.ID} className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border-l-4 ${container.Status.startsWith('Up') ? 'border-green-500' : 'border-gray-400'} transition-all hover:shadow-lg relative`}>
                        <div className="p-5">
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={container.Names}>
                                    {container.Names}
                                </h3>
                                <div className="flex space-x-1">
                                    <button
                                        onClick={() => togglePin(container.ID)}
                                        className={`p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${pinnedContainers.has(container.ID) ? 'text-yellow-500' : 'text-gray-400'}`}
                                        title={pinnedContainers.has(container.ID) ? "Unpin" : "Pin"}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                            <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a.75.75 0 00.75.75h10.5a.75.75 0 00.75-.75v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${container.Status.startsWith('Up') ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                                        {container.Status.startsWith('Up') ? 'Running' : 'Stopped'}
                                    </span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 truncate" title={container.Image}>
                                <span className="font-medium">Image:</span> {container.Image}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 truncate" title={container.Ports}>
                                <span className="font-medium">Ports:</span> {container.Ports || 'None'}
                            </p>

                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => handleShowLogs(container)}
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium flex items-center"
                                    >
                                        <DocumentTextIcon className="h-4 w-4 mr-1" />
                                        Logs
                                    </button>
                                    <button
                                        onClick={() => handleEnterShell(container)}
                                        disabled={!container.Status.startsWith('Up')}
                                        className={`text-sm font-medium flex items-center ${container.Status.startsWith('Up') ? 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300' : 'text-gray-400 cursor-not-allowed'}`}
                                    >
                                        <CommandLineIcon className="h-4 w-4 mr-1" />
                                        Shell
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleRestart(container)}
                                    disabled={restartingContainers.has(container.ID)}
                                    className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400 ${restartingContainers.has(container.ID) ? 'animate-spin' : ''}`}
                                    title="Restart"
                                >
                                    <ArrowPathIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Logs Modal */}
            {showLogsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="font-medium text-lg">
                                Logs: {selectedContainer?.Names}
                            </h3>
                            <button
                                onClick={() => setShowLogsModal(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <span className="sr-only">Close</span>
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 bg-gray-900 text-gray-100 font-mono text-sm whitespace-pre-wrap">
                            {loadingLogs ? (
                                <div className="flex items-center justify-center h-full">
                                    <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-500" />
                                </div>
                            ) : (
                                logs || 'No logs available.'
                            )}
                        </div>
                        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-gray-800 rounded-b-lg">
                            <button
                                onClick={() => setShowLogsModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sudo Password Modal */}
            {showSudoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <form onSubmit={handleSudoSubmit}>
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="font-medium text-lg">Sudo Password Required</h3>
                            </div>
                            <div className="p-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    Docker commands require sudo privileges. Please enter your sudo password.
                                </p>
                                <input
                                    type="password"
                                    value={sudoPassword}
                                    onChange={(e) => setSudoPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                    placeholder="Password"
                                    autoFocus
                                />
                            </div>
                            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
                                <button
                                    type="button"
                                    onClick={() => setShowSudoModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Submit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
