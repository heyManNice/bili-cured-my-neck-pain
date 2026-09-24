import type { Point } from './video-geometry.ts';

// Controls are the source of truth; DOM values are only inputs and projections.
export interface VideoControlState {
    readonly angle: number;
    readonly scalePercent: number;
    readonly viewCenter: Readonly<Point>;
}

export const initialControlState: VideoControlState = {
    angle: 0,
    scalePercent: 100,
    viewCenter: { x: 0, y: 0 },
};
