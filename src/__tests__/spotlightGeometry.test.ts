import { describe, expect, it } from '@jest/globals';
import {
  CUTOUT_PADDING,
  computeCutout,
  computeDismissAreas,
  computeTooltipPlacement,
} from '../overlay/spotlightGeometry';

const area = { width: 400, height: 800 };

function containsPoint(
  rect: { left: number; top: number; width: number; height: number },
  x: number,
  y: number
): boolean {
  return (
    x >= rect.left &&
    x < rect.left + rect.width &&
    y >= rect.top &&
    y < rect.top + rect.height
  );
}

describe('computeCutout', () => {
  it('pads the element bounds', () => {
    expect(computeCutout({ x: 50, y: 100, width: 120, height: 40 })).toEqual({
      x: 50 - CUTOUT_PADDING,
      y: 100 - CUTOUT_PADDING,
      width: 120 + CUTOUT_PADDING * 2,
      height: 40 + CUTOUT_PADDING * 2,
    });
  });

  it('returns null without bounds', () => {
    expect(computeCutout(null)).toBeNull();
  });
});

describe('computeDismissAreas', () => {
  it('covers the whole overlay when there is no cutout', () => {
    expect(computeDismissAreas(area, null)).toEqual([
      { key: 'full', left: 0, top: 0, width: 400, height: 800 },
    ]);
  });

  it('never covers the cutout, so the tap reaches the highlighted element', () => {
    const cutout = { x: 40, y: 300, width: 200, height: 60 };
    const dismissAreas = computeDismissAreas(area, cutout);

    const insideCutout = [
      [41, 301],
      [140, 330],
      [239, 359],
    ];
    for (const [x, y] of insideCutout) {
      expect(dismissAreas.some((rect) => containsPoint(rect, x!, y!))).toBe(
        false
      );
    }

    const outsideCutout = [
      [10, 10],
      [10, 330],
      [300, 330],
      [140, 700],
    ];
    for (const [x, y] of outsideCutout) {
      expect(dismissAreas.some((rect) => containsPoint(rect, x!, y!))).toBe(
        true
      );
    }
  });

  it('drops empty areas when the cutout touches the overlay edges', () => {
    const cutout = { x: 0, y: 0, width: 400, height: 100 };
    const keys = computeDismissAreas(area, cutout).map((rect) => rect.key);
    expect(keys).toEqual(['bottom']);
  });
});

describe('computeTooltipPlacement', () => {
  it('places the tooltip below a cutout in the upper half', () => {
    const cutout = { x: 40, y: 100, width: 200, height: 60 };
    expect(computeTooltipPlacement(area, cutout)).toEqual({
      placement: 'below',
      top: 176,
    });
  });

  it('places the tooltip above a cutout in the lower half', () => {
    const cutout = { x: 40, y: 600, width: 200, height: 60 };
    expect(computeTooltipPlacement(area, cutout)).toEqual({
      placement: 'above',
      top: 460,
    });
  });
});
