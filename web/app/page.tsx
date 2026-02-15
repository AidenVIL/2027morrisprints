"use client"
import React from 'react'
import AuthCard from '../components/AuthCard'
import GetStartedCTA from '../components/GetStartedCTA'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <section>
          <h1 className="text-4xl font-bold text-gray-900">Fast, affordable 3D print quotes</h1>
          <p className="mt-4 text-gray-600">Upload your model, choose materials and get a quote instantly. Only sign up at checkout.</p>

          <ul className="mt-6 space-y-3">
            <li className="flex items-start gap-3"><span className="inline-block w-2 h-2 bg-indigo-600 rounded-full mt-2"/> <span className="text-gray-700">Instant price estimates</span></li>
            <li className="flex items-start gap-3"><span className="inline-block w-2 h-2 bg-indigo-600 rounded-full mt-2"/> <span className="text-gray-700">Secure payments with Stripe</span></li>
            <li className="flex items-start gap-3"><span className="inline-block w-2 h-2 bg-indigo-600 rounded-full mt-2"/> <span className="text-gray-700">Fast turnaround options</span></li>
          </ul>

          <GetStartedCTA />
        </section>

        <aside className="flex justify-center md:justify-end">
          <AuthCard />
        </aside>
      </div>
    </main>
  )
}
