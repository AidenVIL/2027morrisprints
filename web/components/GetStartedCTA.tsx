"use client"
import React from 'react'
import Link from 'next/link'

export default function GetStartedCTA() {
  return (
    <Link href="/quotes/new" className="inline-block mt-4 px-6 py-3 bg-green-600 text-white rounded-lg font-medium">Get started</Link>
  )
}
