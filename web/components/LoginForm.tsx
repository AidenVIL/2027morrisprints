"use client"
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseBrowser'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

type FormValues = {
  email: string
  password: string
}

export default function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(schema as any) })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password })
      if (error) throw error
      onSuccess?.()
      router.refresh()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <input {...register('email')} placeholder="Email" className="w-full p-2 border rounded" />
      <input {...register('password')} type="password" placeholder="Password" className="w-full p-2 border rounded" />
      <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded" disabled={loading}>{loading ? 'Signing in...' : 'Log in'}</button>
    </form>
  )
}
