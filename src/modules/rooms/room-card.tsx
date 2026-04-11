'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';
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

  const isUnavailable = mode === 'select' && availableBeds !== undefined && availableBeds === 0;

  return (
    <>
      <div
        className={`bf-retreat-card ${isSelected ? 'bf-retreat-card-selected' : ''} ${
          isUnavailable ? 'bf-card-unavailable' : ''
        }`}
      >
        {/* Enlarge button */}
        <button
          type="button"
          className="bf-card-enlarge"
          onClick={(e) => { e.stopPropagation(); setDetailOpen(true); }}
        >
          <Maximize2 className="h-3 w-3 inline mr-1" />
          Enlarge
        </button>

        {/* Card content — clickable in select mode */}
        <button
          type="button"
          onClick={mode === 'select' && !isUnavailable ? onSelect : undefined}
          disabled={isUnavailable}
          style={{ background: 'none', border: 'none', padding: 0, cursor: mode === 'select' ? 'pointer' : 'default', textAlign: 'left', width: '100%', font: 'inherit' }}
        >
          {room.heroImage ? (
            <div className="bf-retreat-card-img" style={{ backgroundImage: `url(${room.heroImage})` }} />
          ) : (
            <div className="bf-retreat-card-img bf-retreat-card-img-empty" />
          )}
          <div className="bf-retreat-card-body">
            <p className="bf-retreat-card-name">{room.name}</p>
            <p className="bf-retreat-card-dates">
              {room.category} · {room.maxOccupancy} {room.isShared ? 'beds' : 'guests'}
            </p>
            {room.ratePerNight && (
              <p className="bf-retreat-card-leader">${room.ratePerNight}/night</p>
            )}
            {room.beds.length > 0 && (
              <div className="bf-retreat-card-tags">
                {room.beds.map((b) => (
                  <span key={b.id} className="bf-retreat-card-tag">{b.label}</span>
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
            {mode === 'select' && availableBeds !== undefined && (
              <p className="bf-retreat-card-spots">
                {isUnavailable ? 'Fully booked' : `${availableBeds} beds available`}
              </p>
            )}
            {mode === 'select' && !isUnavailable && (
              <Badge className="mt-2 text-xs bg-brand-btn text-white">Select</Badge>
            )}
          </div>
        </button>
      </div>

      {/* Detail modal */}
      {detailOpen && (
        <RoomDetailModal room={room} onClose={() => setDetailOpen(false)} />
      )}
    </>
  );
}
