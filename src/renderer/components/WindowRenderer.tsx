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
                    defaultWidth={windowConfig.defaultPosition.width}
                    defaultHeight={windowConfig.defaultPosition.height}
                    minWidth={windowConfig.minSize.width}
                    minHeight={windowConfig.minSize.height}
                    onClose={windowConfig.onClose}
                >
                    {windowConfig.content}
                </Window>
            ))}
        </>
    )
}

