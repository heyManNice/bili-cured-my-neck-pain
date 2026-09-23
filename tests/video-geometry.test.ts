import { describe, expect, test } from 'bun:test';
import {
    calculateVideoGeometry,
    getVisiblePolygon,
    viewCenterToTranslation,
} from '../src/scripts/video-geometry.ts';

const base = {
    contentWidth: 1600,
    contentHeight: 900,
    viewportWidth: 1600,
    viewportHeight: 900,
    userScale: 1,
};

describe('video geometry', () => {
    test('uses a 1x cover scale at 0 degrees', () => {
        const geometry = calculateVideoGeometry({ ...base, angle: 0 });
        expect(geometry.coverScale).toBeCloseTo(1);
    });

    test('uses the exact cover scale at 90 degrees', () => {
        const geometry = calculateVideoGeometry({ ...base, angle: 90 });
        expect(geometry.coverScale).toBeCloseTo(16 / 9);
    });

    test('maps a video-space center to a rotated screen translation', () => {
        const geometry = calculateVideoGeometry({ ...base, angle: 90 });
        const translation = viewCenterToTranslation({ x: 100, y: 0 }, geometry);
        expect(translation.x).toBeCloseTo(0);
        expect(translation.y).toBeCloseTo(-100 * geometry.scale);
    });

    test('supports an unrestricted view center outside the video', () => {
        for (const angle of [0, 45, 90, 135, 180, 270]) {
            const geometry = calculateVideoGeometry({ ...base, angle, userScale: 2.4 });
            const polygon = getVisiblePolygon(geometry, { x: 5000, y: -5000 });
            expect(polygon.some(point => Math.abs(point.x) > base.contentWidth / 2)).toBe(true);
            expect(polygon.some(point => Math.abs(point.y) > base.contentHeight / 2)).toBe(true);
        }
    });
});
