# Room Builder — Feature Brief

## Overview

An admin tool for creating visual, top-down room layouts with placed beds. These layouts appear in the guest-facing room detail modal, where guests can see bed positions and select beds during booking. The reservation team uses the same view to manage bed assignments for retreats.

---

## Three-Panel Layout

The builder lives at `/dashboard/rooms/[id]/layout` (or a modal from the rooms page). Three panels:

### Panel 1: Canvas (left, ~65% width)
The main interactive drawing surface. Top-down view of the room.

- **Grid system** with a meters/feet toggle (persisted per user)
  - Meters: heavy lines at 1m, light lines at 10cm
  - Feet: heavy lines at 1ft, light lines at 3in
- **Coordinate origin** at top-left corner (0,0)
- Background is white/light; shapes are outlined

### Panel 2: Bed List (top-right, ~35% width)
A live list of all beds belonging to this room, pulled from the `beds` table.

- Shows bed label, bed type, capacity, dimensions
- **Source of truth** — to add a bed visually, the user first adds it to this list (creates a `beds` row)
- Unplaced beds show a "drag to canvas" indicator
- Placed beds show a thumbnail of their position
- Clicking a bed in the list highlights it on the canvas (and vice versa)

### Panel 3: Tool Panel (bottom-right, ~35% width)
Drawing and configuration tools.

- **Shape tools:** Rectangle, with edge-drag resizing and center-tab bend (for curved walls)
- **Dimension input:** Text field for exact width,depth (e.g., `8,8.5`) — snaps to entered size in current unit
- **Unit toggle:** Meters / Feet
- **Bed palette:** Drag-and-drop preset icons for each bed type (see below)
- **Text tool:** For labeling areas (deck, bathroom, view direction, etc.)
- **Shape presets:** Deck, Bathroom, Landing — add-on rectangles that snap to the room shape

---

## Shapes

### Room Rectangle
- Drawn from corner point (Photoshop-style click-drag)
- Displays live dimensions in bottom-right while dragging
- Edge handles for resizing after placement
- Center-tab handle that creates a curve when dragged (for curved walls)
- Each shape is independent — multiple rectangles can be added and snapped together to form complex layouts (main room + deck + bathroom)

### Shape Types
Each rectangle/shape has a `type` property:
- `room` — the main living space
- `bathroom` — attached bathroom
- `deck` — outdoor deck/landing
- `loft` — loft area (drawn as overlay with dashed outline)

---

## Beds

### Bed Presets (drag from palette)

| Type | DB `bed_type` | Size | Capacity | Pillows |
|------|--------------|------|----------|---------|
| Single | `single` | 1.0m x 1.9m | 1 | 1 |
| Single Long | `single_long` | 1.0m x 2.0m | 1 | 1 |
| Bunk Bottom | `bunk_bottom` | 1.0m x 1.9m | 1 | 1 |
| Bunk Top | `bunk_top` | 1.0m x 1.9m | 1 | 1 (dashed outline) |
| Double | `double` | 1.35m x 2.0m | 2 | 2 |
| Queen | `queen` | 1.52m x 2.0m | 2 | 2 |
| King | `king` | 2.0m x 2.0m | 2 | 2 |

### Bed Rendering (top-down)
- Rectangle at true scale on the grid
- Pillow(s) drawn as "squircle" shapes (rounded rectangle with slightly curved sides) at the head end
- 1 pillow for single-capacity beds, 2 side-by-side pillows for double-capacity beds
- Bunk top beds rendered with a dashed outline to distinguish from bunk bottom

### Bed Placement
- Drag from palette onto canvas — appears at correct scale
- Can be moved freely after placement
- **Rotation:** Snaps to 45-degree increments by default; free rotation also supported (hold Shift or similar)
- Beds must be linked to a `beds` table row — the palette only shows beds from the bed list (Panel 2)

### Split King
- When two Single Long beds are placed adjacent, a **split-king connector icon** (double-headed inward arrows) appears between them
- Clicking the connector **animates** the two beds sliding together to form a Split King (2.0m x 2.0m visual)
- The connector then changes to outward arrows; clicking again animates them sliding apart to their original positions
- This is a **visual toggle only** — the DB still stores two `single_long` beds. The layout JSON stores the paired state.

### Bed Naming
- Click a bed on canvas → modal to set its label (must match a `beds` row)
- Or drag a specific bed from the bed list (Panel 2) to place it — auto-links

---

## Text Labels

Conveniently-placed text boxes for common annotations:
- "Ocean View" / "Garden View" — placed along room edges
- "Deck" / "Bathroom" / "Loft" — placed inside those shapes
- Default state: light grey placeholder text on white (e.g., "Add description...")
- When edited: shows the entered text in a readable style
- Text is stored in the layout JSON, not in a separate table

---

## Data Model

### New: `room_layouts` table (migration 00014)

```
id          UUID PK
room_id     UUID FK → rooms (UNIQUE — one layout per room)
layout_json JSONB NOT NULL DEFAULT '{}'
unit        TEXT NOT NULL DEFAULT 'meters' CHECK (unit IN ('meters', 'feet'))
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

### `layout_json` Structure

```jsonc
{
  "shapes": [
    {
      "id": "shape-1",
      "type": "room",         // room | bathroom | deck | loft
      "x": 0, "y": 0,        // position in meters (always stored in meters)
      "width": 6.0,
      "depth": 4.5,
      "curve": null,          // { controlX, controlY } for curved wall, or null
      "rotation": 0           // degrees
    }
  ],
  "beds": [
    {
      "id": "bed-placement-1",
      "bedId": "uuid-from-beds-table",  // FK to beds.id
      "x": 1.2, "y": 0.5,              // position in meters
      "rotation": 0,                     // degrees
      "splitKingPairId": null            // bed-placement ID of paired bed, or null
    }
  ],
  "labels": [
    {
      "id": "label-1",
      "text": "Ocean View",
      "x": 3.0, "y": -0.3,
      "rotation": 0,
      "fontSize": 14
    }
  ]
}
```

**All coordinates stored in meters regardless of display unit.** Conversion to feet is display-only.

### Existing Tables Used

| Table | Role |
|-------|------|
| `rooms` | Parent entity. Each room has one optional layout. |
| `beds` | Source of truth for bed inventory. Layout references `beds.id`. |
| `booking_bed_assignments` | Tracks which booking occupies which bed. Drives the "Occupied" state in guest view. |

---

## Guest-Facing View (read-only)

The room layout appears in the **Room Detail Modal** (`room-detail-modal.tsx`) in a new panel at the bottom:

- Renders the same canvas in read-only mode (no drag, no tools)
- Beds are clickable — clicking highlights the bed name in the bed list and may show price in the future
- **Occupied beds** are greyed out with an "Occupied by: [Guest Name]" overlay
  - Derived from `booking_bed_assignments` joined with `bookings` (for date range) and `persons` (for name)
  - Only shows occupancy for the relevant retreat/date range being viewed
- **Available beds** are interactive — guests can click to select during booking

---

## Integration Points

### Saving
- Auto-save on change (debounced) via `PATCH /api/admin/rooms/[id]/layout`
- Upserts the `room_layouts` row for the room
- Only admins (access_level >= 5) can write

### Bed List Sync
- Adding a bed in Panel 2 → creates `beds` row → bed appears in palette ready to drag
- Deleting a bed from Panel 2 → removes from `beds` table → removed from canvas if placed
- Renaming a bed in Panel 2 → updates `beds.label` → canvas label updates live

### Booking Integration
- When a guest selects a bed in the guest-facing view → creates `booking_bed_assignments` row
- If bed capacity = 2 and already has one occupant for overlapping dates → status = `pending_approval`
- Booking itself is not blocked — bed assignment is a separate concern

---

## Tech Stack for Canvas

Use **HTML5 Canvas** (via a React wrapper) rather than SVG or DOM elements:
- Better performance for drag/drop with many objects
- Smooth animations (split king slide)
- Grid rendering is trivial with canvas

Consider using a lightweight canvas library if it simplifies hit testing and drag logic. Evaluate:
- **Konva.js** (React-Konva) — mature, good for this exact use case
- Raw Canvas 2D — if we want zero dependencies

---

## Scope Boundaries

**In scope (this feature):**
- Room shape drawing (rectangles + curved walls)
- Bed placement from palette with rotation
- Split King pairing/unpairing
- Text labels
- Save/load layout JSON to DB
- Read-only guest view in room detail modal with occupied/available state

**Out of scope (future):**
- Accommodation rules / condition modals during bed selection
- Bed configuration overrides per retreat (using `bed_configurations`)
- Room availability calendar integration
- Multi-floor / building-level view
- Undo/redo (nice-to-have, can add later)
