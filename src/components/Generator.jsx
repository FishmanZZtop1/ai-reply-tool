import { useState, useCallback, memo } from 'react'
import ConfigPanel from './ConfigPanel'
import ContentPanel from './ContentPanel'

const Generator = memo(function Generator({
    onGenerate,
    results,
    isLoading,
    optionCatalog,
    errorMessage,
}) {
    const [config, setConfig] = useState({
        scene: '',
        role: '',
        style: '',
        length: 'Shorter',
        variations: '3',
        emoji: true,
        message: '',
        notes: '',
        sceneCustom: '',
        roleCustom: '',
    })

    const handleConfigChange = useCallback((newConfig) => {
        setConfig(newConfig)
    }, [])

    return (
        <div
            className="rounded-3xl overflow-hidden"
            style={{
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
                border: '1px solid rgba(0,0,0,0.04)',
                animation: 'float-up 600ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
        >
            <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Left Panel - Configuration - Slightly darker bg */}
                <div
                    className="p-6 lg:p-8"
                    style={{ background: '#F8F8FA' }}
                >
                    <ConfigPanel
                        config={config}
                        onConfigChange={handleConfigChange}
                        sceneOptions={optionCatalog?.scenes}
                        roleOptions={optionCatalog?.roles}
                        styleOptions={optionCatalog?.styles}
                    />
                </div>

                {/* Right Panel - Content + Results - White bg */}
                <div
                    className="p-6 lg:p-8"
                    style={{ background: '#FFFFFF' }}
                >
                    <ContentPanel
                        config={config}
                        onConfigChange={handleConfigChange}
                        onGenerate={onGenerate}
                        isLoading={isLoading}
                        results={results}
                        errorMessage={errorMessage}
                    />
                </div>
            </div>

            <style>{`
                @keyframes float-up {
                    0% { opacity: 0; transform: translateY(30px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
})

export default Generator
