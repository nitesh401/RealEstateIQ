import { FileText, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { AttachmentMeta } from '../lib/types';

const CATS: { v: AttachmentMeta['category']; l: string }[] = [
  { v: 'photo', l: 'Photograph' }, { v: 'floor_plan', l: 'Floor plan' }, { v: 'site_plan', l: 'Site plan' }, { v: 'title_deed', l: 'Title deed' },
  { v: 'encumbrance', l: 'Encumbrance certificate' }, { v: 'layout_approval', l: 'Layout approval' }, { v: 'diversion', l: 'Diversion order' },
  { v: 'tax_receipt', l: 'Property tax receipt' }, { v: 'rera', l: 'RERA registration' }, { v: 'other', l: 'Other' },
];

export default function Attachments({ items, onChange, only }: { items: AttachmentMeta[]; onChange: (a: AttachmentMeta[]) => void; only?: AttachmentMeta['category'][] }) {
  const ref = useRef<HTMLInputElement>(null);
  const cats = only ? CATS.filter((c) => only.includes(c.v)) : CATS;
  const [cat, setCat] = useState<AttachmentMeta['category']>(cats[0].v);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...items];
    const pv = { ...previews };
    for (const f of Array.from(files)) {
      if (f.size > 15 * 1024 * 1024) { setMsg(`${f.name} is larger than 15 MB and was skipped.`); continue; }
      const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      next.push({ id, name: f.name, size: f.size, mime: f.type, category: cat });
      if (f.type.startsWith('image/')) pv[id] = URL.createObjectURL(f);
    }
    setPreviews(pv);
    onChange(next);
    if (ref.current) ref.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label className="label" htmlFor="att-cat">File type</label>
          <select id="att-cat" className="input" value={cat} onChange={(e) => setCat(e.target.value as AttachmentMeta['category'])}>
            {cats.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => ref.current?.click()}><Upload size={16} /> Add files</button>
        <input ref={ref} type="file" multiple accept="image/*,application/pdf" className="sr-only" aria-label="Upload files" onChange={(e) => onFiles(e.target.files)} />
      </div>
      <p className="text-[11.5px] text-slate-500">Files stay in your browser and only their names are saved. They are listed in the report but are <b>not machine-analysed and not legally verified</b> – a document being present is not verification.</p>
      {msg && <p role="alert" className="text-[12px] text-coral-300">{msg}</p>}
      {items.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.filter((i) => !only || only.includes(i.category)).map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border border-ink-600 bg-white/[.03] p-2.5">
              {previews[a.id] ? <img src={previews[a.id]} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <FileText size={22} className="mx-2 text-slate-400" />}
              <div className="min-w-0 flex-1"><div className="truncate text-[13px] text-slate-100">{a.name}</div><div className="text-[11px] text-slate-500">{CATS.find((c) => c.v === a.category)?.l} · {(a.size / 1024).toFixed(0)} KB</div></div>
              <button type="button" aria-label={`Remove ${a.name}`} className="p-2 text-slate-400 hover:text-coral-300" onClick={() => onChange(items.filter((x) => x.id !== a.id))}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
