import { PinIcon } from '@/components/icons'

export default function MapStub({ discovered }: { discovered: boolean }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{
        background: 'radial-gradient(120% 90% at 20% 12%, #eef3e6 0%, #e6efdc 40%, #dfe9d2 100%)',
      }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path
          d="M-30 120 Q90 60 200 130 T430 150 L430 380 Q300 340 180 400 T-30 380 Z"
          fill="#d7e6c4"
          opacity=".9"
        />
        <path
          d="M-30 470 Q120 420 250 500 T430 520 L430 900 L-30 900 Z"
          fill="#cfe0ba"
          opacity=".85"
        />
        <ellipse cx="290" cy="560" rx="86" ry="60" fill="#bcd6e3" />
        <path
          d="M60 820 C120 700 40 620 120 540 S250 460 190 360 300 230 210 140 250 60 210 10"
          fill="none"
          stroke="#efe9d8"
          strokeWidth="20"
          strokeLinecap="round"
        />
        <g fill="#7fa06a" stroke="#5f7f4d" strokeWidth="2">
          <circle cx="70" cy="230" r="15" />
          <circle cx="330" cy="300" r="14" />
          <circle cx="55" cy="420" r="12" />
          <circle cx="150" cy="680" r="16" />
          <circle cx="345" cy="700" r="13" />
        </g>
      </svg>

      {/* GPS dot */}
      <div className="absolute" style={{ left: 170, top: 470, transform: 'translate(-50%, -50%)' }}>
        <div
          className="rounded-full"
          style={{
            width: 120,
            height: 120,
            background: 'rgba(74,144,217,.14)',
            border: '1px solid rgba(74,144,217,.4)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 14,
            height: 14,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            background: '#4a90d9',
            border: '2.5px solid #fff',
            boxShadow: '0 1px 4px rgba(43,43,43,.35)',
          }}
        />
      </div>

      {/* Current exhibit pin */}
      <div
        className="absolute"
        style={{
          left: 200,
          top: 430,
          transform: 'translate(-50%, -100%)',
          filter: 'drop-shadow(0 3px 3px rgba(43,43,43,.22))',
        }}
      >
        <PinIcon fill={discovered ? '#588157' : '#dda15e'} />
      </div>
    </div>
  )
}
