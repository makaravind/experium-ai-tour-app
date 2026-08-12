import { motion } from 'framer-motion'

export default function Toast({ totalDiscovered }: { totalDiscovered: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      className="absolute left-1/2 flex items-center gap-2 px-5 py-3 rounded-full font-extrabold text-sm whitespace-nowrap"
      style={{
        top: 64,
        x: '-50%',
        background: '#588157',
        color: '#fff',
        boxShadow: '0 8px 24px rgba(63,107,58,.4)',
        zIndex: 35,
        fontFamily: 'var(--font-body)',
      }}
      role="status"
    >
      +1 🌿 <span style={{ opacity: 0.85 }}>· {totalDiscovered}/50 discovered</span>
    </motion.div>
  )
}
