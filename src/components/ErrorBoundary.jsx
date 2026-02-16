import React from 'react'
import { motion } from 'framer-motion'
import { springs } from '../motion/config'

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo)
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null })
        window.location.reload()
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div
                        className="bg-white rounded-2xl p-8 max-w-sm text-center shadow-2xl"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', ...springs.bouncy }}
                    >
                        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-3xl">
                            ⚠️
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
                        <p className="text-gray-500 mb-6 text-sm">
                            We encountered an issue loading this component.
                        </p>
                        <button
                            onClick={this.handleRetry}
                            className="w-full py-3 px-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
                        >
                            Reload Page
                        </button>
                    </motion.div>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
