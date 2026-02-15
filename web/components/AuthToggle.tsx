"use client"
import React from 'react'

type Props = {
  value: 'login' | 'signup'
  onChange: (v: 'login' | 'signup') => void
}

export default function AuthToggle({ value, onChange }: Props) {
  return (
    <div className="relative inline-flex items-center bg-gray-200 rounded-full p-1" role="tablist" aria-label="Authentication">
      <button
        role="tab"
        aria-selected={value === 'login'}
        className={`relative z-10 px-4 py-1 rounded-full focus:outline-none ${value === 'login' ? 'text-white' : 'text-gray-700'}`}
        onClick={() => onChange('login')}
      >
        Log in
      </button>
      <button
        role="tab"
        aria-selected={value === 'signup'}
        className={`relative z-10 px-4 py-1 rounded-full focus:outline-none ${value === 'signup' ? 'text-white' : 'text-gray-700'}`}
        onClick={() => onChange('signup')}
      >
        Sign up
      </button>
      <div
        aria-hidden
        className={`absolute top-0 left-0 h-full w-1/2 bg-indigo-600 rounded-full transform transition-transform duration-200 ${value === 'signup' ? 'translate-x-full' : 'translate-x-0'}`}
        style={{ width: '50%' }}
      />
    </div>
  )
}
