import { useState } from 'react'
import { useConnection } from '../contexts/ConnectionContext'

export function useReconnect(connectionId: string, onReconnectSuccess?: () => void) {
    const [showReconnectDialog, setShowReconnectDialog] = useState(false)
    const { state: connectionState, connectMutation } = useConnection()
    const connection = connectionState.activeConnections.get(connectionId)

    const handleReconnect = async () => {
        if (!connection?.profile) return

        try {
            setShowReconnectDialog(false)
            await connectMutation.mutateAsync(connection.profile)
            if (onReconnectSuccess) {
                onReconnectSuccess()
            }
        } catch (err) {
            console.error('Failed to reconnect:', err)
            // If reconnection fails, show the dialog again so they can retry
            setShowReconnectDialog(true)
        }
    }

    return {
        showReconnectDialog,
        setShowReconnectDialog,
        handleReconnect
    }
}
