'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { RoomDetailModal } from './room-detail-modal';
import type { RoomData, RoomCardMode } from './types';

interface RoomCardProps {
  room: RoomData;
  mode: RoomCardMode;
  isSelected?: boolean;
  availableBeds?: number;
  onSelect?: () => void;
}

export function RoomCard({ room, mode, isSelected, availableBeds, onSelect }: RoomCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const hoverRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const images = room.galleryImages.length > 0 ? room.galleryImages : (room.heroImage ? [room.heroImage] : []);
  const hasMultipleImages = images.length > 1;

  const isUnavailable = mode === 'select' && availableBeds !== undefined && availableBeds === 0;

  // Hover crossfade: show each image for 3s, crossfade over 2s
  const startCrossfade = useCallback(() => {
    if (!hasMultipleImages) return;
    timerRef.current = setTimeout(() => {
      if (!hoverRef.current) return;
      setFading(true);
      setTimeout(() => {
        setImgIndex((prev) => (prev + 1) % images.length);
        setFading(false);
        if (hoverRef.current) startCrossfade();
      }, 2000); // 2s crossfade
    }, 3000); // 3s display
  }, [hasMultipleImages, images.length]);

  function handleMouseEnter() {
    hoverRef.current = true;
    startCrossfade();
  }

  function handleMouseLeave() {
    hoverRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const currentImg = images[imgIndex] ?? room.heroImage ?? '';
  const nextImg = images[(imgIndex + 1) % images.length] ?? currentImg;

  function openDetails(e: React.MouseEvent) {
    e.stopPropagation();
    setDetailOpen(true);
  }

  return (
    <>
      <div
        className={`bf-retreat-card ${isSelected ? 'bf-retreat-card-selected' : ''} ${
          isUnavailable ? 'bf-card-unavailable' : ''
        }`}
      >
        {/* Card header: title + CHOOSE/DETAILS */}
        <div className="bf-card-header">
          <p className="bf-card-title">{room.name}</p>
          <div className="bf-card-header-actions">
            <button type="button" className="bf-card-details-btn ao-btn-fx--subtle" onClick={openDetails}>
              <Info className="h-3 w-3" /> Details
            </button>
            {mode === 'select' && !isUnavailable && (
              <button type="button" className="bf-card-choose-btn ao-btn-fx--strong" onClick={(e) => { e.stopPropagation(); onSelect?.(); }}>
                CHOOSE
              </button>
            )}
          </div>
        </div>

        {/* Image — clickable to open details, hover crossfade */}
        <div
          className="bf-card-img-container"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={openDetails}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="bf-retreat-card-img"
            style={{ backgroundImage: `url(${currentImg})`, opacity: fading ? 0 : 1, transition: 'opacity 2s ease' }}
          />
          {hasMultipleImages && (
            <div
              className="bf-retreat-card-img bf-card-img-next"
              style={{ backgroundImage: `url(${nextImg})`, opacity: fading ? 1 : 0, transition: 'opacity 2s ease' }}
            />
          )}
        </div>

        {/* Card body — inner flex-row to put thumbnail on right */}
        <div style={{ display: 'flex', flexDirection: 'row', flex: 1 }}>
          <div className="bf-retreat-card-body" style={{ flex: 1, minWidth: 0 }}>
            <p className="bf-retreat-card-dates">
              {room.category} · {room.maxOccupancy} {room.isShared ? 'beds' : 'guests'}
            </p>
            {room.ratePerNight && (
              <p className="bf-retreat-card-leader">${room.ratePerNight}/night</p>
            )}
            {room.beds.length > 0 && (
              <div className="bf-retreat-card-tags">
                {room.beds.map((b) => (
                  <span key={b.id} className="bf-retreat-card-tag bf-bed-tag">{b.label}</span>
                ))}
              </div>
            )}
            {room.features.length > 0 && (
              <div className="bf-retreat-card-tags" style={{ marginTop: 3 }}>
                {room.features.slice(0, 4).map((f) => (
                  <span key={f} className="bf-retreat-card-tag" style={{ opacity: 0.7 }}>{f}</span>
                ))}
              </div>
            )}
            {room.description && (
              <p style={{ fontSize: 10, color: '#666', marginTop: 4, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {room.description}
              </p>
            )}
            {mode === 'select' && availableBeds !== undefined && (
              <p className="bf-retreat-card-spots">
                {isUnavailable ? 'Fully booked' : `${availableBeds} beds available`}
              </p>
            )}
          </div>
          {/* Right: layout thumbnail — centered, equal padding */}
          {room.layoutThumbnail && (
            <div style={{ width: 100, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
              <img
                src={room.layoutThumbnail}
                alt={`${room.name} layout`}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }}
              />
            </div>
          )}
        </div>
      </div>

      {detailOpen && (
        <RoomDetailModal room={room} onClose={() => setDetailOpen(false)} />
      )}
    </>
  );
}
