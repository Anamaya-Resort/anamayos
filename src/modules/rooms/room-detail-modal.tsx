'use client';

import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { useAuth } from '@/modules/auth/auth-provider';
import { RoomLayoutSection } from './room-layout-section';
import type { RoomData } from './types';

interface RoomDetailModalProps {
  room: RoomData;
  onClose: () => void;
}

export function RoomDetailModal({ room, onClose }: RoomDetailModalProps) {
  const { accessLevel } = useAuth();
  const isAdmin = accessLevel >= 3;
  const allImages = room.galleryImages.length > 0 ? room.galleryImages : (room.heroImage ? [room.heroImage] : []);
  const [imgIdx, setImgIdx] = useState(0);
  const [nextIdx, setNextIdx] = useState<number | null>(null);
  const [nextOpacity, setNextOpacity] = useState(0);

  // Crossfade: mount next image at opacity 0, then transition to 1
  const startCrossfade = (next: number) => {
    if (next === imgIdx) return;
    setNextIdx(next);
    setNextOpacity(0);
    // Delay 1 frame so the element mounts at opacity 0, then transition kicks in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setNextOpacity(1);
      });
    });
    // After transition completes, swap current to next
    setTimeout(() => {
      setImgIdx(next);
      setNextIdx(null);
      setNextOpacity(0);
    }, 2000);
  };

  // Auto-advance: 5s display, 2s crossfade
  useEffect(() => {
    if (allImages.length <= 1) return;
    const timer = setInterval(() => {
      const next = (imgIdx + 1) % allImages.length;
      startCrossfade(next);
    }, 5000);
    return () => clearInterval(timer);
  }, [allImages.length, imgIdx]);

  return (
    <div className="bf-modal-overlay" onClick={onClose} style={{ zIndex: 9500 }}>
      <div className="bf-modal bf-room-detail-modal-wide" onClick={(e) => e.stopPropagation()}>
        <style>{`
          .bf-detail-scroll::-webkit-scrollbar { width: 8px; }
          .bf-detail-scroll::-webkit-scrollbar-track { background: transparent; }
          .bf-detail-scroll::-webkit-scrollbar-thumb { background: #c4c4c4; border-radius: 4px; min-height: 40px; }
          .bf-detail-scroll::-webkit-scrollbar-thumb:hover { background: #a3a3a3; }
          .bf-detail-scroll { scrollbar-width: thin; scrollbar-color: #c4c4c4 transparent; }
        `}</style>
        <div className="bf-modal-header">
          <h2>{room.name}</h2>
          <button onClick={onClose} className="bf-modal-close">×</button>
        </div>

        {/* Single scrollable container — left padding matches scrollbar width for symmetry */}
        <div className="bf-detail-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingLeft: 8 }}>
          {/* Image with crossfade + dot navigation */}
          {allImages.length > 0 && (
            <div style={{ position: 'relative', aspectRatio: '16/10' }}>
              {/* Current image — always visible underneath */}
              <div
                className="bf-room-detail-img-full"
                style={{
                  backgroundImage: `url(${allImages[imgIdx]})`,
                  position: 'absolute', inset: 0,
                }}
              />
              {/* Next image — fades in on top of current */}
              {nextIdx !== null && (
                <div
                  className="bf-room-detail-img-full"
                  style={{
                    backgroundImage: `url(${allImages[nextIdx]})`,
                    position: 'absolute', inset: 0,
                    opacity: nextOpacity,
                    transition: 'opacity 2s ease',
                  }}
                />
              )}
              {/* Dot navigation */}
              {allImages.length > 1 && (
                <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, zIndex: 2 }}>
                  {allImages.map((_, i) => (
                    <button key={i} onClick={() => startCrossfade(i)}
                      style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: i === imgIdx || i === nextIdx ? '#A35B4E' : 'rgba(255,255,255,0.7)', transition: 'background 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Info section */}
          <div style={{ padding: '16px 20px' }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e7e5e4' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#44403c' }}>{room.name} Info</h3>
              {isAdmin && (
                <button
                  onClick={() => window.open(`/dashboard/rooms/${room.id}/edit`, '_blank')}
                  style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer' }}
                  title="Edit room info (opens in new tab)"
                >
                  <Settings size={16} color="#A35B4E" />
                </button>
              )}
            </div>
            {room.features.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {room.features.map((f) => (
                  <span key={f} className="bf-retreat-card-tag" style={{ fontSize: 10, padding: '3px 8px' }}>{f}</span>
                ))}
              </div>
            )}
            <div className="bf-room-detail-info">
              <div className="bf-room-detail-stat">
                <div className="bf-room-detail-stat-label">Category</div>
                <div className="bf-room-detail-stat-value">{room.category}</div>
              </div>
              <div className="bf-room-detail-stat">
                <div className="bf-room-detail-stat-label">Occupancy</div>
                <div className="bf-room-detail-stat-value">{room.maxOccupancy} {room.isShared ? 'beds' : 'guests'}</div>
              </div>
              <div className="bf-room-detail-stat">
                <div className="bf-room-detail-stat-label">Type</div>
                <div className="bf-room-detail-stat-value">{room.isShared ? 'Shared' : 'Private'}</div>
              </div>
            </div>
            {room.beds.length > 0 && (
              <div className="bf-room-detail-beds">
                {room.beds.map((b) => (
                  <span key={b.id} className="bf-retreat-card-tag bf-bed-tag" style={{ fontSize: 10, padding: '2px 8px' }}>
                    {b.label} ({b.bedType})
                  </span>
                ))}
              </div>
            )}
            {/* Short description — bold, slightly larger */}
            {room.description && (
              <p style={{ fontSize: 14, fontWeight: 600, color: '#444', marginTop: 12, lineHeight: 1.5 }}>
                {room.description}
              </p>
            )}
            {/* Long description */}
            {room.longDescription && (
              <div className="bf-room-detail-description" style={{ marginTop: 8 }}>
                <span style={{ fontWeight: 700 }}>Description: </span>
                {room.longDescription.split('\n').map((p, i) => (
                  <span key={i}>{i > 0 && <br />}{p}</span>
                ))}
              </div>
            )}
            <RoomLayoutSection
              roomId={room.id}
              beds={room.beds.map((b) => ({ id: b.id, label: b.label, bedType: b.bedType, capacity: b.capacity }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
