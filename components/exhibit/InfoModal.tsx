'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

const inputStyle = {
  width: '100%',
  height: 48,
  border: '1px solid #e8e5df',
  borderRadius: 12,
  padding: '0 14px',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: '#2b2b2b',
  background: '#fff',
  outline: 'none',
}

const labelClass = 'block text-xs font-extrabold uppercase tracking-wider mb-1.5'
const labelStyle = { color: '#8a8a8a', letterSpacing: '0.05em' }

export default function InfoModal({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const commit = () => {
    localStorage.setItem('experium_user_info', JSON.stringify({ name, phone, email }))
    localStorage.setItem('experium_onboarded', '1')
    onDone()
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{ background: '#f8f7f4', fontFamily: 'var(--font-body)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: '#fff', boxShadow: '0 12px 34px rgba(43,43,43,.14)' }}
      >
        <h2
          className="text-lg font-bold"
          style={{ fontFamily: 'var(--font-display)', color: '#2b2b2b', letterSpacing: '-0.3px' }}
        >
          Personalize your experience
        </h2>
        <p className="mt-1 text-sm font-semibold" style={{ color: '#8a8a8a' }}>
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
          className="btn-3d-green w-full h-14 mt-5 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2"
          style={{ background: '#588157', color: '#fff', border: 'none' }}
        >
          Continue →
        </button>
        <button
          onClick={commit}
          className="w-full mt-3.5 py-1.5 font-bold text-sm text-center"
          style={{ background: 'none', border: 'none', color: '#8a8a8a' }}
        >
          Skip for now
        </button>
      </motion.div>
    </div>
  )
}
