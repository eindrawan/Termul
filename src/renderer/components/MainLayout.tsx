import React, { useState, useEffect } from 'react'
import { TabType } from '../types'
import { useConnection } from '../contexts/ConnectionContext'
import { useDeletion } from '../contexts/DeletionContext'
import ProfileSidebar from './ProfileSidebar'
import FileManager from './FileManager'
import TransferQueue from './TransferQueue'
import Terminal from './Terminal'

export default function MainLayout() {
    const [activeTab, setActiveTab] = useState<TabType>('file-manager')
    const [localPath, setLocalPath] = useState('C:\\')
    const { state: connectionState, dispatch } = useConnection()
    const { deletionProgress } = useDeletion()

    // Get current connection
    const currentConnection = connectionState.currentConnectionId
        ? connectionState.activeConnections.get(connectionState.currentConnectionId)
        : undefined

    // Update local path when switching connections
    useEffect(() => {
        if (currentConnection?.localPath) {
            setLocalPath(currentConnection.localPath)
        }
    }, [currentConnection?.localPath])

    // Get user's home directory on component mount
    useEffect(() => {
        const getHomeDirectory = async () => {
            try {
                const homeDir = await window.electronAPI.getHomeDirectory()
                if (homeDir) {
                    setLocalPath(homeDir)
                }
            } catch (error) {
                console.warn('Could not get home directory, using default:', error)
                setLocalPath('C:\\Users')
            }
        }

        getHomeDirectory()
    }, [])

    const handleRemotePathChange = (path: string) => {
        if (connectionState.currentConnectionId) {
            dispatch({
                type: 'UPDATE_REMOTE_PATH',
                payload: { connectionId: connectionState.currentConnectionId, remotePath: path }
            })
        }
    }

    const tabs: { id: TabType; label: string; icon: string }[] = [
        { id: 'file-manager', label: 'File Manager', icon: '📁' },
        { id: 'transfer-queue', label: 'Transfers', icon: '📤' },
        { id: 'terminal', label: 'Terminal', icon: '💻' },
    ]

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Profile Sidebar */}
            <ProfileSidebar />

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200 bg-white">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-hidden">
                    {/* Render FileManager for each connection, show/hide based on active connection */}
                    <div className={`h-full ${activeTab === 'file-manager' ? 'block' : 'hidden'}`}>
                        {Array.from(connectionState.activeConnections.entries()).map(([connectionId, connection]) => (
                            <div
                                key={connectionId}
                                className={`h-full ${connectionState.currentConnectionId === connectionId ? 'block' : 'hidden'}`}
                            >
                                <FileManager
                                    connectionId={connectionId}
                                    localPath={localPath}
                                    onLocalPathChange={setLocalPath}
                                    remotePath={connection.remotePath}
                                    onRemotePathChange={handleRemotePathChange}
                                />
                            </div>
                        ))}
                        {connectionState.activeConnections.size === 0 && (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                No active connections. Select a profile to connect.
                            </div>
                        )}
                    </div>

                    <div className={`h-full ${activeTab === 'transfer-queue' ? 'block' : 'hidden'}`}>
                        <TransferQueue />
                    </div>

                    {/* Render Terminal for each connection, show/hide based on active connection */}
                    <div className={`h-full ${activeTab === 'terminal' ? 'block' : 'hidden'}`}>
                        {Array.from(connectionState.activeConnections.entries()).map(([connectionId, connection]) => (
                            <div
                                key={connectionId}
                                className={`h-full ${connectionState.currentConnectionId === connectionId ? 'block' : 'hidden'}`}
                            >
                                <Terminal connectionId={connectionId} />
                            </div>
                        ))}
                        {connectionState.activeConnections.size === 0 && (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                No active connections. Select a profile to connect.
                            </div>
                        )}
                    </div>
                </div>

                {/* Status Bar */}
                <div className="flex items-center justify-between px-4 py-1 bg-gray-800 text-white text-xs">
                    <div className="flex items-center space-x-4">
                        {currentConnection && currentConnection.status ? (
                            <>
                                <span className={`status-indicator ${currentConnection.status.connected ? 'status-connected' :
                                    currentConnection.status.connecting ? 'status-connecting' :
                                        currentConnection.status.error ? 'status-error' :
                                            'status-disconnected'
                                    }`}>
                                    {currentConnection.status.connected ? 'Connected' :
                                        currentConnection.status.connecting ? 'Connecting...' :
                                            currentConnection.status.error ? 'Error' :
                                                'Disconnected'}
                                </span>
                                {currentConnection.status.host && (
                                    <span>{currentConnection.status.username}@{currentConnection.status.host}</span>
                                )}
                                {currentConnection.status.latency && (
                                    <span>Latency: {currentConnection.status.latency}ms</span>
                                )}
                            </>
                        ) : (
                            <span className="status-indicator status-disconnected">No Connection</span>
                        )}
                        {connectionState.activeConnections.size > 1 && (
                            <span className="text-gray-400">
                                ({connectionState.activeConnections.size} connections)
                            </span>
                        )}
                    </div>
                    <div className="flex items-center space-x-4">
                        {deletionProgress.isActive ? (
                            <span className="text-yellow-300">
                                Deleting: {deletionProgress.current}/{deletionProgress.total}
                                {deletionProgress.currentFile && ` - ${deletionProgress.currentFile}`}
                            </span>
                        ) : (
                            <span>Termul SSH Client v0.1.0</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}