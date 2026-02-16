import { useState, useRef, useEffect, useCallback } from 'react'

// Custom debounce hook
export function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value)

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => clearTimeout(handler)
    }, [value, delay])

    return debouncedValue
}

// Debounced callback hook - prevents rapid fire function calls
export function useDebouncedCallback(callback, delay) {
    const timeoutRef = useRef(null)
    const callbackRef = useRef(callback)

    // Keep callback ref updated
    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    const debouncedCallback = useCallback((...args) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = setTimeout(() => {
            callbackRef.current(...args)
        }, delay)
    }, [delay])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [])

    return debouncedCallback
}

// Throttle hook - ensures function is called at most once per interval
export function useThrottle(callback, limit) {
    const inThrottleRef = useRef(false)
    const callbackRef = useRef(callback)

    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    return useCallback((...args) => {
        if (!inThrottleRef.current) {
            callbackRef.current(...args)
            inThrottleRef.current = true
            setTimeout(() => {
                inThrottleRef.current = false
            }, limit)
        }
    }, [limit])
}
