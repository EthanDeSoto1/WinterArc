import { useId } from 'react'

export default function ProgressRing({ done, total }) {
  const gradientId = useId()
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const fraction = total === 0 ? 0 : done / total
  const complete = total > 0 && done === total

  return (
    <div className="relative flex size-[76px] items-center justify-center">
      <svg viewBox="0 0 76 76" className={`absolute inset-0 -rotate-90 ${complete ? 'drop-shadow-[0_0_10px_rgb(174_219_255/0.6)]' : ''}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f4f9ff" />
            <stop offset="100%" stopColor="#84c5ff" />
          </linearGradient>
        </defs>
        <circle cx="38" cy="38" r={radius} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="5" />
        {fraction > 0 && (
          <circle
            cx="38"
            cy="38"
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        )}
      </svg>
      <span className="text-[15px] font-semibold tabular-nums text-ice-50">
        {done}/{total}
      </span>
    </div>
  )
}
