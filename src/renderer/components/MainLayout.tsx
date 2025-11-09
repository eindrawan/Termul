import React, { useState, useEffect } from 'react'
import { TabType } from '../types'
import { useConnection } from '../contexts/ConnectionContext'
import ConnectionBar from './ConnectionBar'
import FileManager from './FileManager'
import TransferQueue from './TransferQueue'
import Terminal from './Terminal'

export default function MainLayout() {
    const [activeTab, setActiveTab] = useState<TabType>('file-manager')
    const [localPath, setLocalPath] = useState('C:\\')
    const [remotePath, setRemotePath] = useState('/')
    const { state: connectionState } = useConnection()

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

    const tabs: { id: TabType; label: string; icon: string }[] = [
        { id: 'file-manager', label: 'File Manager', icon: '📁' },
        { id: 'transfer-queue', label: 'Transfers', icon: '📤' },
        { id: 'terminal', label: 'Terminal', icon: '💻' },
    ]

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Connection Bar */}
            <ConnectionBar />

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
                <div className={`h-full ${activeTab === 'file-manager' ? 'block' : 'hidden'}`}>
                    <FileManager
                        localPath={localPath}
                        onLocalPathChange={setLocalPath}
                        remotePath={remotePath}
                        onRemotePathChange={setRemotePath}
                    />
                </div>
                <div className={`h-full ${activeTab === 'transfer-queue' ? 'block' : 'hidden'}`}>
                    <TransferQueue />
                </div>
                <div className={`h-full ${activeTab === 'terminal' ? 'block' : 'hidden'}`}>
                    <Terminal />
                </div>
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between px-4 py-1 bg-gray-800 text-white text-xs">
                <div className="flex items-center space-x-4">
                    <span className={`status-indicator ${connectionState.status.connected ? 'status-connected' :
                        connectionState.status.connecting ? 'status-connecting' :
                            connectionState.status.error ? 'status-error' :
                                'status-disconnected'
                        }`}>
                        {connectionState.status.connected ? 'Connected' :
                            connectionState.status.connecting ? 'Connecting...' :
                                connectionState.status.error ? 'Error' :
                                    'Disconnected'}
                    </span>
                    {connectionState.status.host && (
                        <span>{connectionState.status.username}@{connectionState.status.host}</span>
                    )}
                </div>
                <div className="flex items-center space-x-4">
                    {connectionState.status.latency && (
                        <span>Latency: {connectionState.status.latency}ms</span>
                    )}
                    <span>Termul SSH Client v0.1.0</span>
                </div>
            </div>
        </div>
    )
}