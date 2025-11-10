import React, { useState, useEffect } from 'react'
import { useConnection } from '../contexts/ConnectionContext'
import { ConnectionProfile } from '../types'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import ConfirmDialog from './ConfirmDialog'
import AlertDialog from './AlertDialog'
import PromptDialog from './PromptDialog'

interface ManageProfilesDialogProps {
    isOpen: boolean
    onClose: () => void
    editingProfile?: ConnectionProfile | null
}

interface ProfileFormData {
    name: string
    host: string
    port: number
    username: string
    authType: 'password' | 'ssh-key' | 'private-key'
    keyPath: string
    passwordId: string
    passphrase: string
}

interface ProfileFormErrors {
    name?: string
    host?: string
    port?: string
    username?: string
    keyPath?: string
    passwordId?: string
    passphrase?: string
}

const initialFormData: ProfileFormData = {
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password',
    keyPath: '',
    passwordId: '',
    passphrase: '',
}

export default function ManageProfilesDialog({ isOpen, onClose, editingProfile: externalEditingProfile }: ManageProfilesDialogProps) {
    const { saveProfileMutation, deleteProfileMutation } = useConnection()
    const [formData, setFormData] = useState<ProfileFormData>(initialFormData)
    const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null)
    const [testLoading, setTestLoading] = useState<string | null>(null)
    const [errors, setErrors] = useState<ProfileFormErrors>({})
    const [showPassword, setShowPassword] = useState(false)
    const [showPassphrase, setShowPassphrase] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [profileToDelete, setProfileToDelete] = useState<string | null>(null)

    // Alert dialog state
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean
        message: string
        variant: 'success' | 'error' | 'warning' | 'info'
    }>({ isOpen: false, message: '', variant: 'info' })

    // Prompt dialog state
    const [promptDialog, setPromptDialog] = useState<{
        isOpen: boolean
        message: string
        onConfirm: (value: string) => void
    }>({ isOpen: false, message: '', onConfirm: () => { } })

    useEffect(() => {
        if (isOpen) {
            setFormData(initialFormData)
            setEditingProfile(externalEditingProfile || null)
            setErrors({})
            setShowPassword(false)
            setShowPassphrase(false)
        }
    }, [isOpen, externalEditingProfile])

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
        if ((formData.authType === 'ssh-key' || formData.authType === 'private-key') && !formData.keyPath.trim()) {
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
                setAlertDialog({
                    isOpen: true,
                    message: 'Failed to store password securely: ' + (error as Error).message,
                    variant: 'error'
                });
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
        if ((formData.authType === 'ssh-key' || formData.authType === 'private-key') && formData.keyPath.trim()) {
            profile.keyPath = formData.keyPath.trim()
            // Include passphrase if provided
            if (formData.passphrase.trim()) {
                profile.passphrase = formData.passphrase.trim()
            }
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
        setShowPassphrase(false)
        onClose()
    }


    // Initialize form data when editingProfile prop changes
    useEffect(() => {
        if (externalEditingProfile) {
            setFormData({
                name: externalEditingProfile.name,
                host: externalEditingProfile.host,
                port: externalEditingProfile.port,
                username: externalEditingProfile.username,
                authType: externalEditingProfile.authType,
                keyPath: externalEditingProfile.keyPath || '',
                passwordId: externalEditingProfile.passwordId || '',
                passphrase: '', // Don't populate passphrase for security reasons
            })
        }
    }, [externalEditingProfile])


    const handleTestConnection = async (profile: ConnectionProfile) => {
        setTestLoading(profile.id || 'new')
        try {
            const success = await window.electronAPI.testConnection(profile)
            if (success) {
                setAlertDialog({
                    isOpen: true,
                    message: 'Connection test successful!',
                    variant: 'success'
                })
            } else {
                setAlertDialog({
                    isOpen: true,
                    message: 'Connection test failed: Unable to connect to the server with the provided credentials.',
                    variant: 'error'
                })
            }
        } catch (error) {
            setAlertDialog({
                isOpen: true,
                message: 'Connection test failed: ' + (error as Error).message,
                variant: 'error'
            })
        } finally {
            setTestLoading(null)
        }
    }

    const handleDelete = (profileId: string) => {
        setProfileToDelete(profileId)
        setShowDeleteConfirm(true)
    }

    const confirmDelete = () => {
        if (profileToDelete) {
            deleteProfileMutation.mutate(profileToDelete)
            setShowDeleteConfirm(false)
            setProfileToDelete(null)
            onClose()
        }
    }

    const cancelDelete = () => {
        setShowDeleteConfirm(false)
        setProfileToDelete(null)
    }

    const handleCancel = () => {
        // Reset all form states to initial values to ensure inputs remain functional
        setFormData(initialFormData)
        setEditingProfile(null)
        setErrors({})
        setShowPassword(false)
        setShowPassphrase(false)
        onClose()
    }

    if (!isOpen) return null

    return (
        <>
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete Profile"
                message="Are you sure you want to delete this profile? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
                variant="danger"
            />

            <AlertDialog
                isOpen={alertDialog.isOpen}
                message={alertDialog.message}
                variant={alertDialog.variant}
                onConfirm={() => setAlertDialog({ ...alertDialog, isOpen: false })}
            />

            <PromptDialog
                isOpen={promptDialog.isOpen}
                message={promptDialog.message}
                inputType="password"
                onConfirm={promptDialog.onConfirm}
                onCancel={() => setPromptDialog({ ...promptDialog, isOpen: false })}
            />

            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    {/* Profile Form */}
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
                                        authType: e.target.value as 'password' | 'ssh-key' | 'private-key',
                                        passwordId: '',
                                        keyPath: ''
                                    })
                                    setShowPassword(false)
                                }}
                                className="w-full p-2 border border-gray-300 rounded"
                            >
                                <option value="password">Password</option>
                                <option value="ssh-key">SSH Key</option>
                                <option value="private-key">Private Key File</option>
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
                                        className="px-3 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors text-sm"
                                        onClick={() => {
                                            setPromptDialog({
                                                isOpen: true,
                                                message: 'Enter password for this profile:',
                                                onConfirm: async (password) => {
                                                    setPromptDialog({ ...promptDialog, isOpen: false })
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
                                                            setAlertDialog({
                                                                isOpen: true,
                                                                message: 'Failed to store password securely: ' + (error as Error).message,
                                                                variant: 'error'
                                                            });
                                                        }
                                                    }
                                                }
                                            })
                                        }}
                                    >
                                        Set
                                    </button>
                                </div>
                                {errors.passwordId && <div className="text-red-500 text-xs mt-1">{errors.passwordId}</div>}
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        {formData.authType === 'ssh-key' ? 'SSH Key File' : 'Private Key File'} *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.keyPath}
                                        onChange={(e) => setFormData({ ...formData, keyPath: e.target.value })}
                                        className={`w-full p-2 border rounded ${errors.keyPath ? 'border-red-500' : 'border-gray-300'}`}
                                        placeholder={formData.authType === 'ssh-key' ?
                                            "C:\\Users\\user\\.ssh\\id_rsa" :
                                            "C:\\Users\\user\\.ssh\\id_rsa"}
                                    />
                                    {errors.keyPath && <div className="text-red-500 text-xs mt-1">{errors.keyPath}</div>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Passphrase (Optional)</label>
                                    <div className="relative">
                                        <input
                                            type={showPassphrase ? "text" : "password"}
                                            value={formData.passphrase}
                                            onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                                            className={`w-full p-2 pr-10 border rounded ${errors.passphrase ? 'border-red-500' : 'border-gray-300'}`}
                                            placeholder="Enter passphrase for private key"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                            onClick={() => setShowPassphrase(!showPassphrase)}
                                        >
                                            {showPassphrase ? (
                                                <EyeSlashIcon className="h-5 w-5" />
                                            ) : (
                                                <EyeIcon className="h-5 w-5" />
                                            )}
                                        </button>
                                    </div>
                                    {errors.passphrase && <div className="text-red-500 text-xs mt-1">{errors.passphrase}</div>}
                                    <p className="text-xs text-gray-500 mt-1">
                                        Leave empty if the private key is not encrypted with a passphrase
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex justify-between mt-6">
                        {editingProfile && (
                            <button
                                onClick={() => handleDelete(editingProfile.id!)}
                                disabled={deleteProfileMutation.isPending}
                                className="px-4 py-2 text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {deleteProfileMutation.isPending ? 'Deleting...' : 'Delete Profile'}
                            </button>
                        )}
                        <div className="flex space-x-3 ml-auto">
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                                disabled={saveProfileMutation.isPending}
                            >
                                Cancel
                            </button>
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
                                    passphrase: formData.passphrase || undefined,
                                })}
                                disabled={testLoading === (editingProfile?.id || 'new') || !formData.name || !formData.host || !formData.username}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {testLoading === (editingProfile?.id || 'new') ? 'Testing...' : 'Test Connection'}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saveProfileMutation.isPending}
                                className="px-4 py-2 text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saveProfileMutation.isPending ? 'Saving...' : (editingProfile ? 'Update' : 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}