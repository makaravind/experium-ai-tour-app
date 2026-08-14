'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '@/lib/store'

const inputStyle = {
  width: '100%',
  height: 48,
  border: '1px solid var(--color-ex-border)',
  borderRadius: 12,
  padding: '0 14px',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--color-ex-ink)',
  background: 'var(--color-ex-paper)',
  outline: 'none',
}

const labelClass = 'block text-xs font-extrabold uppercase tracking-wider mb-1.5 text-ex-muted'
const labelStyle = { letterSpacing: '0.05em' }

export default function InfoModal({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const visitorId = useStore((s) => s.visitorId)
  const setUserInfo = useStore((s) => s.setUserInfo)

  const commit = () => {
    localStorage.setItem('experium_user_info', JSON.stringify({ name, phone, email }))
    localStorage.setItem('experium_onboarded', '1')
    setUserInfo({ name, phone, email })
    if (visitorId && (name || phone || email)) {
      fetch('/api/user/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId, name, phone, email }),
      }).catch(() => {})
    }
    onDone()
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6 bg-ex-bg"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-sm rounded-2xl p-6 bg-ex-paper"
        style={{ boxShadow: 'var(--ex-shadow-modal)' }}
      >
        <h2
          className="text-lg font-bold text-ex-ink"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}
        >
          Personalize your experience
        </h2>
        <p className="mt-1 text-sm font-semibold text-ex-muted">
          Optional — helps us tailor recommendations.
        </p>

        <label className="block mt-3.5">
          <span className={labelClass} style={labelStyle}>
            Name
          </span>
          <input
            style={inputStyle}
            type="text"
            placeholder="Your name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block mt-3.5">
          <span className={labelClass} style={labelStyle}>
            Phone
          </span>
          <input
            style={inputStyle}
            type="tel"
            placeholder="Phone number"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="block mt-3.5">
          <span className={labelClass} style={labelStyle}>
            Email
          </span>
          <input
            style={inputStyle}
            type="email"
            placeholder="Email address"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <button
          onClick={commit}
          className="btn-3d-green w-full h-14 mt-5 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 bg-ex-forest text-white"
          style={{ border: 'none' }}
        >
          Continue →
        </button>
        <button
          onClick={commit}
          className="w-full mt-3.5 py-1.5 font-bold text-sm text-center text-ex-muted"
          style={{ background: 'none', border: 'none' }}
        >
          Skip for now
        </button>
      </motion.div>
    </div>
  )
}
