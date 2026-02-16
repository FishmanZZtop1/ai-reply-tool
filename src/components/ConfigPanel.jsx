/**
 * ConfigPanel - Spring-animated Chips and Toggle
 */

import { memo, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs } from '../motion/config'

const SCENE_OPTIONS = ['💼 Work Email', '💬 Social Chat', '🏠 Family', '🎧 Customer Service', '💕 Dating', '🎯 Job Interview']
const ROLE_OPTIONS = ['👔 Boss / Manager', '🤝 Colleague', '😊 Friend', '👨‍👩‍👧 Family', '❤️ Partner', '💼 Client', '👤 Stranger']
const STYLE_OPTIONS = ['📋 Professional', '🤗 Friendly', '😂 Humorous', '⚡ Direct', '🌸 Subtle', '🎉 Enthusiastic']

// Animated Chip Button
function Chip({ label, isSelected, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            className={`px-5 py-2.5 rounded-full text-sm font-medium ${isSelected
                ? 'bg-gradient-to-r from-[#E413A2] to-[#FF789A] text-white'
                : 'bg-gray-100 text-gray-600'}`}
            style={{
                boxShadow: isSelected
                    ? '0 4px 16px rgba(228, 19, 162, 0.35), 0 0 0 2px rgba(228, 19, 162, 0.15)'
                    : '0 1px 3px rgba(0,0,0,0.05)'
            }}
            whileHover={{
                scale: 1.05,
                y: -2,
                boxShadow: isSelected
                    ? '0 8px 28px rgba(228, 19, 162, 0.45), 0 0 0 3px rgba(228, 19, 162, 0.2)'
                    : '0 6px 20px rgba(0,0,0,0.08)'
            }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            layout
        >
            {label}
        </motion.button>
    )
}

const ChipGroup = memo(function ChipGroup({ options, selected, onSelect, allowCustom = false, customValue, onCustomChange }) {
    const [showCustomInput, setShowCustomInput] = useState(false)

    const handleCustomClick = () => {
        setShowCustomInput(true)
        onSelect('custom')
    }

    return (
        <div className="flex flex-wrap gap-2">
            {options.map((option) => (
                <Chip
                    key={option}
                    label={option}
                    isSelected={selected === option}
                    onClick={() => {
                        setShowCustomInput(false)
                        onSelect(option)
                    }}
                />
            ))}
            {allowCustom && (
                <>
                    <Chip
                        label="+ Custom"
                        isSelected={selected === 'custom'}
                        onClick={handleCustomClick}
                    />
                    <AnimatePresence>
                        {showCustomInput && (
                            <motion.input
                                type="text"
                                value={customValue || ''}
                                onChange={(e) => onCustomChange?.(e.target.value)}
                                placeholder="Enter custom..."
                                className="px-4 py-2.5 text-sm rounded-full border border-pink-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400 min-w-[140px]"
                                autoFocus
                                initial={{ opacity: 0, scale: 0.8, width: 0 }}
                                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                                exit={{ opacity: 0, scale: 0.8, width: 0 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            />
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    )
})

const RadioGroup = memo(function RadioGroup({ options, selected, onSelect, minWidth }) {
    return (
        <div className="flex gap-2">
            {options.map((option) => (
                <motion.button
                    key={option}
                    onClick={() => onSelect(option)}
                    style={{ minWidth: minWidth || 'auto' }}
                    className={`px-5 py-2.5 rounded-full text-sm font-medium ${selected === option
                        ? 'bg-gradient-to-r from-[#E413A2] to-[#FF789A] text-white'
                        : 'bg-gray-100 text-gray-600'}`}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                    {option}
                </motion.button>
            ))}
        </div>
    )
})

// Animated Toggle Switch - Fixed positioning
function Toggle({ isOn, onToggle }) {
    return (
        <motion.button
            onClick={onToggle}
            aria-label={isOn ? 'Disable emoji usage' : 'Enable emoji usage'}
            className={`relative w-14 h-8 rounded-full cursor-pointer ${isOn
                ? 'bg-gradient-to-r from-[#E413A2] to-[#FF789A]'
                : 'bg-gray-300'}`}
            style={{
                boxShadow: isOn
                    ? '0 4px 14px rgba(228, 19, 162, 0.4), 0 0 0 2px rgba(228, 19, 162, 0.15)'
                    : 'inset 0 2px 4px rgba(0,0,0,0.1)'
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
            <motion.span
                className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md"
                animate={{ x: isOn ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
        </motion.button>
    )
}

const ConfigPanel = memo(function ConfigPanel({
    config,
    onConfigChange,
    sceneOptions = SCENE_OPTIONS,
    roleOptions = ROLE_OPTIONS,
    styleOptions = STYLE_OPTIONS,
}) {
    const handleSceneChange = useCallback((value) => {
        onConfigChange({ ...config, scene: value })
    }, [config, onConfigChange])

    const handleSceneCustomChange = useCallback((value) => {
        onConfigChange({ ...config, sceneCustom: value })
    }, [config, onConfigChange])

    const handleRoleChange = useCallback((value) => {
        onConfigChange({ ...config, role: value })
    }, [config, onConfigChange])

    const handleRoleCustomChange = useCallback((value) => {
        onConfigChange({ ...config, roleCustom: value })
    }, [config, onConfigChange])

    const handleStyleChange = useCallback((value) => {
        onConfigChange({ ...config, style: value })
    }, [config, onConfigChange])

    const handleLengthChange = useCallback((value) => {
        onConfigChange({ ...config, length: value })
    }, [config, onConfigChange])

    const handleVariationChange = useCallback((value) => {
        onConfigChange({ ...config, variations: value })
    }, [config, onConfigChange])

    const handleEmojiToggle = useCallback(() => {
        onConfigChange({ ...config, emoji: !config.emoji })
    }, [config, onConfigChange])

    return (
        <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', ...springs.smooth }}
        >
            {/* Reply Scene */}
            <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">
                    Reply Scene
                </label>
                <ChipGroup
                    options={sceneOptions}
                    selected={config.scene}
                    onSelect={handleSceneChange}
                    allowCustom={true}
                    customValue={config.sceneCustom}
                    onCustomChange={handleSceneCustomChange}
                />
            </div>

            {/* Who Sent This */}
            <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">
                    Who Sent This
                </label>
                <ChipGroup
                    options={roleOptions}
                    selected={config.role}
                    onSelect={handleRoleChange}
                    allowCustom={true}
                    customValue={config.roleCustom}
                    onCustomChange={handleRoleCustomChange}
                />
            </div>

            {/* Reply Style */}
            <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">
                    Reply Style
                </label>
                <ChipGroup
                    options={styleOptions}
                    selected={config.style}
                    onSelect={handleStyleChange}
                />
            </div>

            {/* Length & Variations */}
            <div className="flex flex-wrap gap-8">
                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">
                        Length
                    </label>
                    <RadioGroup
                        options={['Shorter', 'Longer']}
                        selected={config.length}
                        onSelect={handleLengthChange}
                        minWidth="72px"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">
                        Variations
                    </label>
                    <RadioGroup
                        options={['1', '3', '5']}
                        selected={config.variations}
                        onSelect={handleVariationChange}
                        minWidth="72px"
                    />
                </div>
            </div>

            {/* Use Emoji Toggle */}
            <div className="flex items-center gap-4 pt-2">
                <Toggle isOn={config.emoji} onToggle={handleEmojiToggle} />
                <span className={`text-sm font-medium transition-colors ${config.emoji ? 'text-[#E413A2]' : 'text-gray-500'}`}>
                    Use Emoji 😊
                </span>
                <AnimatePresence>
                    {config.emoji && (
                        <motion.span
                            className="text-xs text-[#E413A2] bg-pink-50 px-2 py-1 rounded-full"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        >
                            Enabled
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    )
})

export default ConfigPanel
