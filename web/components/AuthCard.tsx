"use client"
import React, { useState } from 'react'
import AuthToggle from './AuthToggle'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'

export default function AuthCard() {
  const [mode, setMode] = useState<'login'|'signup'>('login')

  return (
    <div className="w-full max-w-sm bg-white border rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Welcome</h3>
        <AuthToggle value={mode} onChange={setMode} />
      </div>
      <div>
        {mode === 'login' ? <LoginForm /> : <SignupForm />}
      </div>
    </div>
  )
}
