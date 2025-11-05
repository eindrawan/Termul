import React, { useState } from 'react'
import { useConnection } from '../contexts/ConnectionContext'
import { ConnectionProfile } from '../types'
import ManageProfilesDialog from './ManageProfilesDialog'

export default function ConnectionBar() {
    const [showProfileDialog, setShowProfileDialog] = useState(false)
    const { state, connectMutation, disconnectMutation } = useConnection()

    const handleConnect = (profile: ConnectionProfile) => {
        // Ensure null values are converted to undefined
        const cleanProfile = {
            ...profile,
            keyPath: profile.keyPath || undefined,
            passwordId: profile.passwordId || undefined,
        }
        connectMutation.mutate(cleanProfile)
    }

    const handleDisconnect = () => {
        disconnectMutation.mutate()
    }

    return (
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
            <div className="flex items-center space-x-4">
                <select
                    className="input w-64"
                    value={state.currentProfile?.id || ''}
                    onChange={(e) => {
                        const profile = state.profiles.find(p => p.id === e.target.value)
                        if (profile) {
                            handleConnect(profile)
                        }
                    }}
                    disabled={state.isLoading}
                >
                    <option value="">Select a profile...</option>
                    {state.profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                            {profile.name} ({profile.username}@{profile.host}:{profile.port})
                        </option>
                    ))}
                </select>

                {state.currentProfile && (
                    <button
                        onClick={handleDisconnect}
                        disabled={state.isLoading}
                        className="btn btn-secondary"
                    >
                        Disconnect
                    </button>
                )}

                <button
                    onClick={() => setShowProfileDialog(true)}
                    className="btn btn-ghost"
                >
                    Manage Profiles
                </button>
            </div>

            <div className="flex items-center space-x-2">
                {state.isLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                )}
                {state.status.error && (
                    <span className="text-red-600 text-sm">{state.status.error}</span>
                )}
            </div>

            {showProfileDialog && (
                <ManageProfilesDialog
                    isOpen={showProfileDialog}
                    onClose={() => setShowProfileDialog(false)}
                />
            )}
        </div>
    )
}