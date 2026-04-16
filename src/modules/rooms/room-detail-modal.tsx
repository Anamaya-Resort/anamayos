'use client';

import { useEffect, useState } from 'react';
import { RoomLayoutSection } from './room-layout-section';
import type { RoomData } from './types';

interface RoomDetailModalProps {
  room: RoomData;
  onClose: () => void;
}

export function RoomDetailModal({ room, onClose }: RoomDetailModalProps) {
  const allImages = room.galleryImages.length > 0 ? room.galleryImages : (room.heroImage ? [room.heroImage] : []);
  const [imgIdx, setImgIdx] = useState(0);
  // Split: 0 = all images, 100 = all info
  const [split, setSplit] = useState(50);

  useEffect(() => {
    if (allImages.length <= 1) return;
    const interval = setInterval(() => setImgIdx((i) => (i + 1) % allImages.length), 5000);
    return () => clearInterval(interval);
  }, [allImages.length]);

  const imgFlex = Math.max(0.15, (100 - split) / 50);
  const infoFlex = Math.max(0.15, split / 50);

  return (
    <div className="bf-modal-overlay" onClick={onClose} style={{ zIndex: 9500 }}>
      <div className="bf-modal bf-room-detail-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="bf-modal-header">
          <h2>{room.name}</h2>
          <button onClick={onClose} className="bf-modal-close">×</button>
        </div>

        {/* Content area: left column (images + info) + right vertical slider */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', maxHeight: 'calc(85vh - 60px)' }}>
          {/* Left: images + info stacked */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {/* Images section */}
            {allImages.length > 0 && (
              <div style={{ flex: imgFlex, flexShrink: 0, minHeight: 80, transition: 'flex 0.3s ease', overflow: 'hidden', position: 'relative' }}>
                <div
                  className="bf-room-detail-img-full"
                  style={{ backgroundImage: `url(${allImages[imgIdx]})`, height: '100%' }}
                />
                {/* Dot navigation */}
                {allImages.length > 1 && (
                  <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
                    {allImages.map((_, i) => (
                      <button key={i} onClick={() => setImgIdx(i)}
                        style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer',
                          background: i === imgIdx ? '#A35B4E' : 'rgba(255,255,255,0.7)', transition: 'background 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Info section */}
            <div className="bf-room-detail-info-section" style={{ flex: infoFlex, transition: 'flex 0.3s ease', overflow: 'auto' }}>
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
                {room.ratePerNight && (
                  <div className="bf-room-detail-stat">
                    <div className="bf-room-detail-stat-label">Rate</div>
                    <div className="bf-room-detail-stat-value">${room.ratePerNight}/night</div>
                  </div>
                )}
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
              {room.description && (
                <div className="bf-room-detail-description" style={{ marginTop: 12 }}>
                  {room.description.split('\n').map((p, i) => (
                    <p key={i} style={{ marginBottom: 8 }}>{p}</p>
                  ))}
                </div>
              )}
              <RoomLayoutSection
                roomId={room.id}
                beds={room.beds.map((b) => ({ id: b.id, label: b.label, bedType: b.bedType, capacity: b.capacity }))}
                showAdmin
              />
            </div>
          </div>

          {/* Right: vertical slider */}
          <div style={{ width: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}>
            <input type="range" min={0} max={100} value={split}
              onChange={(e) => setSplit(parseInt(e.target.value))}
              style={{
                writingMode: 'vertical-lr' as never,
                WebkitAppearance: 'none',
                width: 4, height: '100%',
                accentColor: '#A35B4E',
                cursor: 'pointer',
                transform: 'rotate(180deg)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
