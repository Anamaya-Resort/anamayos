'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Plus, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TranslationKeys } from '@/i18n/en';

interface RoomInfoEditorProps {
  room: Record<string, unknown>;
  categories: Array<{ id: string; name: string }>;
  dict: TranslationKeys;
}

export function RoomInfoEditor({ room, categories }: RoomInfoEditorProps) {
  const roomId = room.id as string;
  const cat = room.room_categories as { name: string } | null;
  const amenities = (room.amenities as Record<string, unknown>) ?? {};
  const existingImages = (amenities.gallery_images as string[]) ?? (amenities.images as string[]) ?? [];

  const [name, setName] = useState((room.name as string) ?? '');
  const [description, setDescription] = useState((room.description as string) ?? '');
  const [longDescription, setLongDescription] = useState(
    (amenities.long_description as string) ?? '',
  );
  const [maxOccupancy, setMaxOccupancy] = useState((room.max_occupancy as number) ?? 2);
  const [isShared, setIsShared] = useState((room.is_shared as boolean) ?? false);
  const [ratePerNight, setRatePerNight] = useState((room.base_rate_per_night as number) ?? 0);
  const [currency, setCurrency] = useState((room.currency as string) ?? 'USD');
  const [roomGroup, setRoomGroup] = useState((room.room_group as string) ?? 'upper');
  const [categoryId, setCategoryId] = useState((room.category_id as string) ?? '');

  // Feature tags
  const existingFeatures = (amenities.features as string[])
    ?? ((amenities.feature_tags as string) ?? '').split(' -- ').filter(Boolean);
  const [features, setFeatures] = useState<string[]>(existingFeatures);
  const [newFeature, setNewFeature] = useState('');

  // Bed tags (display only — managed in layout editor)
  const bedTags = (amenities.bed_tags as string[]) ?? [];
  const [bedTagList, setBedTagList] = useState<string[]>(bedTags);
  const [newBedTag, setNewBedTag] = useState('');

  // Images
  const [images, setImages] = useState<string[]>(existingImages);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const updatedAmenities = {
        ...amenities,
        gallery_images: images,
        features,
        bed_tags: bedTagList,
        long_description: longDescription,
      };

      await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          max_occupancy: maxOccupancy,
          is_shared: isShared,
          base_rate_per_night: ratePerNight || null,
          currency,
          room_group: roomGroup,
          category_id: categoryId || null,
          amenities: updatedAmenities,
        }),
      });

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  const addFeature = () => {
    if (newFeature.trim() && !features.includes(newFeature.trim())) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const addBedTag = () => {
    if (newBedTag.trim() && !bedTagList.includes(newBedTag.trim())) {
      setBedTagList([...bedTagList, newBedTag.trim()]);
      setNewBedTag('');
    }
  };

  const addImage = () => {
    if (newImageUrl.trim() && !images.includes(newImageUrl.trim())) {
      setImages([...images, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const moveImage = (from: number, to: number) => {
    const updated = [...images];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    setImages(updated);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/rooms">
            <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Back to Rooms</Button>
          </Link>
          <h1 className="text-lg font-semibold">Edit: {name}</h1>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saveStatus === 'saving'} className="min-w-[80px]">
          <Save className="mr-1 h-4 w-4" />
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
        </Button>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        <div className="space-y-6">

          {/* Basic Info */}
          <section className="rounded-lg border p-4 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Info</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Room Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">— None —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Occupancy</label>
                <input type="number" value={maxOccupancy} onChange={(e) => setMaxOccupancy(parseInt(e.target.value) || 1)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Room Group</label>
                <select value={roomGroup} onChange={(e) => setRoomGroup(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="upper">Upper</option>
                  <option value="lower">Lower</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Rate per Night</label>
                <input type="number" value={ratePerNight} onChange={(e) => setRatePerNight(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="USD">USD</option>
                  <option value="CRC">CRC</option>
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)}
                  className="rounded border accent-primary" />
                <label className="text-sm">Shared room (dorm-style)</label>
              </div>
            </div>
          </section>

          {/* Descriptions */}
          <section className="rounded-lg border p-4 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Descriptions</h2>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Short Description (1-2 sentences)</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-y" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Long Description (full details)</label>
              <textarea value={longDescription} onChange={(e) => setLongDescription(e.target.value)} rows={6}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-y" />
            </div>
          </section>

          {/* Feature Tags */}
          <section className="rounded-lg border p-4 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Feature Tags</h2>
            <div className="flex flex-wrap gap-2">
              {features.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                  {f}
                  <button onClick={() => setFeatures(features.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newFeature} onChange={(e) => setNewFeature(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFeature()}
                placeholder="Add feature (e.g., Ocean View)"
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
              <Button size="sm" variant="outline" onClick={addFeature}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
          </section>

          {/* Bed Tags */}
          <section className="rounded-lg border p-4 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bed Tags</h2>
            <div className="flex flex-wrap gap-2">
              {bedTagList.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                  {t}
                  <button onClick={() => setBedTagList(bedTagList.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newBedTag} onChange={(e) => setNewBedTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBedTag()}
                placeholder="Add bed tag (e.g., King Bed)"
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
              <Button size="sm" variant="outline" onClick={addBedTag}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
          </section>

          {/* Images */}
          <section className="rounded-lg border p-4 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Images</h2>
            <p className="text-xs text-muted-foreground">Drag to reorder. First image is the hero image.</p>
            <div className="grid grid-cols-3 gap-3">
              {images.map((url, i) => (
                <div key={i} className="relative group rounded-lg border overflow-hidden aspect-video"
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragIdx !== null && dragIdx !== i) moveImage(dragIdx, i); setDragIdx(null); }}
                  style={{ cursor: 'grab' }}
                >
                  <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${url})` }} />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <button onClick={() => setImages(images.filter((_, j) => j !== i))}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-1">
                      <X className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                  {i === 0 && (
                    <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded font-semibold">HERO</span>
                  )}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-70 transition-opacity">
                    <GripVertical className="h-4 w-4 text-white" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addImage()}
                placeholder="Paste image URL"
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
              <Button size="sm" variant="outline" onClick={addImage}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
