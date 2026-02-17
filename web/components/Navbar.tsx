"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: '/', label: 'Home' },
    { href: '/quotes', label: 'Quotes' },
    { href: '/quotes/new', label: 'Get a quote' }
  ];

  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold">3D</div>
              <span className="font-semibold text-gray-800">MorrisPrints</span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-4">
            {links.map(l => (
              <Link key={l.href} href={l.href} className={"px-3 py-2 rounded-md text-sm font-medium " + (pathname === l.href ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50') }>
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="md:hidden">
            <button aria-label="Open menu" onClick={()=>setOpen(true)} className="p-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div className="fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black/40" onClick={()=>setOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-72 bg-white shadow-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold">3D</div>
                <span className="font-semibold text-gray-800">MorrisPrints</span>
              </div>
              <button onClick={()=>setOpen(false)} className="p-1 rounded-md text-gray-600 hover:bg-gray-100">
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-2">
              {links.map(l => (
                <Link key={l.href} href={l.href} onClick={()=>setOpen(false)} className={"px-3 py-2 rounded-md text-sm font-medium " + (pathname === l.href ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50') }>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
