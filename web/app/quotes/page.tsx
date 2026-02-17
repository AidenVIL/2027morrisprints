import Link from 'next/link'

export default function QuotesIndex() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Quotes</h1>
      <p className="mb-4">This page lists your quotes. For now you can create a new quote or open an existing one.</p>
      <div className="flex gap-3">
        <Link href="/quotes/new" className="px-4 py-2 bg-indigo-600 text-white rounded">Get a quote</Link>
        <Link href="/cart" className="px-4 py-2 border rounded">View cart / drafts</Link>
      </div>
    </div>
  )
}
