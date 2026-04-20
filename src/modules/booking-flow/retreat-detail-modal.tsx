'use client';

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

export function RetreatDetailModal({ retreat, onClose }: RetreatDetailModalProps) {
  const imgObj = retreat.images as unknown as Record<string, { url?: string }> | null;
  const img = imgObj?.full?.url ?? imgObj?.large?.url ?? null;

  return (
    <div className="bf-modal-overlay" onClick={onClose} style={{ zIndex: 9500 }}>
      <div className="bf-modal bf-room-detail-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="bf-modal-header">
          <h2>{retreat.name}</h2>
          <button onClick={onClose} className="bf-modal-close">&times;</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {/* Image */}
          {img && (
            <div style={{ position: 'relative', aspectRatio: '16/9' }}>
              <div className="bf-room-detail-img-full" style={{ backgroundImage: `url(${img})`, position: 'absolute', inset: 0 }} />
            </div>
          )}

          {/* Info */}
          <div style={{ padding: '20px 24px' }}>
            {/* Teacher */}
            {retreat.teacher && (
              <p style={{ fontSize: 16, color: 'var(--brand-btn)', fontWeight: 600, marginBottom: 8 }}>
                with {retreat.teacher}
              </p>
            )}

            {/* Dates */}
            {retreat.startDate && retreat.endDate && (
              <p style={{ fontSize: 15, color: 'var(--muted-foreground)', marginBottom: 12 }}>
                {fmtDate(retreat.startDate)} — {fmtDate(retreat.endDate)}
              </p>
            )}

            {/* Categories */}
            {retreat.categories.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {retreat.categories.map((c, i) => (
                  <span key={i} className="bf-retreat-card-tag" style={{ fontSize: 12, padding: '3px 8px' }}>{c}</span>
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
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)', marginBottom: 8 }}>About This Retreat</h3>
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
