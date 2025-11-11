import React, { useState } from 'react'
import { useConnection } from '../contexts/ConnectionContext'
import { ConnectionProfile } from '../types'
import ManageProfilesDialog from './ManageProfilesDialog'
import { PlusIcon, ServerIcon, PencilIcon } from '@heroicons/react/24/outline'

export default function ProfileSidebar() {
    const [showProfileDialog, setShowProfileDialog] = useState(false)
    const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null)
    const { state, connectMutation, disconnectMutation, dispatch } = useConnection()

    const handleConnect = (profile: ConnectionProfile) => {
        // Find if this profile already has an active connection
        const existingConnection = Array.from(state.activeConnections.values()).find(
            conn => conn.profile.id === profile.id
        )

        if (existingConnection) {
            // If already connected, switch to this connection
            dispatch({ type: 'SET_CURRENT_CONNECTION', payload: existingConnection.id })
            return
        }

        // Otherwise, create a new connection
        const cleanProfile = {
            ...profile,
            keyPath: profile.keyPath || undefined,
            passwordId: profile.passwordId || undefined,
        }
        connectMutation.mutate(cleanProfile)
    }

    const handleDisconnect = (connectionId: string, event: React.MouseEvent) => {
        event.stopPropagation()
        disconnectMutation.mutate(connectionId)
    }

    const handleCreateProfile = () => {
        setEditingProfile(null)
        setShowProfileDialog(true)
    }

    const handleEditProfile = (profile: ConnectionProfile, event: React.MouseEvent) => {
        event.stopPropagation()
        setEditingProfile(profile)
        setShowProfileDialog(true)
    }

    const getProfileConnection = (profile: ConnectionProfile) => {
        return Array.from(state.activeConnections.values()).find(
            conn => conn.profile.id === profile.id
        )
    }

    const isProfileActive = (profile: ConnectionProfile) => {
        const connection = getProfileConnection(profile)
        return connection?.id === state.currentConnectionId
    }

    const isProfileConnected = (profile: ConnectionProfile) => {
        const connection = getProfileConnection(profile)
        return connection?.status.connected || false
    }

    const isProfileConnecting = (profile: ConnectionProfile) => {
        const connection = getProfileConnection(profile)
        return connection?.status.connecting || false
    }

    return (
        <>
            <div className="flex flex-col h-full w-64 bg-gray-800 text-white border-r border-gray-700">
                {/* Header with Create Button */}
                <div className="p-4 border-b border-gray-700">
                    <button
                        onClick={handleCreateProfile}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
                        disabled={state.isLoading}
                    >
                        <PlusIcon className="h-5 w-5" />
                        <span>New Profile</span>
                    </button>
                </div>

                {/* Profiles List */}
                <div className="flex-1 overflow-y-auto">
                    {state.profiles.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">
                            No profiles yet. Create one to get started.
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {state.profiles.map((profile) => {
                                const connection = getProfileConnection(profile)
                                return (
                                    <div key={profile.id} className="relative">
                                        <button
                                            onClick={() => handleConnect(profile)}
                                            disabled={state.isLoading && !isProfileActive(profile)}
                                            className={`w-full text-left p-3 rounded-md transition-colors ${isProfileConnected(profile) && isProfileActive(profile)
                                                ? 'bg-primary-600 text-white border-2 border-primary-700'
                                                : isProfileConnected(profile) && !isProfileActive(profile)
                                                    ? 'text-white border-2 border-primary-600'
                                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                                } ${state.isLoading && !isProfileActive(profile)
                                                    ? 'opacity-50 cursor-not-allowed'
                                                    : ''
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center space-x-2">
                                                        <ServerIcon className="h-4 w-4 flex-shrink-0" />
                                                        <div className="font-medium truncate">{profile.name}</div>
                                                    </div>
                                                    <div className="text-xs mt-1 truncate opacity-80">
                                                        {profile.username}@{profile.host}
                                                    </div>
                                                    <div className="text-xs mt-0.5 opacity-60">
                                                        Port: {profile.port} • {profile.authType === 'password' ? 'Password' : 'SSH Key'}
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <button
                                                        onClick={(e) => handleEditProfile(profile, e)}
                                                        className="p-1 rounded hover:bg-gray-600 transition-colors"
                                                        title="Edit Profile"
                                                    >
                                                        <PencilIcon className="h-4 w-4 text-gray-300 hover:text-white" />
                                                    </button>
                                                    {isProfileConnecting(profile) && (
                                                        <div className="ml-2 flex-shrink-0">
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {isProfileConnected(profile) && (
                                                <div className="mt-2 text-xs flex items-center justify-between">
                                                    <div className="flex items-center space-x-1">
                                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                                        <span>{isProfileActive(profile) ? 'Active' : 'Connected'}</span>
                                                    </div>
                                                    {connection && (
                                                        <button
                                                            onClick={(e) => handleDisconnect(connection.id, e)}
                                                            className="text-xs px-2 py-0.5 bg-red-500 hover:bg-red-600 rounded"
                                                        >
                                                            Disconnect
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer with Status */}
                <div className="p-3 border-t border-gray-700 text-xs">
                    <div className="text-gray-400">
                        {state.profiles.length} {state.profiles.length === 1 ? 'profile' : 'profiles'}
                    </div>
                </div>
            </div>

            {/* Profile Management Dialog */}
            {showProfileDialog && (
                <ManageProfilesDialog
                    isOpen={showProfileDialog}
                    onClose={() => {
                        setShowProfileDialog(false)
                        setEditingProfile(null)
                    }}
                    editingProfile={editingProfile}
                />
            )}
        </>
    )
}

