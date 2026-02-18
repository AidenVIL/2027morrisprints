"use client";
import { useState, useEffect } from 'react';
import { useCartStore } from '../../../lib/cart/store';
import { v4 as uuidv4 } from 'uuid';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../../lib/supabaseBrowser';
import AuthCard from '../../../components/AuthCard';
import ModelDropzone from '../../../components/ModelDropzone';
import { useRouter } from 'next/navigation';

const schema = z.object({
  // file is uploaded immediately; the form holds other settings
  inventory_item_id: z.string().optional(),
  layerPreset: z.enum(['draft','standard','fine','ultra']),
  infill: z.number().min(0).max(100),
  walls: z.number().min(0).optional(),
  supports: z.boolean(),
  scale: z.number().min(1).optional(),
  quantity: z.number().min(1),
  turnaround: z.enum(['standard', 'fast']),
  postcode: z.string().optional(),
  notes: z.string().optional()
});

// Keep form values untyped here to avoid type mismatches with installed libs
// (we use runtime Zod validation via the resolver)

export default function NewQuote() {
  const sb = supabase;
  const { register, handleSubmit, formState: { errors }, getValues } = useForm({ resolver: zodResolver(schema as any), defaultValues: { layerPreset: 'standard', infill: 20, quantity: 1, supports: false } });
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [materials, setMaterials] = useState<any[]>([])
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [quotePreview, setQuotePreview] = useState<null | {
    quoteDraftId?: string,
    grams: number,
    timeSeconds: number,
    breakdown: any,
    finalPrice: number,
    inventory_item_id: string,
    layerPreset: string,
    infillPercent: number,
    supports: boolean,
    quantity: number,
    storagePath: string,
    originalName: string,
  }>(null)
  const [uiStep, setUiStep] = useState<'form'|'preview'>('form')
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [originalName, setOriginalName] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<'idle'|'uploading'|'uploaded'|'error'>('idle')
  const [errorBanner, setErrorBanner] = useState<{title?:string,message:string,status?:number}|null>(null);
  const [lastRequest, setLastRequest] = useState<any>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // restore draft if present (optional for UX)
    const draft = localStorage.getItem('quote_draft')
    if (draft) {
      try{
        const d = JSON.parse(draft);
        if (d?.inventory_item_id) setSelectedItem(d.inventory_item_id)
      }catch(e){/* ignore */}
    }
    // load active inventory items
    ;(async function(){
      try{
        const { data } = await sb.from('inventory_items').select('*').eq('is_active', true)
        setMaterials(data || [])
      }catch(e){ console.error('load materials', e) }
    })()
  }, [])

  // New flow: create an UNCONFIRMED draft and add to cart after server estimate.
  async function getQuote(values: any) {
    setErrorBanner(null);
    setLastRequest(null);
    setLastResponse(null);
    setLoading(true);
    // check session
    const session = await sb?.auth.getSession();
    const user = session?.data?.session?.user || null;
    if (!user) {
      // Not logged in: save draft (including selected inventory item) and show auth panel
      try {
        const draft = { ...values, inventory_item_id: selectedItem };
        localStorage.setItem('quote_draft', JSON.stringify(draft));
      } catch (e) { console.error('draft save failed', e) }
      setLoading(false);
      setShowAuth(true);
      return;
    }

    const quoteId = crypto.randomUUID();
    const path = storagePath || null;
    // client-side validations
    if (!path || uploadState !== 'uploaded') {
      setErrorBanner({ message: 'Please upload a model file before requesting a quote' });
      setLoading(false);
      console.error('Get quote: missing storagePath or not uploaded', { values, storagePath, uploadState });
      return;
    }
    const inventory_item_id = selectedItem || values.inventory_item_id || null;
    if (!inventory_item_id) { setErrorBanner({ message: 'Please select a material' }); setLoading(false); console.error('Get quote: missing inventory item', { values, selectedItem }); return; }
    const infill = Number(values.infill);
    const qty = Number(values.quantity || 1);
    if (isNaN(infill) || infill < 0 || infill > 100) { setErrorBanner({ message: 'Infill must be 0–100' }); setLoading(false); console.error('Get quote: invalid infill', { values }); return; }
    if (isNaN(qty) || qty < 1) { setErrorBanner({ message: 'Quantity must be >= 1' }); setLoading(false); console.error('Get quote: invalid quantity', { values }); return; }

    // call consolidated get-quote endpoint which runs estimation and creates UNCONFIRMED draft
    const token = session?.data?.session?.access_token;
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    // derive material name from selected inventory item (no color)
    const inv = materials.find((m: any) => m.id === inventory_item_id) as any | undefined;
    const materialName = inv?.material || (values?.material || null);

    const payload = {
      inventory_item_id,
      material: materialName,
      layerPreset: values.layerPreset || 'standard',
      infillPercent: Number(values.infill ?? 0),
      supports: Boolean(values.supports),
      quantity: Number(values.quantity || 1),
      storagePath: path,
      originalName: originalName || path.split('/').slice(-1)[0]
    };
    setLastRequest(payload);
    let gqRes: Response | null = null;
    let gqJson: any = null;
    try {
      gqRes = await fetch('/api/quotes/get-quote', { method: 'POST', headers, body: JSON.stringify(payload) });
      gqJson = await gqRes.json().catch(()=>null);
      setLastResponse({ status: gqRes.status, body: gqJson });
    } catch (e) {
      console.error('get-quote network error', e);
      setErrorBanner({ message: 'Network error while requesting quote' });
      setLoading(false);
      setLastResponse({ error: String(e) });
      return;
    }
    if (!gqRes || !gqRes.ok) {
      console.error('get-quote failed', gqRes?.status, gqJson);
      setErrorBanner({ message: 'Get quote failed: ' + (gqJson?.error || gqJson?.details || 'unknown'), status: gqRes?.status });
      setLoading(false);
      return;
    }

    // set preview data and show preview UI (do not auto-navigate)
    setQuotePreview({
      quoteDraftId: gqJson.quoteDraftId,
      grams: Number(gqJson.estimated?.grams || 0),
      timeSeconds: Number(gqJson.estimated?.timeSeconds || 0),
      breakdown: gqJson.breakdown || {},
      finalPrice: Number(gqJson.estimated?.price_pence || gqJson.estimated?.price || 0),
      inventory_item_id: inventory_item_id,
      layerPreset: payload.layerPreset,
      infillPercent: Number(payload.infillPercent || 0),
      supports: Boolean(payload.supports),
      quantity: Number(payload.quantity || 1),
      storagePath: String(payload.storagePath || ''),
      originalName: String(payload.originalName || ''),
    });
    setUiStep('preview');
    setLoading(false);
  }

  // upload-only handler called by ModelDropzone. Uploads to server and stores returned path.
  async function handleFileUpload(f: File, setProgress: (n:number)=>void) {
    // manage upload state and only set storagePath after successful upload
    setErrorBanner(null);
    setLastRequest(null);
    setLastResponse(null);
    setUploadState('uploading')
    try {
      const tempId = crypto.randomUUID();
      const owner = (await sb?.auth.getSession())?.data?.session?.user?.id || 'guest';
      const path = `${owner}/uploads/${tempId}/${f.name}`;
      const form = new FormData();
      form.append('file', f as File);
      form.append('path', path);
      const upRes = await fetch('/api/uploads/temp', { method: 'POST', body: form });
      const upJson = await upRes.json().catch(()=>null);
      if (!upRes.ok || !upJson?.ok) {
        console.error('server upload failed', upRes.status, upJson);
        setErrorBanner({ message: 'Upload failed: ' + (upJson?.error || upJson?.message || 'unknown'), status: upRes.status });
        setUploadState('error')
        return;
      }
      setStoragePath(upJson.path || upJson.path);
      setOriginalName(f.name);
      setSelectedFile(f);
      setUploadState('uploaded')
    } catch (e) {
      console.error('upload exception', e);
      setErrorBanner({ message: 'Upload failed: ' + String(e) });
      setUploadState('error')
    }
  }

  // Called after successful auth to continue submission
  async function continueAfterAuth() {
    const draft = localStorage.getItem('quote_draft');
    if (!draft) {
      setShowAuth(false);
      return;
    }
    try {
      const values = JSON.parse(draft);
      if (values?.inventory_item_id) setSelectedItem(values.inventory_item_id)
      setShowAuth(false);
      // small delay to allow modal to close
      setTimeout(() => getQuote(values), 200);
    } catch (e) {
      console.error('failed restoring draft', e);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">New Quote</h2>
      {uiStep === 'form' && (
        <form onSubmit={handleSubmit(getQuote)} className="space-y-4">
        {/* Model uploader */}
        <ModelDropzone
          onFileChange={(f)=>setSelectedFile(f)}
          onUpload={async (f, setP) => { await handleFileUpload(f, setP); }}
        />

        {/* Upload status UI */}
        <div className="mt-2 text-sm">
          {uploadState === 'uploading' && (
            <div className="flex items-center gap-2 text-gray-600"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/></svg> Uploading...</div>
          )}
          {uploadState === 'uploaded' && (
            <div className="text-green-600">Uploaded ✓</div>
          )}
          {uploadState === 'error' && (
            <div className="text-red-600">Upload failed</div>
          )}
        </div>

        <select value={selectedItem || ''} onChange={(e)=>{ setSelectedItem(e.target.value); }} className="border p-2 rounded">
          <option value="">Select material</option>
          {materials.map((m: any) => (
            <option key={m.id} value={m.id}>{m.material} — {m.colour} (In stock: {m.grams_available - m.grams_reserved} g)</option>
          ))}
        </select>
        {/* colour removed — inventory items pair material+colour together */}
        {/* Layer height presets */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <label className="border p-3 rounded cursor-pointer">
            <input type="radio" value="draft" {...register('layerPreset' as any)} className="mr-2" />
            <div className="font-semibold">Draft (0.28 mm)</div>
            <div className="text-xs text-gray-500">Fast, lower detail — ~0.7x time</div>
          </label>
          <label className="border p-3 rounded cursor-pointer">
            <input type="radio" value="standard" {...register('layerPreset' as any)} className="mr-2" defaultChecked />
            <div className="font-semibold">Standard (0.20 mm)</div>
            <div className="text-xs text-gray-500">Balanced — 1.0x time</div>
          </label>
          <label className="border p-3 rounded cursor-pointer">
            <input type="radio" value="fine" {...register('layerPreset' as any)} className="mr-2" />
            <div className="font-semibold">Fine (0.16 mm)</div>
            <div className="text-xs text-gray-500">Higher detail — ~1.3x time</div>
          </label>
          <label className="border p-3 rounded cursor-pointer">
            <input type="radio" value="ultra" {...register('layerPreset' as any)} className="mr-2" />
            <div className="font-semibold">Ultra (0.12 mm)</div>
            <div className="text-xs text-gray-500">Best detail — ~1.7x time</div>
          </label>
        </div>
        <input type="number" placeholder="Infill %" {...register('infill' as any, { valueAsNumber: true })} className="border p-2 rounded w-full" />
        {errors.infill && <div className="text-sm text-red-600">Infill is required (0–100)</div>}
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('supports' as any)} />
          <span>Supports</span>
        </label>
        {/* nozzle and filament diameter removed from UI (hardcoded server-side) */}
        <input type="number" placeholder="Quantity" {...register('quantity' as any, { valueAsNumber: true })} className="border p-2 rounded w-full" defaultValue={1} />
        {errors.quantity && <div className="text-sm text-red-600">Quantity must be 1 or more</div>}
        <select {...register('turnaround' as any)} className="border p-2 rounded">
          <option value="standard">Standard</option>
          <option value="fast">Fast</option>
        </select>
        <textarea placeholder="Notes" {...register('notes' as any)} className="border p-2 rounded w-full" />
        {/** compute simple client-side readiness */}
        {/* Note: keep server-side validation as authoritative */}
        {
          (() => {
            const vals = getValues();
            const invId = selectedItem || vals.inventory_item_id || null;
            const infill = Number(vals.infill ?? 0);
            const qty = Number(vals.quantity || 1);
            const canSubmit = uploadState === 'uploaded' && storagePath && invId && !isNaN(infill) && infill >= 0 && infill <= 100 && !isNaN(qty) && qty >= 1;
            return (
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50" disabled={!canSubmit || loading}>
                {loading ? 'Working...' : 'Get Quote'}
              </button>
            )
          })()
        }
        {errorBanner && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 text-red-800 rounded">
            <div className="font-semibold">Error{errorBanner.status ? ` (status ${errorBanner.status})` : ''}</div>
            <div>{errorBanner.message}</div>
          </div>
        )}
        {/* Debug panel */}
        <details className="mt-2 text-sm text-gray-600">
          <summary className="cursor-pointer">Debug: last request/response</summary>
          <div className="mt-2">
            <div className="font-semibold">Last Request</div>
            <pre className="text-xs bg-gray-100 p-2 rounded max-h-40 overflow-auto">{JSON.stringify(lastRequest, null, 2)}</pre>
            <div className="font-semibold mt-2">Last Response</div>
            <pre className="text-xs bg-gray-100 p-2 rounded max-h-40 overflow-auto">{JSON.stringify(lastResponse, null, 2)}</pre>
          </div>
        </details>
        </form>
      )}

      {uiStep === 'preview' && quotePreview && (
        <div className="mt-3 p-4 border rounded bg-white">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm text-gray-600">Preview</div>
              <div className="text-lg font-semibold">Estimated cost: £{(quotePreview.finalPrice/100).toFixed(2)}</div>
              <div className="text-sm text-gray-500">{materials.find((m:any)=>m.id===quotePreview.inventory_item_id)?.material || 'Material'}</div>
            </div>
            <div>
              <div className="text-sm">{quotePreview.grams} g</div>
              <div className="text-sm">{(Math.floor(quotePreview.timeSeconds/3600)).toString().padStart(2,'0')}:{(Math.floor((quotePreview.timeSeconds%3600)/60)).toString().padStart(2,'0')}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {(() => {
              const n = (x:any, fallback=0) => Number.isFinite(Number(x)) ? Number(x) : fallback;
              const b = quotePreview.breakdown || {};
              const materialCost = n(b.materialCost ?? b.material_cost ?? 0);
              const machineCharge = n(b.machineCharge ?? b.machine_charge ?? 0);
              const electricityCharge = n(b.electricityCharge ?? b.electricity_cost ?? b.electricityCost ?? 0);
              const labourCharge = n(b.labourCharge ?? b.labour ?? b.labour_fee ?? 0);
              const extrasObj = b.extras || {};
              const extrasTotal = n(extrasObj.minOrderFee ?? extrasObj.min_order_fee ?? extrasObj.minOrderFee ?? 0) + n(extrasObj.supportsFee ?? extrasObj.supports_fee ?? extrasObj.supportsFee ?? 0) + n(extrasObj.smallPartFee ?? extrasObj.small_part_fee ?? extrasObj.smallPartFee ?? 0);
              return (
                <>
                  <div>Material cost</div><div className="text-right">£{materialCost.toFixed(2)}</div>
                  <div>Machine time</div><div className="text-right">£{machineCharge.toFixed(2)}</div>
                  <div>Electricity</div><div className="text-right">£{electricityCharge.toFixed(2)}</div>
                  <div>Labour</div><div className="text-right">£{labourCharge.toFixed(2)}</div>
                  <div>Extras</div><div className="text-right">£{extrasTotal.toFixed(2)}</div>
                  <div className="font-semibold">Total</div><div className="text-right font-semibold">£{(quotePreview.finalPrice/100).toFixed(2)}</div>
                </>
              )
            })()}
          </div>

          <div className="mt-4 flex gap-2">
            <button className="px-3 py-2 border rounded" onClick={()=>{
              if (!quotePreview) return;
              const existing = useCartStore.getState().items.find((it:any) => {
                return it.quoteSnapshot?.quoteDraftId && quotePreview.quoteDraftId && it.quoteSnapshot.quoteDraftId === quotePreview.quoteDraftId;
              });
              if (existing) {
                // simple toast replacement
                try { window.alert('Already in cart'); } catch(e){}
                return;
              }
              const id = uuidv4();
              useCartStore.getState().addItem({ id, createdAt: new Date().toISOString(), quoteSnapshot: quotePreview });
              try { window.alert('Added to cart'); } catch(e){}
              // stay on preview
            }}>Add to cart</button>
            <button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={()=>{
              if (!quotePreview) return;
              const existing = useCartStore.getState().items.find((it:any) => {
                return it.quoteSnapshot?.quoteDraftId && quotePreview.quoteDraftId && it.quoteSnapshot.quoteDraftId === quotePreview.quoteDraftId;
              });
              if (!existing) {
                const id = uuidv4();
                useCartStore.getState().addItem({ id, createdAt: new Date().toISOString(), quoteSnapshot: quotePreview });
              }
              // ensure cart not empty and navigate to checkout
              router.push('/checkout');
            }}>Proceed to checkout</button>
            <button className="ml-auto px-3 py-2 text-sm text-gray-600" onClick={()=>{ setUiStep('form'); setQuotePreview(null); }}>Back to edit</button>
          </div>
        </div>
      )}
      {showAuth && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-white rounded p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3">Please sign in to continue</h3>
            <AuthCard onSuccess={continueAfterAuth} />
            <div className="mt-3 text-sm text-gray-500">Or continue as guest by logging in later.</div>
            <button type="button" className="mt-4 text-sm text-gray-600" onClick={() => setShowAuth(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
