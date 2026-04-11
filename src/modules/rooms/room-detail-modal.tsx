'use client';

import { useState } from 'react';
import type { RoomData } from './types';

interface RoomDetailModalProps {
  room: RoomData;
  onClose: () => void;
}

export function RoomDetailModal({ room, onClose }: RoomDetailModalProps) {
  const allImages = room.galleryImages.length > 0 ? room.galleryImages : (room.heroImage ? [room.heroImage] : []);
  const [mainImage, setMainImage] = useState(allImages[0] ?? '');

  return (
    <div className="bf-modal-overlay" onClick={onClose} style={{ zIndex: 9500 }}>
      <div className="bf-modal bf-room-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bf-modal-header">
          <h2>{room.name}</h2>
          <button onClick={onClose} className="bf-modal-close">×</button>
        </div>
        <div className="bf-modal-body">
          {/* Image gallery */}
          <div className="bf-room-detail-gallery">
            {mainImage && (
              <div className="bf-room-detail-gallery-main" style={{ backgroundImage: `url(${mainImage})` }} />
            )}
            {allImages.slice(0, 8).map((url, i) => (
              <div
                key={i}
                className="bf-room-detail-gallery-thumb"
                style={{ backgroundImage: `url(${url})` }}
                onClick={() => setMainImage(url)}
              />
            ))}
          </div>

          {/* Features */}
          {room.features.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {room.features.map((f) => (
                <span key={f} className="bf-retreat-card-tag" style={{ fontSize: 10, padding: '3px 8px' }}>
                  {f}
                </span>
              ))}
            </div>
          )}

          {/* Room info grid */}
          <div className="bf-room-detail-info">
            <div className="bf-room-detail-stat">
              <div className="bf-room-detail-stat-label">Category</div>
              <div className="bf-room-detail-stat-value">{room.category}</div>
            </div>
            <div className="bf-room-detail-stat">
              <div className="bf-room-detail-stat-label">Occupancy</div>
              <div className="bf-room-detail-stat-value">
                {room.maxOccupancy} {room.isShared ? 'beds' : 'guests'}
              </div>
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

          {/* Beds */}
          {room.beds.length > 0 && (
            <div className="bf-room-detail-beds">
              {room.beds.map((b) => (
                <span key={b.id} className="bf-retreat-card-tag" style={{ fontSize: 10, padding: '2px 8px' }}>
                  {b.label} ({b.bedType})
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {room.description && (
            <div className="bf-room-detail-description" style={{ marginTop: 16 }}>
              {room.description.split('\n').map((p, i) => (
                <p key={i} style={{ marginBottom: 8 }}>{p}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
