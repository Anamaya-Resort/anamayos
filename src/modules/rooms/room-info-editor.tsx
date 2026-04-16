'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Plus, X, ChevronUp, ChevronDown, Trash2, Upload, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { TranslationKeys } from '@/i18n/en';

interface ImageItem {
  url: string;
  alt: string;
  fileName: string;
}

// All known feature tags across the resort
const ALL_FEATURE_TAGS = [
  'Ocean View', 'Ocean Views', 'Tree House Views', '360° Views', 'Sunrise & Sunset Views',
  'AC', 'Ceiling Fan', 'Ceiling Fans',
  'Deck', 'Private Deck', 'Balcony', 'Balconies', 'Hammock', 'Hammocks', 'Deck with Hammock',
  'Desk', 'Loft', '2 Lofts', 'Sliding Glass Doors', 'Private Tower',
  'Garden Bathroom', 'Open-Air Bathroom', 'Outdoor Shower', 'Bathtub', '2 Bathrooms',
  'Niche Bed Design', 'Zen Garden', 'Exceptional Privacy', 'Eco-Friendly',
];

interface RoomInfoEditorProps {
  room: Record<string, unknown>;
  categories: Array<{ id: string; name: string }>;
  beds: Array<{ id: string; label: string; bed_type: string; capacity: number }>;
  resolvedData: { images: string[]; features: string[]; shortDescription: string; longDescription: string };
  dict: TranslationKeys;
}

export function RoomInfoEditor({ room, categories, beds, resolvedData }: RoomInfoEditorProps) {
  const roomId = room.id as string;
  const amenities = (room.amenities as Record<string, unknown>) ?? {};

  // Images: merge resolved URLs with any alt/fileName data already in amenities
  const existingImgObjs = (amenities.gallery_images as unknown[]) ?? [];
  const initImages: ImageItem[] = resolvedData.images.map((url, i) => {
    const existing = existingImgObjs[i];
    if (existing && typeof existing === 'object') {
      const obj = existing as Record<string, unknown>;
      return { url, alt: (obj.alt as string) ?? '', fileName: (obj.fileName as string) ?? url.split('/').pop() ?? '' };
    }
    return { url, alt: '', fileName: url.split('/').pop() ?? '' };
  });

  const [name, setName] = useState((room.name as string) ?? '');
  const [categoryId, setCategoryId] = useState((room.category_id as string) ?? '');
  const [maxOccupancy, setMaxOccupancy] = useState((room.max_occupancy as number) ?? 2);
  const [isShared, setIsShared] = useState((room.is_shared as boolean) ?? false);
  const [ratePerNight, setRatePerNight] = useState((room.base_rate_per_night as number) ?? 0);
  const [currency, setCurrency] = useState((room.currency as string) ?? 'USD');
  const [roomGroup, setRoomGroup] = useState((room.room_group as string) ?? 'upper');
  const [features, setFeatures] = useState<string[]>(resolvedData.features);
  const [newFeature, setNewFeature] = useState('');
  const [showFeaturePicker, setShowFeaturePicker] = useState(false);
  const [description, setDescription] = useState(resolvedData.shortDescription);
  const [longDescription, setLongDescription] = useState(resolvedData.longDescription);
  const [images, setImages] = useState<ImageItem[]>(initImages);
  const [selectedImgIdx, setSelectedImgIdx] = useState<number | null>(images.length > 0 ? 0 : null);
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description, max_occupancy: maxOccupancy, is_shared: isShared,
          base_rate_per_night: ratePerNight || null, currency, room_group: roomGroup,
          category_id: categoryId || null,
          amenities: {
            ...amenities, gallery_images: images, features,
            long_description: longDescription, hero_image: images[0]?.url ?? null,
          },
        }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch { setSaveStatus('idle'); }
  };

  // Multi-file upload
  const handleFileUpload = async (files: FileList) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('roomId', roomId);
    for (const file of Array.from(files)) formData.append('files', file);
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        const newImages: ImageItem[] = (data.uploaded ?? []).map((u: { url: string; fileName: string }) => ({
          url: u.url, alt: '', fileName: u.fileName,
        }));
        setImages((prev) => [...prev, ...newImages]);
        if (selectedImgIdx === null && newImages.length > 0) setSelectedImgIdx(images.length);
      }
    } catch { /* upload failed */ }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addFeature = () => { if (newFeature.trim() && !features.includes(newFeature.trim())) { setFeatures([...features, newFeature.trim()]); setNewFeature(''); } };
  const toggleFeatureFromPicker = (tag: string) => {
    if (features.includes(tag)) setFeatures(features.filter((f) => f !== tag));
    else setFeatures([...features, tag]);
  };
  const moveImage = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= images.length) return;
    const arr = [...images]; [arr[i], arr[j]] = [arr[j], arr[i]]; setImages(arr);
    if (selectedImgIdx === i) setSelectedImgIdx(j);
    else if (selectedImgIdx === j) setSelectedImgIdx(i);
  };
  const removeImage = (i: number) => {
    const newImgs = images.filter((_, j) => j !== i); setImages(newImgs);
    if (selectedImgIdx !== null && selectedImgIdx >= newImgs.length) setSelectedImgIdx(newImgs.length > 0 ? newImgs.length - 1 : null);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/rooms"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Rooms</Button></Link>
          <h1 className="text-lg font-semibold">Edit: {name || 'Untitled Room'}</h1>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saveStatus === 'saving'} className="min-w-[80px]">
          <Save className="mr-1 h-4 w-4" />
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">

          {/* 1. HERO IMAGE PREVIEW */}
          <div style={{ position: 'relative', aspectRatio: '16/10', background: '#f5f5f4' }}>
            {images.length > 0 && selectedImgIdx !== null ? (
              <div style={{ width: '100%', height: '100%', backgroundImage: `url(${images[selectedImgIdx]?.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a1a1aa', fontSize: 14 }}>No images — upload below</div>
            )}
            {images.length > 0 && selectedImgIdx !== null && (
              <span style={{ position: 'absolute', top: 8, left: 8, background: '#A35B4E', color: 'white', fontSize: 9, padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>
                {selectedImgIdx === 0 ? 'HERO' : `#${selectedImgIdx + 1}`}
              </span>
            )}
          </div>

          {/* 2. IMAGE MANAGER — upload + individual image sub-panels */}
          <div className="border-b p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Images ({images.length})</h3>
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)} />
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="h-3.5 w-3.5 mr-1" />{uploading ? 'Uploading...' : 'Upload Images'}
                </Button>
              </div>
            </div>

            {/* Individual image sub-panels */}
            <div className="space-y-2">
              {images.map((img, i) => (
                <div key={i} onClick={() => setSelectedImgIdx(i)}
                  className={`flex gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors ${selectedImgIdx === i ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'}`}>
                  {/* Thumbnail */}
                  <div style={{ width: 80, height: 56, flexShrink: 0, borderRadius: 4, backgroundImage: `url(${img.url})`, backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid #e5e5e5' }} />
                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1">
                      {i === 0 && <span className="text-[8px] font-bold text-white bg-primary px-1.5 py-0.5 rounded">HERO</span>}
                      <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
                    </div>
                    <input type="text" value={img.fileName} placeholder="File name (SEO)..."
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { const arr = [...images]; arr[i] = { ...arr[i], fileName: e.target.value }; setImages(arr); }}
                      className="w-full rounded border px-2 py-0.5 text-[11px] font-mono outline-none focus:ring-1 focus:ring-primary/50" />
                    <input type="text" value={img.alt} placeholder="Alt text (SEO)..."
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { const arr = [...images]; arr[i] = { ...arr[i], alt: e.target.value }; setImages(arr); }}
                      className="w-full rounded border px-2 py-0.5 text-[11px] outline-none focus:ring-1 focus:ring-primary/50" />
                  </div>
                  {/* Controls */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); moveImage(i, -1); }} disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); moveImage(i, 1); }} disabled={i === images.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"><ChevronDown className="h-3.5 w-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                      className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. ROOM NAME */}
          <div className="p-4 pb-0">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e7e5e4' }}>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Room Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="flex-1 text-sm font-semibold border rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary/50" style={{ color: '#44403c' }} />
            </div>
          </div>

          {/* 4. FEATURE TAGS — add new + pick from list */}
          <div className="px-4 pb-3">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Feature Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {features.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px]">
                  {f}<button onClick={() => setFeatures(features.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input type="text" value={newFeature} onChange={(e) => setNewFeature(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFeature()} placeholder="Add feature tag..."
                className="flex-1 rounded border px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-primary/50" />
              <Button size="sm" variant="outline" onClick={addFeature} className="h-6 px-2"><Plus className="h-3 w-3" /></Button>
              <Button size="sm" variant="outline" onClick={() => setShowFeaturePicker(true)} className="h-6 px-2 text-[10px]">Browse All</Button>
            </div>
          </div>

          {/* 5. STATS GRID */}
          <div className="px-4 pb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Category</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded border px-2 py-1 text-xs mt-0.5 outline-none focus:ring-1 focus:ring-primary/50">
                  <option value="">—</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Occupancy</label>
                <div className="flex items-center gap-2 mt-0.5">
                  <input type="number" value={maxOccupancy} onChange={(e) => setMaxOccupancy(parseInt(e.target.value) || 1)}
                    className="w-16 rounded border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50" />
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} className="rounded accent-primary" />Shared</label>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Rate / Night</label>
                <div className="flex gap-1 mt-0.5">
                  <input type="number" value={ratePerNight} onChange={(e) => setRatePerNight(parseFloat(e.target.value) || 0)}
                    className="flex-1 rounded border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50" />
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded border px-1 py-1 text-xs outline-none">
                    <option value="USD">USD</option><option value="CRC">CRC</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Room Group</label>
                <select value={roomGroup} onChange={(e) => setRoomGroup(e.target.value)}
                  className="w-full rounded border px-2 py-1 text-xs mt-0.5 outline-none focus:ring-1 focus:ring-primary/50">
                  <option value="upper">Upper</option><option value="lower">Lower</option><option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* 6. BEDS — from database, managed in Room Builder */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Beds</label>
              <button onClick={() => window.open(`/dashboard/rooms/${roomId}/layout`, '_blank')}
                className="text-[9px] text-primary hover:underline cursor-pointer">Edit in Room Builder →</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {beds.length > 0 ? beds.map((b) => (
                <span key={b.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[10px]">
                  {b.label} ({b.bed_type.replace('_', ' ')})
                </span>
              )) : (
                <span className="text-[10px] text-muted-foreground italic">No beds configured — add them in the Room Builder</span>
              )}
            </div>
          </div>

          {/* 7. SHORT DESCRIPTION */}
          <div className="px-4 pb-3">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Short Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/50 resize-y" style={{ color: '#444' }} />
          </div>

          {/* 8. LONG DESCRIPTION */}
          <div className="px-4 pb-6">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Long Description</label>
            <textarea value={longDescription} onChange={(e) => setLongDescription(e.target.value)} rows={8}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-y" style={{ color: '#555', lineHeight: 1.6 }} />
          </div>

        </div>
      </div>

      {/* Feature tag picker modal */}
      <Dialog open={showFeaturePicker} onOpenChange={(open) => { if (!open) setShowFeaturePicker(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Select Feature Tags</DialogTitle></DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {ALL_FEATURE_TAGS.map((tag) => {
              const checked = features.includes(tag);
              return (
                <label key={tag} className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs cursor-pointer transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-muted/50'}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleFeatureFromPicker(tag)} className="rounded accent-primary" />
                  <span>{tag}</span>
                  {checked && <Check className="h-3 w-3 text-primary ml-auto" />}
                </label>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
