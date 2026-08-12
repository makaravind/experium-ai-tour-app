'use client'

import { motion } from 'framer-motion'
import { CloseIcon, LeafIcon } from '@/components/icons'

const CONFETTI_COLORS = ['#ffffff', '#dda15e', '#a3b18a', '#f8f7f4', '#b8834a']

// Pre-compute so render stays pure
const CONFETTI_PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  delay: `${((i * 0.11) % 0.9).toFixed(2)}s`,
  rotate: `${(i * 23) % 180}deg`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}))

export default function MilestoneCelebration({
  totalDiscovered,
  onDismiss,
}: {
  totalDiscovered: number
  onDismiss: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 flex flex-col items-center justify-center text-center px-8 overflow-hidden"
      style={{
        background: 'linear-gradient(165deg, #588157 0%, #3f6b3a 100%)',
        zIndex: 45,
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {CONFETTI_PARTICLES.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-sm"
            style={{
              width: 9,
              height: 14,
              left: p.left,
              top: -20,
              background: p.color,
              transform: `rotate(${p.rotate})`,
              animation: `fall 2.6s ease-in ${p.delay} forwards`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes fall {
          0% { transform: translateY(-40px) rotate(0); opacity: 0; }
          12% { opacity: .95; }
          100% { transform: translateY(560px) rotate(320deg); opacity: .9; }
        }
      `}</style>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="absolute top-14 right-5 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,.16)', border: 'none', zIndex: 4 }}
        aria-label="Dismiss"
      >
        <CloseIcon size={16} color="#fff" strokeWidth={2.4} />
      </button>

      <div className="relative flex flex-col items-center" style={{ zIndex: 3 }}>
        {/* Badge */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.08 }}
          className="rounded-full flex items-center justify-center mb-6"
          style={{ width: 132, height: 132, border: '3px dashed rgba(255,255,255,.55)' }}
        >
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: 98,
              height: 98,
              background: 'rgba(255,255,255,.14)',
              border: '2px solid rgba(255,255,255,.4)',
            }}
          >
            <LeafIcon size={46} color="#fff" strokeWidth={1.8} />
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.22, duration: 0.35 }}
        >
          <p
            className="text-xs font-extrabold uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,.7)', letterSpacing: '0.18em' }}
          >
            Milestone reached
          </p>
          <h2
            className="mt-2 text-xl font-bold"
            style={{ fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '-0.3px' }}
          >
            {totalDiscovered === 1
              ? 'First Discovery!'
              : `Explorer — ${totalDiscovered} Discovered!`}
          </h2>
          <p className="mt-1 text-sm font-semibold" style={{ color: 'rgba(255,255,255,.85)' }}>
            {totalDiscovered >= 10
              ? "You're deep in the park. Keep going!"
              : totalDiscovered >= 3
                ? 'Warming up nicely!'
                : 'Your journey begins!'}
          </p>

          <button
            onClick={onDismiss}
            className="btn-3d-orange mt-8 h-14 px-8 rounded-2xl font-extrabold text-base flex items-center gap-2"
            style={{ background: '#dda15e', color: '#fff', border: 'none' }}
          >
            Keep exploring →
          </button>
        </motion.div>
      </div>
    </motion.div>
  )
}
