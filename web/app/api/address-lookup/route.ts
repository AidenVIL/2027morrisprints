import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const postcode = (url.searchParams.get('postcode') || '').trim();
    if (!postcode) return NextResponse.json([], { status: 200 });

    // Provider-agnostic placeholder implementation.
    // If ADDRESS_LOOKUP_API_KEY is provided we could call a real provider here.
    const apiKey = process.env.ADDRESS_LOOKUP_API_KEY || '';
    if (!apiKey) {
      // No key configured — return empty list so client falls back to manual entry.
      return NextResponse.json([], { status: 200 });
    }

    // TODO: implement real provider call (e.g., Ideal-Postcodes, Postcodes.io, or getaddress.io)
    // For now, return an empty array to force manual entry.
    return NextResponse.json([], { status: 200 });
  } catch (e) {
    console.error('address-lookup error', e);
    return NextResponse.json([], { status: 200 });
  }
}
