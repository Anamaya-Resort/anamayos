'use client';

import Link from 'next/link';
import { PenLine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TranslationKeys } from '@/i18n/en';

interface RoomLayoutsPanelProps {
  rooms: Array<{ id: string; name: string; bedCount: number; hasLayout: boolean }>;
  dict: TranslationKeys;
}

export function RoomLayoutsPanel({ rooms, dict }: RoomLayoutsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{dict.settings.roomLayouts}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {dict.settings.roomLayoutsDesc}
        </p>
        <div className="space-y-1">
          {rooms.map((room) => (
            <Link
              key={room.id}
              href={`/dashboard/rooms/${room.id}/layout`}
              className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <PenLine className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                <div>
                  <span className="font-medium">{room.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {room.bedCount} {room.bedCount === 1 ? 'bed' : 'beds'}
                  </span>
                </div>
              </div>
              <span className={`text-xs ${room.hasLayout ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {room.hasLayout ? dict.settings.layoutCreated : dict.settings.noLayout}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
