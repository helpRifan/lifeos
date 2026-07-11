import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

/**
 * Animated water circle — gold-themed
 *
 * @param {number} percent - Fill percentage (0-100)
 * @param {number} size - Diameter in px (default 160)
 * @param {boolean} mini - If true, renders a smaller, simplified version
 */
export default function WaterCircle({ percent = 0, size = 160, mini = false }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const r = size / 2
  const padding = mini ? 2 : 4
  const innerR = r - padding

  const fillY = r + innerR - (2 * innerR * (mounted ? percent : 0)) / 100

  const waveHeight = mini ? 3 : 6
  const waveCount = mini ? 1.5 : 2

  const generateWavePath = (yOffset, amplitude, phase = 0) => {
    const points = []
    const steps = 60
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * size
      const y = yOffset + Math.sin((i / steps) * Math.PI * 2 * waveCount + phase) * amplitude
      points.push(`${x},${y}`)
    }
    return `M ${points[0]} ${points.map((p) => `L ${p}`).join(' ')} L ${size},${size} L 0,${size} Z`
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-lg"
      >
        <defs>
          <clipPath id={`water-clip-${size}`}>
            <circle cx={r} cy={r} r={innerR} />
          </clipPath>
          <linearGradient id="gold-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9A84C" />
            <stop offset="100%" stopColor="#A8882E" />
          </linearGradient>
        </defs>

        {/* Background ring */}
        <circle
          cx={r}
          cy={r}
          r={innerR}
          fill="none"
          stroke="#1E1E24"
          strokeWidth={mini ? 2 : 3}
        />

        {/* Inner circle background */}
        <circle
          cx={r}
          cy={r}
          r={innerR - 1}
          fill="#141418"
        />

        {/* Water fill group clipped to circle */}
        <g clipPath={`url(#water-clip-${size})`}>
          {/* Back wave */}
          <motion.path
            d={generateWavePath(fillY + 2, waveHeight * 0.7, 1)}
            fill="url(#gold-water)"
            opacity={0.2}
            initial={{ d: generateWavePath(size, waveHeight * 0.7, 1) }}
            animate={{ d: generateWavePath(fillY + 2, waveHeight * 0.7, 1) }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          />

          {/* Front wave */}
          <motion.path
            d={generateWavePath(fillY, waveHeight, 0)}
            fill="url(#gold-water)"
            opacity={0.45}
            initial={{ d: generateWavePath(size, waveHeight, 0) }}
            animate={{ d: generateWavePath(fillY, waveHeight, 0) }}
            transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
          />

          {/* Solid fill */}
          <motion.rect
            x={0}
            y={fillY + waveHeight}
            width={size}
            height={size}
            fill="url(#gold-water)"
            opacity={0.45}
            initial={{ y: size }}
            animate={{ y: fillY + waveHeight }}
            transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
          />
        </g>

        {/* Circle outline */}
        <circle
          cx={r}
          cy={r}
          r={innerR}
          fill="none"
          stroke="#C9A84C"
          strokeWidth={mini ? 1.5 : 2}
          opacity={0.2}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={`font-[var(--font-headline)] font-semibold text-on-surface ${
            mini ? 'text-sm' : 'text-2xl'
          }`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {Math.round(percent)}%
        </motion.span>
      </div>
    </div>
  )
}
