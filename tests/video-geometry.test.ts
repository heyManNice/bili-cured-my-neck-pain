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
    test('uses a 1x fit scale at 0 degrees', () => {
        const geometry = calculateVideoGeometry({ ...base, angle: 0 });
        expect(geometry.fitScale).toBeCloseTo(1);
    });

    test('fits a landscape frame after a quarter turn', () => {
        const geometry = calculateVideoGeometry({ ...base, angle: 90 });
        expect(geometry.fitScale).toBeCloseTo(9 / 16);
    });

    test('enlarges a portrait frame to fit after a quarter turn', () => {
        const geometry = calculateVideoGeometry({
            ...base,
            angle: 90,
            videoWidth: 900,
            videoHeight: 1600,
        });
        expect(geometry.frameWidth).toBeCloseTo(506.25);
        expect(geometry.frameHeight).toBeCloseTo(900);
        expect(geometry.fitScale).toBeCloseTo(16 / 9);
    });

    test('keeps an arbitrary rotation inside the viewport', () => {
        const geometry = calculateVideoGeometry({ ...base, angle: 45 });
        const rotatedWidth = geometry.frameWidth * Math.abs(geometry.cos)
            + geometry.frameHeight * Math.abs(geometry.sin);
        const rotatedHeight = geometry.frameWidth * Math.abs(geometry.sin)
            + geometry.frameHeight * Math.abs(geometry.cos);
        expect(rotatedWidth * geometry.scale).toBeLessThanOrEqual(base.viewportWidth);
        expect(rotatedHeight * geometry.scale).toBeLessThanOrEqual(base.viewportHeight);
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
