import React, { useState, useEffect } from 'react'
import { useConnection } from '../contexts/ConnectionContext'
import { useDeletion } from '../contexts/DeletionContext'
import { useTransfer } from '../contexts/TransferContext'
import ProfileSidebar from './ProfileSidebar'
import SidebarToggle from './SidebarToggle'
import FileManager from './FileManager'
import Terminal from './Terminal'
import WindowList from './WindowList'
import WindowRenderer from './WindowRenderer'
import FileEditorManager from './FileEditorManager'
import { usePlugin } from '../contexts/PluginContext'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { PlusCircleIcon } from '@heroicons/react/24/solid'
import PluginSelectionModal from './PluginSelectionModal'
import { PluginTemplate, AVAILABLE_PLUGINS } from '../registry/PluginRegistry'
import { Tooltip } from './Tooltip'

export default function MainLayout() {
    const { plugins, registerPlugin, unregisterPlugin } = usePlugin()
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const { state: connectionState, dispatch } = useConnection()
    const { deletionProgress } = useDeletion()
    const { state: transferState } = useTransfer()

    // Get current connection
    const currentConnection = connectionState.currentConnectionId
        ? connectionState.activeConnections.get(connectionState.currentConnectionId)
        : undefined

    // Register plugins on mount
    useEffect(() => {
        AVAILABLE_PLUGINS.forEach(plugin => {
            registerPlugin(plugin)
        })
    }, [registerPlugin])

    const handleTabChange = (pluginId: string) => {
        if (connectionState.currentConnectionId) {
            dispatch({
                type: 'SET_ACTIVE_PLUGIN',
                payload: { connectionId: connectionState.currentConnectionId, pluginId }
            })
        }
    }

    const activePluginId = currentConnection?.activePluginId || 'file-manager'
    const [isPluginModalOpen, setIsPluginModalOpen] = useState(false)

    const handleAddTab = () => {
        setIsPluginModalOpen(true)
    }

    const handlePluginSelect = (template: PluginTemplate) => {
        const newPluginId = `${template.id}-${Date.now()}`
        registerPlugin({
            id: newPluginId,
            label: template.label,
            icon: template.icon,
            component: template.component
        })
        handleTabChange(newPluginId)
        setIsPluginModalOpen(false)
    }

    const handleCloseTab = (e: React.MouseEvent, pluginId: string) => {
        e.stopPropagation()
        unregisterPlugin(pluginId)

        // If we closed the active tab, switch to the first available one
        if (activePluginId === pluginId) {
            const remainingPlugins = Array.from(plugins.values()).filter(p => p.id !== pluginId)
            if (remainingPlugins.length > 0) {
                handleTabChange(remainingPlugins[0].id)
            }
        }
    }


    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            {/* Window Renderer - renders all managed windows */}
            <WindowRenderer />

            {/* File Editor Manager - manages all file editors */}
            <FileEditorManager />

            {/* Profile Sidebar */}
            {isSidebarOpen && <ProfileSidebar />}

            {/* Sidebar Toggle Border */}
            <SidebarToggle
                isSidebarOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            />

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Tab Navigation - Only show if there is an active connection */}
                {currentConnection && (
                    <div className="flex border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                        {Array.from(plugins.values()).map((plugin) => (
                            <Tooltip key={plugin.id} content={plugin.label} position="bottom">
                                <button
                                    onClick={() => handleTabChange(plugin.id)}
                                    className={`group relative flex items-center px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activePluginId === plugin.id
                                        ? 'border-primary-500 text-primary-600 dark:border-primary-400 dark:text-gray-300'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                                        }`}
                                >
                                    <span className="mr-2">
                                        {activePluginId === plugin.id ? (
                                            <plugin.icon.solid className="w-5 h-5" />
                                        ) : (
                                            <plugin.icon.outline className="w-5 h-5" />
                                        )}
                                    </span>
                                    {plugin.label}

                                    {plugins.size > 1 && (
                                        <span
                                            onClick={(e) => handleCloseTab(e, plugin.id)}
                                            className={`ml-2 p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all ${activePluginId === plugin.id ? 'opacity-100' : ''
                                                }`}
                                        >
                                            <XMarkIcon className="w-3 h-3" />
                                        </span>
                                    )}
                                </button>
                            </Tooltip>
                        ))}
                        <Tooltip content="Add New Tab" position="bottom">
                            <button
                                onClick={handleAddTab}
                                className="px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors border-b-2 border-transparent"
                            >
                                <PlusCircleIcon className="w-5 h-5" />
                            </button>
                        </Tooltip>
                    </div>
                )}

                <PluginSelectionModal
                    isOpen={isPluginModalOpen}
                    onClose={() => setIsPluginModalOpen(false)}
                    onSelect={handlePluginSelect}
                />

                {/* Tab Content */}
                <div className="flex-1 overflow-hidden">
                    {/* Render Active Plugin for each connection */}
                    <div className="h-full">
                        {Array.from(connectionState.activeConnections.entries()).map(([connectionId, connection]) => {
                            const connectionActivePluginId = connection.activePluginId || 'file-manager'

                            return (
                                <div
                                    key={connectionId}
                                    className={`h-full ${connectionState.currentConnectionId === connectionId ? 'block' : 'hidden'}`}
                                >
                                    {Array.from(plugins.values()).map(plugin => {
                                        const PluginComponent = plugin.component
                                        return (
                                            <div
                                                key={plugin.id}
                                                className={`h-full ${connectionActivePluginId === plugin.id ? 'block' : 'hidden'}`}
                                            >
                                                <PluginComponent
                                                    connectionId={connectionId}
                                                    isActive={connectionActivePluginId === plugin.id && connectionState.currentConnectionId === connectionId}
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        })}
                        {connectionState.activeConnections.size === 0 && (
                            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                                No active connections. Select a profile to connect.
                            </div>
                        )}
                    </div>
                </div>

                {/* Status Bar */}
                <div className="flex items-center justify-between px-4 py-1 bg-gray-100 text-gray-900 text-xs dark:bg-gray-800 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-4">
                        {currentConnection && currentConnection.status ? (
                            <>
                                <span className={`status-indicator ${currentConnection.status.connected ? 'status-connected' :
                                    currentConnection.status.reconnecting ? 'status-connecting' :
                                        currentConnection.status.connecting ? 'status-connecting' :
                                            currentConnection.status.error ? 'status-error' :
                                                'status-disconnected'
                                    }`}>
                                    {currentConnection.status.connected ? `${currentConnection.profile.name}` :
                                        currentConnection.status.reconnecting ? (currentConnection.status.error || 'Reconnecting...') :
                                            currentConnection.status.connecting ? 'Connecting...' :
                                                currentConnection.status.error ? 'Error' :
                                                    'Disconnected'}
                                </span>
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
                        ) : transferState.transferProgress.isActive ? (
                            <span className="text-blue-300">
                                Transferring: {transferState.transferProgress.activeCount} active
                                {transferState.transferProgress.currentFile && (
                                    <> - {transferState.transferProgress.currentFile} ({transferState.transferProgress.overallProgress.toFixed(1)}%)</>
                                )}
                            </span>
                        ) : (
                            <span>Termul SSH Client v0.2.0</span>
                        )}
                        <WindowList />
                    </div>
                </div>
            </div>
        </div >
    )
}