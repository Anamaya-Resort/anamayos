'use client';

import { useEffect, useRef, useState } from 'react';
import type { RoomData } from './types';

interface RoomDetailModalProps {
  room: RoomData;
  onClose: () => void;
}

export function RoomDetailModal({ room, onClose }: RoomDetailModalProps) {
  const allImages = room.galleryImages.length > 0 ? room.galleryImages : (room.heroImage ? [room.heroImage] : []);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll images every 5 seconds
  useEffect(() => {
    if (allImages.length <= 1) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % allImages.length;
      const container = scrollRef.current;
      if (container) {
        const children = container.children;
        if (children[idx]) {
          children[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [allImages.length]);

  return (
    <div className="bf-modal-overlay" onClick={onClose} style={{ zIndex: 9500 }}>
      <div className="bf-modal bf-room-detail-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="bf-modal-header">
          <h2>{room.name}</h2>
          <button onClick={onClose} className="bf-modal-close">×</button>
        </div>

        <div className="bf-room-detail-layout">
          {/* Scrollable image container */}
          <div className="bf-room-detail-images" ref={scrollRef}>
            {allImages.map((url, i) => (
              <div key={i} className="bf-room-detail-img-full" style={{ backgroundImage: `url(${url})` }} />
            ))}
          </div>

          {/* Fixed room info below */}
          <div className="bf-room-detail-info-section">
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
          </div>
        </div>
      </div>
    </div>
  );
}
