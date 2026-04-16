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
  // Slider: 0 = all images, 100 = all info. Default 50/50.
  const [split, setSplit] = useState(50);

  // Auto-cycle images every 5 seconds
  useEffect(() => {
    if (allImages.length <= 1) return;
    const interval = setInterval(() => setImgIdx((i) => (i + 1) % allImages.length), 5000);
    return () => clearInterval(interval);
  }, [allImages.length]);

  const imgHeight = `${Math.max(15, 70 - split * 0.55)}vh`;
  const infoFlex = Math.max(0.1, split / 50);

  return (
    <div className="bf-modal-overlay" onClick={onClose} style={{ zIndex: 9500 }}>
      <div className="bf-modal bf-room-detail-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="bf-modal-header">
          <h2>{room.name}</h2>
          <button onClick={onClose} className="bf-modal-close">×</button>
        </div>

        <div className="bf-room-detail-layout">
          {/* Image section — single image with dot navigation */}
          {allImages.length > 0 && (
            <div style={{ flexShrink: 0 }}>
              <div
                className="bf-room-detail-img-full"
                style={{
                  backgroundImage: `url(${allImages[imgIdx]})`,
                  height: imgHeight,
                  transition: 'height 0.3s ease',
                }}
              />
              {/* Dot navigation */}
              {allImages.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '8px 0' }}>
                  {allImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIdx(i)}
                      style={{
                        width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: i === imgIdx ? '#A35B4E' : '#d4d4d8',
                        transition: 'background 0.2s',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Single slider — controls image vs info split */}
          <div style={{ padding: '0 20px', flexShrink: 0 }}>
            <input type="range" min={0} max={100} value={split}
              onChange={(e) => setSplit(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#A35B4E', height: 4, cursor: 'pointer' }}
            />
          </div>

          {/* Info section */}
          <div className="bf-room-detail-info-section" style={{ flex: infoFlex, transition: 'flex 0.3s ease' }}>
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

            {/* Room layout viewer + admin button */}
            <RoomLayoutSection
              roomId={room.id}
              beds={room.beds.map((b) => ({
                id: b.id, label: b.label, bedType: b.bedType, capacity: b.capacity,
              }))}
              showAdmin
            />
          </div>
        </div>
      </div>
    </div>
  );
}
