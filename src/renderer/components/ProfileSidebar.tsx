import React, { useState } from 'react'
import { useConnection } from '../contexts/ConnectionContext'
import { ConnectionProfile } from '../types'
import ManageProfilesDialog from './ManageProfilesDialog'
import { PlusIcon, ServerIcon } from '@heroicons/react/24/outline'

export default function ProfileSidebar() {
    const [showProfileDialog, setShowProfileDialog] = useState(false)
    const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null)
    const { state, connectMutation, disconnectMutation } = useConnection()

    const handleConnect = (profile: ConnectionProfile) => {
        // If clicking the currently connected profile, disconnect
        if (state.currentProfile?.id === profile.id && state.status.connected) {
            disconnectMutation.mutate()
            return
        }

        // Ensure null values are converted to undefined
        const cleanProfile = {
            ...profile,
            keyPath: profile.keyPath || undefined,
            passwordId: profile.passwordId || undefined,
        }
        connectMutation.mutate(cleanProfile)
    }

    const handleCreateProfile = () => {
        setEditingProfile(null)
        setShowProfileDialog(true)
    }

    const isProfileActive = (profile: ConnectionProfile) => {
        return state.currentProfile?.id === profile.id
    }

    const isProfileConnected = (profile: ConnectionProfile) => {
        return isProfileActive(profile) && state.status.connected
    }

    const isProfileConnecting = (profile: ConnectionProfile) => {
        return isProfileActive(profile) && state.status.connecting
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
                            {state.profiles.map((profile) => (
                                <button
                                    key={profile.id}
                                    onClick={() => handleConnect(profile)}
                                    disabled={state.isLoading && !isProfileActive(profile)}
                                    className={`w-full text-left p-3 rounded-md transition-colors ${
                                        isProfileConnected(profile)
                                            ? 'bg-primary-600 text-white'
                                            : isProfileActive(profile)
                                            ? 'bg-gray-700 text-white'
                                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                    } ${
                                        state.isLoading && !isProfileActive(profile)
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
                                        {isProfileConnecting(profile) && (
                                            <div className="ml-2 flex-shrink-0">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            </div>
                                        )}
                                    </div>
                                    {isProfileConnected(profile) && (
                                        <div className="mt-2 text-xs flex items-center space-x-1">
                                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                            <span>Connected</span>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer with Status */}
                <div className="p-3 border-t border-gray-700 text-xs">
                    {state.status.error && (
                        <div className="text-red-400 mb-2 p-2 bg-red-900/20 rounded">
                            {state.status.error}
                        </div>
                    )}
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
                />
            )}
        </>
    )
}

