// Equipment: which batch each vessel holds, how much room is left in it, and how racking moves a
// batch from one vessel to another.

import type { Batch, BatchEvent, Equipment, VolumeUnit } from '../db/types.ts';
import { VESSEL_TYPES } from '../db/types.ts';
import { fmtVolume } from './format.ts';

/** A batch that still sits in a vessel: not bottled, archived or deleted. */
export function inVessel(batch: Batch): boolean {
  return !batch.deletedAt && batch.status !== 'bottled' && batch.status !== 'archived';
}

/** The batches a vessel holds now. Normally one; more means one wasn't moved out. */
export function batchesIn(vesselId: string, all: Batch[]): Batch[] {
  return all.filter((b) => b.vesselId === vesselId && inVessel(b));
}

/** The batch's vessel, if it has one that still exists. */
export function vesselOf(batch: Batch, all: Equipment[]): Equipment | null {
  return (batch.vesselId && all.find((e) => e.id === batch.vesselId && e.kind === 'vessel' && !e.deletedAt)) || null;
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

/** Room left in the vessel, or null without both a capacity and a batch volume. */
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
 * A warning about putting this batch in this vessel, or null when it's fine: the batch is bigger
 * than the vessel, or the vessel already holds another batch.
 */
export function vesselWarning(vessel: Equipment, batch: Pick<Batch, 'id' | 'volumeL'>, all: Batch[], unit: VolumeUnit): string | null {
  const others = batchesIn(vessel.id, all).filter((b) => b.id !== batch.id);
  if (others.length) return `${vessel.name} already holds ${others.map((b) => b.name).join(', ')}.`;
  const room = headspace(vessel.capacityL, batch.volumeL);
  if (room && room.liters < -0.005) return `${vessel.name} holds ${fmtVolume(vessel.capacityL, unit)}, less than this batch's ${fmtVolume(batch.volumeL, unit)}.`;
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
 * The batch's vessel after a racking entry is removed. Removing the racking that put the batch in
 * its current vessel puts it back where that racking took it from; any other racking changes nothing.
 */
export function vesselAfterRemovingRack(entry: BatchEvent, batch: Batch, timeline: BatchEvent[]): string | null | undefined {
  if (entry.type !== 'rack' || entry.vesselId == null || batch.vesselId !== entry.vesselId) return batch.vesselId;
  const later = timeline.some((e) => e.id !== entry.id && !e.deletedAt && e.type === 'rack' && e.vesselId != null && e.date > entry.date);
  return later ? batch.vesselId : (entry.fromVesselId ?? null);
}

/** Whether this racking entry is the one that put the batch in its vessel: the latest racking into a vessel. */
export function isLatestRack(entry: BatchEvent, timeline: BatchEvent[]): boolean {
  return entry.type === 'rack' && !timeline.some((e) => e.id !== entry.id && !e.deletedAt && e.type === 'rack' && e.vesselId != null && e.date > entry.date);
}
