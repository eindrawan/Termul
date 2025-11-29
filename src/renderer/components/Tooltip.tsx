import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
    className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    position = 'bottom',
    delay = 200,
    className = ''
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showTooltip = () => {
        timeoutRef.current = setTimeout(() => {
            setIsMounted(true);
            // Small delay to allow mount before fading in
            requestAnimationFrame(() => setIsVisible(true));
        }, delay);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
        // Wait for animation to finish before unmounting
        setTimeout(() => setIsMounted(false), 200);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    return (
        <div
            className={`relative inline-block ${className}`}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onFocus={showTooltip}
            onBlur={hideTooltip}
        >
            {children}
            {isMounted && (
                <div
                    className={`
                        absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-md whitespace-nowrap dark:bg-gray-700 pointer-events-none
                        transition-opacity duration-200 ease-in-out
                        ${positionClasses[position]}
                        ${isVisible ? 'opacity-100' : 'opacity-0'}
                    `}
                    role="tooltip"
                >
                    {content}
                    {/* Arrow (Optional, can be removed for ultra-minimalist look) */}
                    {/* <div className={`absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45 
                        ${position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' : ''}
                        ${position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' : ''}
                        ${position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' : ''}
                        ${position === 'right' ? 'left-[-4px] top-1/2 -translate-y-1/2' : ''}
                    `} /> */}
                </div>
            )}
        </div>
    );
};
