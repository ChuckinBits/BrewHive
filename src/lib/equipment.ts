// Equipment: which batches each vessel holds, how much room is left in it, and how racking moves a
// batch from one set of vessels to another. A batch can be in several vessels at once.

import type { Batch, BatchEvent, Equipment, VesselFill, VolumeUnit } from '../db/types.ts';
import { VESSEL_TYPES } from '../db/types.ts';
import { fmtVolume } from './format.ts';

/** A batch that still sits in its vessels: not bottled, archived or deleted. */
export function inVessel(batch: Batch): boolean {
  return !batch.deletedAt && batch.status !== 'bottled' && batch.status !== 'archived';
}

const single = (id: string | null | undefined): VesselFill[] => (id ? [{ vesselId: id, volumeL: null }] : []);

/** The vessels a batch is in, reading older single-vessel data too. */
export function fillsOf(batch: Pick<Batch, 'vessels' | 'vesselId'>): VesselFill[] {
  return batch.vessels ?? single(batch.vesselId);
}

/** Where a Racked entry put the batch; undefined when it didn't track vessels. */
export function rackedInto(e: BatchEvent): VesselFill[] | undefined {
  if (e.vessels) return e.vessels;
  return e.vesselId !== undefined ? single(e.vesselId) : undefined;
}

/** Where a Racked entry took the batch from. */
export function rackedFrom(e: BatchEvent): VesselFill[] {
  return e.fromVessels ?? single(e.fromVesselId);
}

/** How much of the batch is in this part: its own amount, or the whole batch for a lone vessel. */
export function fillVolume(fill: VesselFill, batch: Pick<Batch, 'volumeL'>): number | null {
  return fill.volumeL ?? batch.volumeL;
}

export const sameFills = (a: VesselFill[], b: VesselFill[]) =>
  a.length === b.length && a.every((f, i) => f.vesselId === b[i].vesselId && Math.abs((f.volumeL ?? -1) - (b[i].volumeL ?? -1)) < 1e-6);

/** The batches a vessel holds now. Normally one; more means one wasn't moved out. */
export function batchesIn(vesselId: string, all: Batch[]): Batch[] {
  return all.filter((b) => inVessel(b) && fillsOf(b).some((f) => f.vesselId === vesselId));
}

/** The batch's vessels that still exist, with how much is in each. */
export function vesselsOf(batch: Batch, all: Equipment[]): { vessel: Equipment; volumeL: number | null }[] {
  return fillsOf(batch).flatMap((f) => {
    const vessel = all.find((e) => e.id === f.vesselId && e.kind === 'vessel' && !e.deletedAt);
    return vessel ? [{ vessel, volumeL: fillVolume(f, batch) }] : [];
  });
}

export function vesselTypeLabel(e: Pick<Equipment, 'vesselType'>): string {
  return VESSEL_TYPES.find((t) => t.id === e.vesselType)?.label ?? 'Vessel';
}

/** A name for a vessel left unnamed: "5 gal carboy", or "Carboy" without a capacity. */
export function suggestVesselName(vesselType: Equipment['vesselType'], capacityL: number | null | undefined, unit: VolumeUnit): string {
  const type = vesselTypeLabel({ vesselType });
  return capacityL ? `${fmtVolume(capacityL, unit)} ${type.toLowerCase()}` : type;
}

export interface Headspace {
  /** Liters left above the batch; negative when the batch is more than the vessel holds. */
  liters: number;
  /** Of the vessel's capacity. */
  percent: number;
}

/** Room left in the vessel, or null without both a capacity and a volume. */
export function headspace(capacityL: number | null | undefined, volumeL: number | null | undefined): Headspace | null {
  if (!capacityL || capacityL <= 0 || volumeL == null) return null;
  const liters = capacityL - volumeL;
  return { liters, percent: (liters / capacityL) * 100 };
}

/** "0.5 gal headspace (10%)", "Full", or "1 gal more than it holds". */
export function fmtHeadspace(h: Headspace, unit: VolumeUnit): string {
  // Within a spoonful counts as full: volumes are typed to a couple of decimals.
  if (Math.abs(h.liters) < 0.01) return 'Full';
  if (h.liters < 0) return `${fmtVolume(-h.liters, unit)} more than it holds`;
  return `${fmtVolume(h.liters, unit)} headspace (${Math.round(h.percent)}%)`;
}

/**
 * A warning about putting this much of a batch in this vessel, or null when it's fine: more than the
 * vessel holds, or the vessel already holds another batch.
 */
export function vesselWarning(vessel: Equipment, volumeL: number | null, batchId: string, all: Batch[], unit: VolumeUnit, partOf = false): string | null {
  const others = batchesIn(vessel.id, all).filter((b) => b.id !== batchId);
  if (others.length) return `${vessel.name} already holds ${others.map((b) => b.name).join(', ')}.`;
  const room = headspace(vessel.capacityL, volumeL);
  if (room && room.liters < -0.005) return `${vessel.name} holds ${fmtVolume(vessel.capacityL, unit)}, less than the ${fmtVolume(volumeL, unit)} ${partOf ? 'going in it' : "of this batch"}.`;
  return null;
}

/** Vessels in picking order: free ones first, then by name. */
export function vesselChoices(all: Equipment[], batches: Batch[], forBatchId?: string): { vessel: Equipment; holding: Batch[] }[] {
  return all
    .filter((e) => e.kind === 'vessel' && !e.deletedAt)
    .map((vessel) => ({ vessel, holding: batchesIn(vessel.id, batches).filter((b) => b.id !== forBatchId) }))
    .sort((a, b) => Number(a.holding.length > 0) - Number(b.holding.length > 0) || a.vessel.name.localeCompare(b.vessel.name, undefined, { numeric: true }));
}

/**
 * Amounts for a batch going into several vessels: each filled to its capacity in the order picked,
 * and whatever is left in the last. A vessel with no capacity takes the rest. Liters, or null when
 * the batch has no volume.
 */
export function fillInOrder(totalL: number | null, capacities: (number | null | undefined)[]): (number | null)[] {
  if (totalL == null) return capacities.map(() => null);
  let left = totalL;
  return capacities.map((cap, i) => {
    const last = i === capacities.length - 1;
    const amount = last || !cap ? left : Math.min(cap, left);
    left = Math.max(0, left - amount);
    return Math.round(amount * 1000) / 1000;
  });
}

/** The fills to save: one vessel keeps a null amount (the whole batch); several keep their amounts. */
export function normalizeFills(fills: VesselFill[]): VesselFill[] {
  return fills.length === 1 ? [{ vesselId: fills[0].vesselId, volumeL: null }] : fills;
}

/** The batch's volume after racking into these vessels: their total, when every amount is known and there are several. */
export function volumeAfterRack(fills: VesselFill[], batch: Pick<Batch, 'volumeL'>): number | null {
  if (fills.length < 2 || fills.some((f) => f.volumeL == null)) return batch.volumeL;
  return Math.round(fills.reduce((sum, f) => sum + (f.volumeL ?? 0), 0) * 1000) / 1000;
}

/** Whether this racking entry is the latest one that tracked vessels. */
export function isLatestRack(entry: BatchEvent, timeline: BatchEvent[]): boolean {
  return entry.type === 'rack' && !timeline.some((e) => e.id !== entry.id && !e.deletedAt && e.type === 'rack' && rackedInto(e) !== undefined && e.date > entry.date);
}

/**
 * The batch's vessels after a racking entry is removed. Removing the racking that put the batch where
 * it is puts it back where that racking took it from; any other racking changes nothing.
 */
export function fillsAfterRemovingRack(entry: BatchEvent, batch: Batch, timeline: BatchEvent[]): VesselFill[] {
  const into = rackedInto(entry);
  const now = fillsOf(batch);
  if (!into || !sameFills(into, now) || !isLatestRack(entry, timeline)) return now;
  return rackedFrom(entry);
}

/** "Jug A", "Jug A and Jug B", "Jug A, Jug B and Jug C". */
export function listNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
