"use client"
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { ensureSupabase } from '../lib/supabaseClient'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1)
})

type FormValues = z.infer<typeof schema>

export default function SignupForm({ onSuccess }: { onSuccess?: () => void }) {
  const { register, handleSubmit } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const supabase = ensureSupabase()
      const { data, error } = await supabase.auth.signUp({ email: values.email, password: values.password }, { data: { name: values.name } })
      if (error) throw error
      onSuccess?.()
      router.refresh()
    } catch (err: any) {
      alert(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <input {...register('name')} placeholder="Full name" className="w-full p-2 border rounded" />
      <input {...register('email')} placeholder="Email" className="w-full p-2 border rounded" />
      <input {...register('password')} type="password" placeholder="Password" className="w-full p-2 border rounded" />
      <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded" disabled={loading}>{loading ? 'Signing up...' : 'Create account'}</button>
    </form>
  )
}
