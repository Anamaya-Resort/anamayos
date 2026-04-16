'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Plus, X, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TranslationKeys } from '@/i18n/en';

interface ImageItem {
  url: string;
  alt: string;
}

interface RoomInfoEditorProps {
  room: Record<string, unknown>;
  categories: Array<{ id: string; name: string }>;
  resolvedData: {
    images: string[];
    features: string[];
    shortDescription: string;
    longDescription: string;
  };
  dict: TranslationKeys;
}

export function RoomInfoEditor({ room, categories, resolvedData }: RoomInfoEditorProps) {
  const roomId = room.id as string;
  const amenities = (room.amenities as Record<string, unknown>) ?? {};

  // Images: convert string[] to {url,alt}[], preserve alt if already stored as objects
  const existingImgObjs = (amenities.gallery_images as unknown[]) ?? [];
  const initImages = resolvedData.images.map((url, i) => {
    const existing = existingImgObjs[i];
    if (existing && typeof existing === 'object' && (existing as Record<string, unknown>).alt) {
      return { url, alt: ((existing as Record<string, unknown>).alt as string) ?? '' };
    }
    return { url, alt: '' };
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
  const [bedTags, setBedTags] = useState<string[]>((amenities.bed_tags as string[]) ?? []);
  const [newBedTag, setNewBedTag] = useState('');
  const [description, setDescription] = useState(resolvedData.shortDescription);
  const [longDescription, setLongDescription] = useState(resolvedData.longDescription);
  const [images, setImages] = useState<ImageItem[]>(initImages);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [selectedImgIdx, setSelectedImgIdx] = useState<number | null>(images.length > 0 ? 0 : null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      // Save to rooms table + amenities JSONB
      await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description, // short description goes in rooms.description column
          max_occupancy: maxOccupancy,
          is_shared: isShared,
          base_rate_per_night: ratePerNight || null,
          currency,
          room_group: roomGroup,
          category_id: categoryId || null,
          amenities: {
            ...amenities,
            gallery_images: images, // stored as {url, alt}[]
            features,
            bed_tags: bedTags,
            long_description: longDescription,
            hero_image: images[0]?.url ?? null,
          },
        }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch { setSaveStatus('idle'); }
  };

  const addFeature = () => { if (newFeature.trim()) { setFeatures([...features, newFeature.trim()]); setNewFeature(''); } };
  const addBedTag = () => { if (newBedTag.trim()) { setBedTags([...bedTags, newBedTag.trim()]); setNewBedTag(''); } };
  const addImage = () => { if (newImageUrl.trim()) { setImages([...images, { url: newImageUrl.trim(), alt: '' }]); setNewImageUrl(''); } };
  const moveImage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const arr = [...images]; [arr[i], arr[j]] = [arr[j], arr[i]]; setImages(arr);
    if (selectedImgIdx === i) setSelectedImgIdx(j);
    else if (selectedImgIdx === j) setSelectedImgIdx(i);
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

      {/* Content — matches modal order */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">

          {/* 1. IMAGES — hero preview + manager */}
          <div style={{ position: 'relative', aspectRatio: '16/10', background: '#f5f5f4' }}>
            {images.length > 0 && selectedImgIdx !== null ? (
              <div style={{ width: '100%', height: '100%', backgroundImage: `url(${images[selectedImgIdx]?.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a1a1aa', fontSize: 14 }}>No images — add URLs below</div>
            )}
            {images.length > 0 && selectedImgIdx !== null && (
              <span style={{ position: 'absolute', top: 8, left: 8, background: '#A35B4E', color: 'white', fontSize: 9, padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>
                {selectedImgIdx === 0 ? 'HERO' : `#${selectedImgIdx + 1}`}
              </span>
            )}
          </div>

          {/* Image manager */}
          <div className="border-b p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Images ({images.length})</h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {images.map((img, i) => (
                <div key={i} onClick={() => setSelectedImgIdx(i)}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs cursor-pointer transition-colors ${selectedImgIdx === i ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50'}`}>
                  <div style={{ width: 40, height: 28, flexShrink: 0, borderRadius: 3, backgroundImage: `url(${img.url})`, backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid #e5e5e5' }} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-mono text-[10px] text-muted-foreground">{img.url.split('/').pop()}</div>
                    <input type="text" value={img.alt} placeholder="Alt text for SEO..."
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { const arr = [...images]; arr[i] = { ...arr[i], alt: e.target.value }; setImages(arr); }}
                      className="w-full border-0 bg-transparent p-0 text-[10px] outline-none placeholder:text-muted-foreground/50" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); moveImage(i, -1); }} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronUp className="h-3 w-3" /></button>
                    <button onClick={(e) => { e.stopPropagation(); moveImage(i, 1); }} disabled={i === images.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronDown className="h-3 w-3" /></button>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); const newImgs = images.filter((_, j) => j !== i); setImages(newImgs); if (selectedImgIdx !== null && selectedImgIdx >= newImgs.length) setSelectedImgIdx(newImgs.length > 0 ? newImgs.length - 1 : null); }}
                    className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  {i === 0 && <span className="text-[8px] font-bold text-primary whitespace-nowrap">HERO</span>}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addImage()} placeholder="Paste image URL..."
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/50" />
              <Button size="sm" variant="outline" onClick={addImage}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          {/* 2. ROOM NAME — editable */}
          <div className="p-4 pb-0">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e7e5e4' }}>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Room Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="flex-1 text-sm font-semibold border rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary/50" style={{ color: '#44403c' }} />
            </div>
          </div>

          {/* 3. FEATURE TAGS */}
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
                onKeyDown={(e) => e.key === 'Enter' && addFeature()} placeholder="Add feature..."
                className="flex-1 rounded border px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-primary/50" />
              <Button size="sm" variant="outline" onClick={addFeature} className="h-6 px-2"><Plus className="h-3 w-3" /></Button>
            </div>
          </div>

          {/* 4. STATS GRID */}
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
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} className="rounded accent-primary" />
                    Shared
                  </label>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Rate / Night</label>
                <div className="flex gap-1 mt-0.5">
                  <input type="number" value={ratePerNight} onChange={(e) => setRatePerNight(parseFloat(e.target.value) || 0)}
                    className="flex-1 rounded border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50" />
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                    className="rounded border px-1 py-1 text-xs outline-none">
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

          {/* 5. BED TAGS */}
          <div className="px-4 pb-3">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Bed Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {bedTags.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[10px]">
                  {t}<button onClick={() => setBedTags(bedTags.filter((_, j) => j !== i))} className="hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input type="text" value={newBedTag} onChange={(e) => setNewBedTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBedTag()} placeholder="Add bed tag..."
                className="flex-1 rounded border px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-primary/50" />
              <Button size="sm" variant="outline" onClick={addBedTag} className="h-6 px-2"><Plus className="h-3 w-3" /></Button>
            </div>
          </div>

          {/* 6. SHORT DESCRIPTION */}
          <div className="px-4 pb-3">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Short Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/50 resize-y" style={{ color: '#444' }} />
          </div>

          {/* 7. LONG DESCRIPTION */}
          <div className="px-4 pb-6">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Long Description</label>
            <textarea value={longDescription} onChange={(e) => setLongDescription(e.target.value)} rows={8}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-y" style={{ color: '#555', lineHeight: 1.6 }} />
          </div>

        </div>
      </div>
    </div>
  );
}
