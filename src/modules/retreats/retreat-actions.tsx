'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Settings, Trash2, Loader2 } from 'lucide-react';

interface Props {
  retreatId: string;
  retreatName: string;
}

export function RetreatActions({ retreatId, retreatName }: Props) {
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/admin/retreats/${retreatId}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/dashboard/retreats');
    }
    setDeleting(false);
    setShowDelete(false);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Link href={`/dashboard/retreats/${retreatId}/edit`}
          className="inline-flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Settings className="h-3.5 w-3.5" /> Edit
        </Link>
        <button onClick={() => setShowDelete(true)}
          className="inline-flex items-center gap-1.5 rounded border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Confirm Delete Retreat</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &ldquo;{retreatName}&rdquo;? It will be moved to the trash and can be permanently deleted later.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
