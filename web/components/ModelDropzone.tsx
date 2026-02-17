"use client";
import { useState, useRef } from 'react';

type Props = {
  onUpload: (file: File, setProgress: (n:number)=>void) => Promise<void>;
  onFileChange?: (file: File | null) => void;
  maxSizeMB?: number;
};

export default function ModelDropzone({ onUpload, onFileChange, maxSizeMB = 25 }: Props) {
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(f: File) {
    const allowed = ['stl','3mf','obj'];
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!allowed.includes(ext)) return alert('Unsupported file type. Use STL/3MF/OBJ');
    if (f.size > maxSizeMB * 1024 * 1024) return alert(`File too large (max ${maxSizeMB} MB)`);
    setFile(f);
    onFileChange?.(f);
    setProgress(0);
    setUploading(true);
    try {
      await onUpload(f, (n)=>setProgress(n));
    } catch (e:any) {
      console.error('upload failed', e);
      alert('Upload failed: ' + (e?.message || String(e)));
      setFile(null);
      onFileChange?.(null);
    } finally {
      setUploading(false);
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  return (
    <div>
      <div
        onDragOver={(e)=>{ e.preventDefault(); setDrag(true); }}
        onDragLeave={()=>setDrag(false)}
        onDrop={onDrop}
        className={`border-2 ${drag ? 'border-indigo-500 bg-indigo-50' : 'border-dashed border-gray-300'} rounded-md p-6 text-center transition-colors`}
      >
        {!file ? (
          <div>
            <p className="text-lg font-semibold text-gray-800">Drop STL/3MF/OBJ here</p>
            <p className="text-sm text-gray-500 mt-2">or</p>
            <div className="mt-3">
              <button type="button" onClick={()=>inputRef.current?.click()} className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Browse files</button>
            </div>
            <input ref={inputRef} type="file" accept=".stl,.3mf,.obj" onChange={(e)=>{ const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />
            <p className="text-xs text-gray-400 mt-2">Max size {maxSizeMB} MB</p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{file.name}</div>
              <div className="text-xs text-gray-500">{(file.size/1024/1024).toFixed(2)} MB</div>
            </div>
            <div className="flex items-center gap-2">
              {uploading && (
                <div className="w-40">
                  <div className="h-2 bg-gray-200 rounded overflow-hidden">
                    <div style={{ width: `${progress}%` }} className="h-2 bg-indigo-600" />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Uploading {progress}%</div>
                </div>
              )}
              <button type="button" onClick={()=>{ setFile(null); setProgress(0); }} className="px-3 py-1 text-sm border rounded-md">Remove</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
