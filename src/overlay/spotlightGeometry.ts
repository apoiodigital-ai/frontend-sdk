import type { ElementBounds } from './types';

export interface OverlayArea {
  width: number;
  height: number;
}

export interface DismissArea {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export type TooltipPlacement = 'above' | 'below';

export const CUTOUT_PADDING = 10;
const TOOLTIP_GAP = 16;
const TOOLTIP_ESTIMATED_HEIGHT = 140;
const TOOLTIP_MIN_TOP = 24;
const TOOLTIP_CENTER_OFFSET = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeCutout(
  bounds: ElementBounds | null
): ElementBounds | null {
  if (!bounds) return null;
  return {
    x: Math.max(bounds.x - CUTOUT_PADDING, 0),
    y: Math.max(bounds.y - CUTOUT_PADDING, 0),
    width: bounds.width + CUTOUT_PADDING * 2,
    height: bounds.height + CUTOUT_PADDING * 2,
  };
}

export function computeDismissAreas(
  area: OverlayArea,
  cutout: ElementBounds | null
): DismissArea[] {
  if (!cutout) {
    return [
      { key: 'full', left: 0, top: 0, width: area.width, height: area.height },
    ];
  }

  const left = clamp(cutout.x, 0, area.width);
  const top = clamp(cutout.y, 0, area.height);
  const right = clamp(cutout.x + cutout.width, 0, area.width);
  const bottom = clamp(cutout.y + cutout.height, 0, area.height);

  const areas: DismissArea[] = [
    { key: 'top', left: 0, top: 0, width: area.width, height: top },
    {
      key: 'bottom',
      left: 0,
      top: bottom,
      width: area.width,
      height: area.height - bottom,
    },
    { key: 'left', left: 0, top, width: left, height: bottom - top },
    {
      key: 'right',
      left: right,
      top,
      width: area.width - right,
      height: bottom - top,
    },
  ];
  return areas.filter(
    (dismissArea) => dismissArea.width > 0 && dismissArea.height > 0
  );
}

export function computeTooltipPlacement(
  area: OverlayArea,
  cutout: ElementBounds | null
): { placement: TooltipPlacement; top: number } {
  if (!cutout) {
    return { placement: 'below', top: area.height / 2 - TOOLTIP_CENTER_OFFSET };
  }
  if (cutout.y > area.height / 2) {
    return {
      placement: 'above',
      top: Math.max(cutout.y - TOOLTIP_ESTIMATED_HEIGHT, TOOLTIP_MIN_TOP),
    };
  }
  return { placement: 'below', top: cutout.y + cutout.height + TOOLTIP_GAP };
}
