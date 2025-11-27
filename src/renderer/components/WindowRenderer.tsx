import React from 'react'
import { useWindowManager } from '../contexts/WindowManagerContext'
import Window from './Window'

export default function WindowRenderer() {
    const { getAllWindows } = useWindowManager()
    const windows = getAllWindows()

    return (
        <>
            {windows.map((windowConfig) => (
                <Window
                    key={windowConfig.id}
                    id={windowConfig.id}
                    title={windowConfig.title}
                    subtitle={windowConfig.subtitle}
                    defaultWidth={windowConfig.defaultPosition?.width || windowConfig.position?.width || 800}
                    defaultHeight={windowConfig.defaultPosition?.height || windowConfig.position?.height || 600}
                    minWidth={windowConfig.minSize?.width || 400}
                    minHeight={windowConfig.minSize?.height || 300}
                    onClose={windowConfig.onClose}
                >
                    {windowConfig.content}
                </Window>
            ))}
        </>
    )
}

