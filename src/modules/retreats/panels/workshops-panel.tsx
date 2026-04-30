'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, Pencil } from 'lucide-react';

interface Workshop {
  id: string;
  name: string;
  description: string | null;
  workshop_kind: string;
  duration_minutes: number | null;
  price: number | string;
  currency: string;
  capacity: number | null;
  sales_commission_pct: number | string;
  anamaya_pct: number | string;
  retreat_leader_pct: number | string;
  payout_person_id: string | null;
  sort_order: number;
  is_active: boolean;
  payout?: { id: string; full_name: string | null } | null;
}

interface EditState {
  id?: string;
  name: string;
  description: string;
  workshop_kind: string;
  duration_minutes: string;
  price: string;
  capacity: string;
  anamaya_pct: string;
  retreat_leader_pct: string;
  sales_commission_pct: string;
}

const EMPTY_EDIT: EditState = {
  name: '', description: '', workshop_kind: 'workshop',
  duration_minutes: '', price: '', capacity: '',
  anamaya_pct: '30', retreat_leader_pct: '70', sales_commission_pct: '0',
};

interface Props { retreatId: string; }

export function WorkshopsPanel({ retreatId }: Props) {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadWorkshops = useCallback(async () => {
    const res = await fetch(`/api/admin/retreat-workshops?retreatId=${retreatId}`);
    if (res.ok) {
      const data = await res.json();
      setWorkshops(data.workshops ?? []);
    }
    setLoading(false);
  }, [retreatId]);

  useEffect(() => { loadWorkshops(); }, [loadWorkshops]);

  const openNew = () => setEditModal({ ...EMPTY_EDIT });

  const openEdit = (w: Workshop) => setEditModal({
    id: w.id,
    name: w.name,
    description: w.description ?? '',
    workshop_kind: w.workshop_kind,
    duration_minutes: w.duration_minutes?.toString() ?? '',
    price: Number(w.price).toString(),
    capacity: w.capacity?.toString() ?? '',
    anamaya_pct: Number(w.anamaya_pct).toString(),
    retreat_leader_pct: Number(w.retreat_leader_pct).toString(),
    sales_commission_pct: Number(w.sales_commission_pct).toString(),
  });

  const handleSave = async () => {
    if (!editModal || !editModal.name.trim()) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      name: editModal.name.trim(),
      description: editModal.description || null,
      workshop_kind: editModal.workshop_kind,
      duration_minutes: editModal.duration_minutes ? Number(editModal.duration_minutes) : null,
      price: Number(editModal.price) || 0,
      capacity: editModal.capacity ? Number(editModal.capacity) : null,
      anamaya_pct: Number(editModal.anamaya_pct) || 30,
      retreat_leader_pct: Number(editModal.retreat_leader_pct) || 70,
      sales_commission_pct: Number(editModal.sales_commission_pct) || 0,
    };

    if (editModal.id) {
      body.id = editModal.id;
      await fetch('/api/admin/retreat-workshops', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      body.retreat_id = retreatId;
      await fetch('/api/admin/retreat-workshops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }

    setSaving(false);
    setEditModal(null);
    await loadWorkshops();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/admin/retreat-workshops?id=${deleteId}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteId(null);
    await loadWorkshops();
  };

  if (loading) return <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Optional add-on workshops guests can purchase during this retreat.
        </p>
        <Button size="sm" variant="outline" onClick={openNew} className="gap-1 h-7 text-xs">
          <Plus className="h-3 w-3" /> Add Workshop
        </Button>
      </div>

      {workshops.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-2">No workshops yet. Click &ldquo;Add Workshop&rdquo; to create one.</p>
      ) : (
        <div className="space-y-2">
          {workshops.map((w) => {
            const price = Number(w.price);
            return (
              <div key={w.id} className="rounded border bg-muted/20 px-3 py-2.5 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium">
                      <span className="font-semibold">${price.toFixed(0)}</span>
                      <span className="mx-1.5 text-muted-foreground">—</span>
                      {w.name}
                    </div>
                    {w.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{w.description.replace(/<[^>]*>/g, '')}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span className="capitalize">{w.workshop_kind}</span>
                      {w.duration_minutes && <span>{w.duration_minutes} min</span>}
                      {w.capacity && <span>Max {w.capacity}</span>}
                      <span>{Number(w.anamaya_pct)}% house · {Number(w.retreat_leader_pct)}% leader</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => openEdit(w)} className="p-1 text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(w.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit/Create Modal */}
      <Dialog open={!!editModal} onOpenChange={(open) => { if (!open) setEditModal(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editModal?.id ? 'Edit Workshop' : 'Add Workshop'}</DialogTitle>
          </DialogHeader>
          {editModal && (
            <div className="space-y-3">
              <Field label="Name *">
                <input value={editModal.name} onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                  placeholder="e.g. Breathwork & Cacao Ceremony" className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
              </Field>
              <Field label="Description">
                <textarea value={editModal.description} onChange={(e) => setEditModal({ ...editModal, description: e.target.value })}
                  placeholder="What guests will experience..." rows={3}
                  className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Price ($)">
                  <input type="number" step="0.01" value={editModal.price} onChange={(e) => setEditModal({ ...editModal, price: e.target.value })}
                    placeholder="40" className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                </Field>
                <Field label="Duration (min)">
                  <input type="number" value={editModal.duration_minutes} onChange={(e) => setEditModal({ ...editModal, duration_minutes: e.target.value })}
                    placeholder="90" className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                </Field>
                <Field label="Max Capacity">
                  <input type="number" value={editModal.capacity} onChange={(e) => setEditModal({ ...editModal, capacity: e.target.value })}
                    placeholder="20" className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                </Field>
              </div>
              <Field label="Type">
                <select value={editModal.workshop_kind} onChange={(e) => setEditModal({ ...editModal, workshop_kind: e.target.value })}
                  className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50">
                  <option value="workshop">Workshop</option>
                  <option value="class">Class</option>
                  <option value="session">Session</option>
                  <option value="ceremony">Ceremony</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Revenue Split (must total 100%)</label>
                <div className="grid grid-cols-3 gap-3 mt-1">
                  <Field label="House %">
                    <input type="number" step="0.01" value={editModal.anamaya_pct}
                      onChange={(e) => setEditModal({ ...editModal, anamaya_pct: e.target.value })}
                      className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                  </Field>
                  <Field label="Leader %">
                    <input type="number" step="0.01" value={editModal.retreat_leader_pct}
                      onChange={(e) => setEditModal({ ...editModal, retreat_leader_pct: e.target.value })}
                      className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                  </Field>
                  <Field label="Sales %">
                    <input type="number" step="0.01" value={editModal.sales_commission_pct}
                      onChange={(e) => setEditModal({ ...editModal, sales_commission_pct: e.target.value })}
                      className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                  </Field>
                </div>
                {(() => {
                  const total = Number(editModal.anamaya_pct || 0) + Number(editModal.retreat_leader_pct || 0) + Number(editModal.sales_commission_pct || 0);
                  return total !== 100 ? (
                    <p className="text-xs text-destructive mt-1">Total is {total.toFixed(0)}% — must equal 100%</p>
                  ) : null;
                })()}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !editModal?.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {editModal?.id ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Workshop</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This will permanently remove this workshop from the retreat.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
