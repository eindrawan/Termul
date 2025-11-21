import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
    theme: Theme
    toggleTheme: () => void
    setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}

interface ThemeProviderProps {
    children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>('light')

    useEffect(() => {
        const loadTheme = async () => {
            try {
                const savedTheme = await window.electronAPI.getSetting('theme')
                if (savedTheme === 'dark' || savedTheme === 'light') {
                    setThemeState(savedTheme)
                } else {
                    // Fallback to localStorage if not found in DB (migration path)
                    const localTheme = localStorage.getItem('theme') as Theme | null
                    if (localTheme) {
                        setThemeState(localTheme)
                        // Migrate to DB
                        await window.electronAPI.saveSetting('theme', localTheme)
                    }
                }
            } catch (error) {
                console.error('Failed to load theme:', error)
            }
        }
        loadTheme()
    }, [])

    useEffect(() => {
        // Update localStorage as backup
        localStorage.setItem('theme', theme)

        // Save to DB
        window.electronAPI.saveSetting('theme', theme).catch(err =>
            console.error('Failed to save theme:', err)
        )

        // Update document class for CSS targeting
        document.documentElement.classList.remove('light', 'dark')
        document.documentElement.classList.add(theme)
    }, [theme])

    const toggleTheme = () => {
        setThemeState(prevTheme => prevTheme === 'light' ? 'dark' : 'light')
    }

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme)
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}