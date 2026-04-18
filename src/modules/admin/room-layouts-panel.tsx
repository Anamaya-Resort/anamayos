'use client';

import Link from 'next/link';
import { PenLine } from 'lucide-react';
import type { TranslationKeys } from '@/i18n/en';

interface RoomLayoutRoom {
  id: string;
  name: string;
  category: string;
  bedCount: number;
  bedLabels: string[];
  hasLayout: boolean;
  thumbnail: string | null;
  shapeCount: number;
  furnitureCount: number;
  openingCount: number;
}

interface RoomLayoutsPanelProps {
  rooms: RoomLayoutRoom[];
  dict: TranslationKeys;
}

export function RoomLayoutsPanel({ rooms, dict }: RoomLayoutsPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{dict.settings.roomLayouts}</h3>
        <p className="text-sm text-muted-foreground">{dict.settings.roomLayoutsDesc}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {rooms.map((room) => (
          <Link key={room.id} href={`/dashboard/rooms/${room.id}/layout`}
            className="bf-retreat-card group" style={{ textDecoration: 'none' }}>
            {/* Header */}
            <div className="bf-card-header">
              <p className="bf-card-title">{room.name}</p>
              <div className="bf-card-header-actions">
                <span className="bf-card-details-btn ao-btn-fx--subtle">
                  <PenLine className="h-3 w-3" /> Edit
                </span>
              </div>
            </div>

            {/* Thumbnail image */}
            <div className="bf-card-img-container">
              {room.thumbnail ? (
                <div className="bf-retreat-card-img"
                  style={{ backgroundImage: `url(${room.thumbnail})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundColor: '#ffffff' }} />
              ) : (
                <div className="bf-retreat-card-img" style={{ backgroundColor: '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="text-xs text-muted-foreground">{dict.settings.noLayout}</span>
                </div>
              )}
            </div>

            {/* Info body */}
            <div className="bf-retreat-card-body">
              {/* Category + bed count */}
              <p className="bf-retreat-card-dates">
                {room.category && <>{room.category} &middot; </>}
                {room.bedCount} {room.bedCount === 1 ? 'bed' : 'beds'}
              </p>

              {/* Bed labels as tags */}
              {room.bedLabels.length > 0 && (
                <div className="bf-retreat-card-tags">
                  {room.bedLabels.slice(0, 6).map((label, i) => (
                    <span key={i} className="bf-retreat-card-tag bf-bed-tag">{label}</span>
                  ))}
                  {room.bedLabels.length > 6 && (
                    <span className="bf-retreat-card-tag">+{room.bedLabels.length - 6}</span>
                  )}
                </div>
              )}

              {/* Layout stats */}
              {room.hasLayout ? (
                <p className="bf-retreat-card-spots" style={{ color: '#16a34a' }}>
                  {room.shapeCount} {room.shapeCount === 1 ? 'room' : 'rooms'}
                  {room.furnitureCount > 0 && <> &middot; {room.furnitureCount} furniture</>}
                  {room.openingCount > 0 && <> &middot; {room.openingCount} openings</>}
                </p>
              ) : (
                <p className="bf-retreat-card-spots">{dict.settings.noLayout}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
