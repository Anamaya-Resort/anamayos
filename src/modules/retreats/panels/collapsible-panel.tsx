'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsiblePanel({ title, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader className="pb-0 cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px] text-foreground/70">{title}</CardTitle>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-3">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
