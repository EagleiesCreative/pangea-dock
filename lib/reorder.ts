// Drag-and-drop rules for the Run-of-Show.
//  - A cue moves on its own (and may land inside another section).
//  - A section moves as a block: its header + every cue up to the next section.
//    It only lands on block boundaries, so it can never split another section.

type Row = { id: string; kind?: string };
export type DropPos = "before" | "after";
const isSec = (r: Row) => r.kind === "section";

/** [start, end] indices of what moves when dragging `id`. */
export function blockRange(rows: Row[], id: string): [number, number] {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return [-1, -1];
  if (!isSec(rows[i])) return [i, i];
  let j = i;
  while (j + 1 < rows.length && !isSec(rows[j + 1])) j++;
  return [i, j];
}

/** [start, end] of the section block that contains row i (or just the row, if it precedes the first section). */
function containingBlock(rows: Row[], i: number): [number, number] {
  let s = i;
  while (s >= 0 && !isSec(rows[s])) s--;
  if (s < 0) return [i, i];
  let e = s;
  while (e + 1 < rows.length && !isSec(rows[e + 1])) e++;
  return [s, e];
}

/**
 * Where a drop would really land: for section drags the target snaps to the start/end of the hovered block.
 * Returns null when the drop is a no-op (onto itself / inside its own block).
 */
export function resolveDrop(rows: Row[], dragId: string, overId: string, pos: DropPos): { id: string; pos: DropPos } | null {
  const [a, b] = blockRange(rows, dragId);
  const o = rows.findIndex((r) => r.id === overId);
  if (a < 0 || o < 0 || (o >= a && o <= b)) return null;
  if (!isSec(rows[a])) return { id: overId, pos };
  const [s, e] = containingBlock(rows, o);
  return pos === "before" ? { id: rows[s].id, pos: "before" } : { id: rows[e].id, pos: "after" };
}

/** New order after dropping `dragId` before/after `overId` (rules above). Returns the same array if nothing changes. */
export function reorder<T extends Row>(rows: T[], dragId: string, overId: string, pos: DropPos): T[] {
  const target = resolveDrop(rows, dragId, overId, pos);
  if (!target) return rows;
  const [a, b] = blockRange(rows, dragId);
  const moving = rows.slice(a, b + 1);
  const rest = [...rows.slice(0, a), ...rows.slice(b + 1)];
  const t = rest.findIndex((r) => r.id === target.id);
  if (t < 0) return rows;
  const at = target.pos === "before" ? t : t + 1;
  const next = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
  return next.every((r, k) => r === rows[k]) ? rows : next;
}

/** Move a section block one block up/down (used by the ↑/↓ buttons on section rows). */
export function moveBlock<T extends Row>(rows: T[], id: string, dir: -1 | 1): T[] {
  const [a, b] = blockRange(rows, id);
  if (a < 0) return rows;
  if (dir < 0) return a === 0 ? rows : reorder(rows, id, rows[a - 1].id, "before");
  return b === rows.length - 1 ? rows : reorder(rows, id, rows[b + 1].id, "after");
}
