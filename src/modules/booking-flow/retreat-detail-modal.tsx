'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RetreatOption } from './booking-wizard';

interface RetreatDetailModalProps {
  retreat: RetreatOption;
  onClose: () => void;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&hellip;/g, '…').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Extract all unique image URLs from the RG images object */
function getImageUrls(images: unknown): string[] {
  if (!images || typeof images !== 'object') return [];
  const obj = images as Record<string, { url?: string }>;
  const urls = new Set<string>();
  // Prefer full > large > medium > thumbnail
  for (const key of ['full', 'large', 'medium', 'thumbnail']) {
    const url = obj[key]?.url;
    if (url) urls.add(url);
  }
  return Array.from(urls);
}

export function RetreatDetailModal({ retreat, onClose }: RetreatDetailModalProps) {
  const allImages = getImageUrls(retreat.images);
  const [imgIdx, setImgIdx] = useState(0);
  const [nextIdx, setNextIdx] = useState<number | null>(null);
  const [nextOpacity, setNextOpacity] = useState(0);

  const startCrossfade = useCallback((next: number) => {
    if (next === imgIdx || allImages.length <= 1) return;
    setNextIdx(next);
    setNextOpacity(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { setNextOpacity(1); });
    });
    setTimeout(() => {
      setImgIdx(next);
      setNextIdx(null);
      setNextOpacity(0);
    }, 2000);
  }, [imgIdx, allImages.length]);

  // Auto-advance every 5s
  useEffect(() => {
    if (allImages.length <= 1) return;
    const timer = setInterval(() => {
      startCrossfade((imgIdx + 1) % allImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [allImages.length, imgIdx, startCrossfade]);

  return (
    <div className="bf-modal-overlay" onClick={onClose} style={{ zIndex: 9500 }}>
      <div className="bf-modal bf-room-detail-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="bf-modal-header">
          <h2 style={{ fontSize: 21 }}>{retreat.name}</h2>
          <button onClick={onClose} className="bf-modal-close">&times;</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {/* Image with crossfade */}
          {allImages.length > 0 && (
            <div style={{ position: 'relative', aspectRatio: '16/9' }}>
              <div className="bf-room-detail-img-full" style={{
                backgroundImage: `url(${allImages[imgIdx]})`,
                position: 'absolute', inset: 0,
              }} />
              {nextIdx !== null && (
                <div className="bf-room-detail-img-full" style={{
                  backgroundImage: `url(${allImages[nextIdx]})`,
                  position: 'absolute', inset: 0,
                  opacity: nextOpacity,
                  transition: 'opacity 2s ease',
                }} />
              )}
              {/* Dot navigation */}
              {allImages.length > 1 && (
                <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, zIndex: 2 }}>
                  {allImages.map((_, i) => (
                    <button key={i} onClick={() => startCrossfade(i)}
                      style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: i === imgIdx || i === nextIdx ? 'var(--brand-btn)' : 'rgba(255,255,255,0.7)',
                        transition: 'background 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Info section — below image, never overlapping */}
          <div style={{ padding: '20px 24px' }}>
            {/* Teacher */}
            {retreat.teacher && (
              <p style={{ fontSize: 17, color: 'var(--brand-btn)', fontWeight: 600, marginBottom: 8 }}>
                with {retreat.teacher}
              </p>
            )}

            {/* Dates */}
            {retreat.startDate && retreat.endDate && (
              <p style={{ fontSize: 15, color: 'var(--muted-foreground)', marginBottom: 16 }}>
                {fmtDate(retreat.startDate)} — {fmtDate(retreat.endDate)}
              </p>
            )}

            {/* Categories */}
            {retreat.categories.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {retreat.categories.map((c, i) => (
                  <span key={i} className="bf-retreat-card-tag" style={{ fontSize: 12, padding: '3px 10px' }}>{c}</span>
                ))}
              </div>
            )}

            {/* Capacity + availability */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 14 }}>
              {retreat.maxCapacity && (
                <span style={{ color: 'var(--muted-foreground)' }}>Max capacity: {retreat.maxCapacity}</span>
              )}
              {retreat.availableSpaces !== null && (
                <span style={{ color: retreat.availableSpaces > 0 ? 'var(--success)' : 'var(--destructive)', fontWeight: 600 }}>
                  {retreat.availableSpaces > 0 ? `${retreat.availableSpaces} spaces left` : 'Full'}
                </span>
              )}
            </div>

            {/* Deposit */}
            {retreat.depositPercentage > 0 && (
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 16 }}>
                Deposit: {retreat.depositPercentage}% required at booking
              </p>
            )}

            {/* Description */}
            {(retreat.description || retreat.excerpt) && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--foreground)', marginBottom: 10 }}>About This Retreat</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--foreground)' }}>
                  {stripHtml(retreat.description || retreat.excerpt || '')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
