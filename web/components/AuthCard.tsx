"use client"
import React, { useState } from 'react'
import AuthToggle from './AuthToggle'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'
import { useRouter } from 'next/navigation'

export default function AuthCard({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<'login'|'signup'>('login')
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  function handleSuccess() {
    setMessage('Successfully signed in')
    onSuccess?.()
    // route to dashboard after a short delay
    setTimeout(() => {
      try { router.push('/dashboard') } catch (_) { router.refresh() }
    }, 800)
  }

  return (
    <div className="w-full max-w-sm bg-white border rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Welcome</h3>
        <AuthToggle value={mode} onChange={setMode} />
      </div>
      <div>
        {message && <div className="mb-3 text-sm text-green-600">{message}</div>}
        {mode === 'login' ? <LoginForm onSuccess={handleSuccess} /> : <SignupForm onSuccess={handleSuccess} />}
      </div>
    </div>
  )
}
