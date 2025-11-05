import React, { useState, useEffect } from 'react'
import { useConnection } from '../contexts/ConnectionContext'
import { ConnectionProfile } from '../types'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

interface ManageProfilesDialogProps {
    isOpen: boolean
    onClose: () => void
}

interface ProfileFormData {
    name: string
    host: string
    port: number
    username: string
    authType: 'password' | 'key'
    keyPath: string
    passwordId: string
}

interface ProfileFormErrors {
    name?: string
    host?: string
    port?: string
    username?: string
    keyPath?: string
    passwordId?: string
}

const initialFormData: ProfileFormData = {
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password',
    keyPath: '',
    passwordId: '',
}

export default function ManageProfilesDialog({ isOpen, onClose }: ManageProfilesDialogProps) {
    const { state, saveProfileMutation, deleteProfileMutation } = useConnection()
    const [formData, setFormData] = useState<ProfileFormData>(initialFormData)
    const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null)
    const [testLoading, setTestLoading] = useState<string | null>(null)
    const [errors, setErrors] = useState<ProfileFormErrors>({})
    const [showPassword, setShowPassword] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setFormData(initialFormData)
            setEditingProfile(null)
            setErrors({})
            setShowPassword(false)
        }
    }, [isOpen])

    const validateForm = (): boolean => {
        const newErrors: ProfileFormErrors = {}

        if (!formData.name.trim()) {
            newErrors.name = 'Profile name is required'
        }
        if (!formData.host.trim()) {
            newErrors.host = 'Host is required'
        }
        if (!formData.port || formData.port < 1 || formData.port > 65535) {
            newErrors.port = 'Valid port number is required'
        }
        if (!formData.username.trim()) {
            newErrors.username = 'Username is required'
        }
        if (formData.authType === 'key' && !formData.keyPath.trim()) {
            newErrors.keyPath = 'Key file path is required for key authentication'
        }
        if (formData.authType === 'password' && !formData.passwordId.trim()) {
            newErrors.passwordId = 'Password selection is required for password authentication'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSave = async () => {
        if (!validateForm()) {
            return
        }

        let finalPasswordId = formData.passwordId;

        // If this is a password-based profile and we have a password to store
        // (meaning the user entered a new password, not just an ID)
        if (formData.authType === 'password' && formData.passwordId.length > 0) {
            // Check if the passwordId looks like a real password (not an ID)
            // Password IDs are typically generated strings, while passwords are user input
            // We'll assume that if the user entered something in the password field, it's a new password
            const profileId = editingProfile?.id || Date.now().toString(36) + Math.random().toString(36).substr(2);

            // Store the password securely and get back the password ID
            try {
                finalPasswordId = await window.electronAPI.storePassword({
                    id: profileId,
                    name: formData.name,
                    host: formData.host,
                    port: formData.port,
                    username: formData.username,
                    authType: 'password',
                }, formData.passwordId);
            } catch (error) {
                console.error('Failed to store password:', error);
                alert('Failed to store password securely: ' + (error as Error).message);
                return;
            }
        } else if (editingProfile && editingProfile.passwordId && formData.authType === 'password') {
            // If we're editing an existing profile and no new password was entered,
            // keep the existing password ID
            finalPasswordId = editingProfile.passwordId;
        }

        const profile: ConnectionProfile = {
            id: editingProfile?.id,
            name: formData.name.trim(),
            host: formData.host.trim(),
            port: formData.port,
            username: formData.username.trim(),
            authType: formData.authType,
        }

        // Only include authentication-specific fields when they have values
        if (formData.authType === 'key' && formData.keyPath.trim()) {
            profile.keyPath = formData.keyPath.trim()
        }
        if (formData.authType === 'password' && finalPasswordId) {
            profile.passwordId = finalPasswordId
        }

        saveProfileMutation.mutate(profile)

        // Reset form and close
        setFormData(initialFormData)
        setEditingProfile(null)
        setErrors({})
        setShowPassword(false)
        onClose()
    }

    const handleEdit = (profile: ConnectionProfile) => {
        setEditingProfile(profile)
        setFormData({
            name: profile.name,
            host: profile.host,
            port: profile.port,
            username: profile.username,
            authType: profile.authType,
            keyPath: profile.keyPath || '',
            passwordId: profile.passwordId || '',
        })
        setErrors({})
        setShowPassword(false)
    }

    const handleDelete = (profileId: string) => {
        if (window.confirm('Are you sure you want to delete this profile?')) {
            deleteProfileMutation.mutate(profileId)
        }
    }

    const handleTestConnection = async (profile: ConnectionProfile) => {
        setTestLoading(profile.id || 'new')
        try {
            const success = await window.electronAPI.testConnection(profile)
            if (success) {
                alert('Connection test successful!')
            } else {
                alert('Connection test failed: Unable to connect to the server with the provided credentials.')
            }
        } catch (error) {
            alert('Connection test failed: ' + (error as Error).message)
        } finally {
            setTestLoading(null)
        }
    }

    const handleCancel = () => {
        setFormData(initialFormData)
        setEditingProfile(null)
        setErrors({})
        setShowPassword(false)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex">
                {/* Profiles List */}
                <div className="w-1/2 pr-6 border-r border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Connection Profiles</h2>
                        <button
                            onClick={() => setEditingProfile(null)}
                            className="btn btn-primary text-sm"
                            disabled={saveProfileMutation.isPending}
                        >
                            Add New
                        </button>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {state.profiles.length === 0 ? (
                            <div className="text-gray-500 text-center py-8">
                                No profiles configured. Add a new profile to get started.
                            </div>
                        ) : (
                            state.profiles.map((profile) => (
                                <div key={profile.id} className="border rounded p-3 hover:bg-gray-50">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="font-medium">{profile.name}</div>
                                            <div className="text-sm text-gray-600">
                                                {profile.username}@{profile.host}:{profile.port}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                Auth: {profile.authType === 'password' ? 'Password' : 'SSH Key'}
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleTestConnection(profile)}
                                                disabled={testLoading === profile.id}
                                                className="btn btn-ghost text-xs"
                                                title="Test Connection"
                                            >
                                                {testLoading === profile.id ? (
                                                    <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-600"></div>
                                                ) : (
                                                    'Test'
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleEdit(profile)}
                                                className="btn btn-ghost text-xs"
                                                disabled={saveProfileMutation.isPending}
                                                title="Edit"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(profile.id!)}
                                                className="btn btn-ghost text-xs text-red-600"
                                                disabled={deleteProfileMutation.isPending}
                                                title="Delete"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Profile Form */}
                <div className="w-1/2 pl-6">
                    <h2 className="text-lg font-semibold mb-4">
                        {editingProfile ? 'Edit Profile' : 'Add New Profile'}
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Profile Name *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full p-2 border rounded ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="My Server"
                            />
                            {errors.name && <div className="text-red-500 text-xs mt-1">{errors.name}</div>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Host *</label>
                                <input
                                    type="text"
                                    value={formData.host}
                                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                                    className={`w-full p-2 border rounded ${errors.host ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="192.168.1.100"
                                />
                                {errors.host && <div className="text-red-500 text-xs mt-1">{errors.host}</div>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Port *</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="65535"
                                    value={formData.port}
                                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 22 })}
                                    className={`w-full p-2 border rounded ${errors.port ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {errors.port && <div className="text-red-500 text-xs mt-1">{errors.port}</div>}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Username *</label>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                className={`w-full p-2 border rounded ${errors.username ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="user"
                            />
                            {errors.username && <div className="text-red-500 text-xs mt-1">{errors.username}</div>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Authentication Type *</label>
                            <select
                                value={formData.authType}
                                onChange={(e) => {
                                    setFormData({
                                        ...formData,
                                        authType: e.target.value as 'password' | 'key',
                                        passwordId: '',
                                        keyPath: ''
                                    })
                                    setShowPassword(false)
                                }}
                                className="w-full p-2 border border-gray-300 rounded"
                            >
                                <option value="password">Password</option>
                                <option value="key">SSH Key</option>
                            </select>
                        </div>

                        {formData.authType === 'password' ? (
                            <div>
                                <label className="block text-sm font-medium mb-1">Password *</label>
                                <div className="flex space-x-2">
                                    <div className="relative flex-1">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={formData.passwordId}
                                            onChange={(e) => setFormData({ ...formData, passwordId: e.target.value })}
                                            className={`w-full p-2 pr-10 border rounded ${errors.passwordId ? 'border-red-500' : 'border-gray-300'}`}
                                            placeholder="Enter or select password"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? (
                                                <EyeSlashIcon className="h-5 w-5" />
                                            ) : (
                                                <EyeIcon className="h-5 w-5" />
                                            )}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-secondary text-sm"
                                        onClick={async () => {
                                            const password = window.prompt('Enter password for this profile:')
                                            if (password) {
                                                try {
                                                    // Store the password securely and get back the password ID
                                                    const passwordId = await window.electronAPI.storePassword({
                                                        id: editingProfile?.id,
                                                        name: formData.name,
                                                        host: formData.host,
                                                        port: formData.port,
                                                        username: formData.username,
                                                        authType: 'password',
                                                    }, password);
                                                    setFormData({ ...formData, passwordId });
                                                } catch (error) {
                                                    console.error('Failed to store password:', error);
                                                    alert('Failed to store password securely: ' + (error as Error).message);
                                                }
                                            }
                                        }}
                                    >
                                        Set
                                    </button>
                                </div>
                                {errors.passwordId && <div className="text-red-500 text-xs mt-1">{errors.passwordId}</div>}
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium mb-1">SSH Key File *</label>
                                <input
                                    type="text"
                                    value={formData.keyPath}
                                    onChange={(e) => setFormData({ ...formData, keyPath: e.target.value })}
                                    className={`w-full p-2 border rounded ${errors.keyPath ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="C:\\Users\\user\\.ssh\\id_rsa"
                                />
                                {errors.keyPath && <div className="text-red-500 text-xs mt-1">{errors.keyPath}</div>}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between mt-6">
                        <button
                            onClick={handleCancel}
                            className="btn btn-secondary"
                            disabled={saveProfileMutation.isPending}
                        >
                            Cancel
                        </button>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleTestConnection.bind(null, {
                                    id: editingProfile?.id,
                                    name: formData.name,
                                    host: formData.host,
                                    port: formData.port,
                                    username: formData.username,
                                    authType: formData.authType,
                                    keyPath: formData.keyPath || undefined,
                                    passwordId: formData.passwordId || undefined,
                                })}
                                disabled={testLoading === (editingProfile?.id || 'new') || !formData.name || !formData.host || !formData.username}
                                className="btn btn-ghost"
                            >
                                {testLoading === (editingProfile?.id || 'new') ? 'Testing...' : 'Test Connection'}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saveProfileMutation.isPending}
                                className="btn btn-primary"
                            >
                                {saveProfileMutation.isPending ? 'Saving...' : (editingProfile ? 'Update' : 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}