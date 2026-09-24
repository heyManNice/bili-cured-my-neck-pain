import type { VideoControlState } from './control-state.ts';
import {
    calculateVideoGeometry,
    viewCenterToTranslation,
    type Point,
    type VideoGeometry,
} from './video-geometry.ts';

export interface RenderedTransform {
    readonly radians: number;
    readonly scale: number;
    readonly translation: Point;
}

export class PlayerDom {
    private content: HTMLElement | null = null;
    private viewport: HTMLElement | null = null;
    private video: HTMLVideoElement | null = null;
    private cachedGeometry: VideoGeometry | null = null;
    private cachedAngle = NaN;
    private cachedScalePercent = NaN;

    getContent(): HTMLElement | null {
        if (!this.content?.isConnected) {
            this.content = document.querySelector<HTMLElement>('.bpx-player-video-wrap');
            this.viewport = null;
            this.video = null;
            this.invalidateGeometry();
        }
        return this.content;
    }

    getViewport(): HTMLElement | null {
        if (!this.viewport?.isConnected) {
            this.viewport = document.querySelector<HTMLElement>('.bpx-player-video-area')
                ?? this.getContent()?.parentElement
                ?? null;
            this.invalidateGeometry();
        }
        return this.viewport;
    }

    getVideo(): HTMLVideoElement | null {
        const content = this.getContent();
        if (!this.video?.isConnected || !content?.contains(this.video)) {
            const video = content?.querySelector<HTMLVideoElement>('video') ?? null;
            if (video !== this.video) this.invalidateGeometry();
            this.video = video;
        }
        return this.video;
    }

    invalidateGeometry() {
        this.cachedGeometry = null;
    }

    getGeometry(state: VideoControlState): VideoGeometry | null {
        const content = this.getContent();
        const viewport = this.getViewport();
        const video = this.getVideo();
        if (!content || !viewport) return null;
        if (this.cachedGeometry && this.cachedAngle === state.angle
            && this.cachedScalePercent === state.scalePercent) return this.cachedGeometry;

        const contentWidth = content.clientWidth;
        const contentHeight = content.clientHeight;
        const viewportWidth = viewport.clientWidth;
        const viewportHeight = viewport.clientHeight;
        if (!contentWidth || !contentHeight || !viewportWidth || !viewportHeight) return null;

        this.cachedGeometry = calculateVideoGeometry({
            contentWidth,
            contentHeight,
            viewportWidth,
            viewportHeight,
            angle: state.angle,
            userScale: state.scalePercent / 100,
            videoWidth: video?.videoWidth || contentWidth,
            videoHeight: video?.videoHeight || contentHeight,
        });
        this.cachedAngle = state.angle;
        this.cachedScalePercent = state.scalePercent;
        return this.cachedGeometry;
    }

    applyTranslation(state: VideoControlState, geometry: VideoGeometry) {
        const content = this.getContent();
        if (!content) return;
        const translation = viewCenterToTranslation(state.viewCenter, geometry);
        content.style.translate = `${translation.x}px ${translation.y}px`;
    }

    applyTransform(state: VideoControlState, geometry: VideoGeometry, animate: boolean): Animation | null {
        const content = this.getContent();
        if (!content) return null;

        const oldRotate = content.style.rotate || '0deg';
        const oldScale = content.style.scale || '1';
        const oldTranslate = content.style.translate || '0px 0px';
        let angle = state.angle;
        const nearestCardinal = Math.round(angle / 90) * 90;
        // Keep the existing workaround for black frames at cardinal rotations.
        if (nearestCardinal !== 0 && nearestCardinal !== 360
            && Math.abs(angle - nearestCardinal) < 0.01) angle += 0.0001;
        const newRotate = `${angle}deg`;
        const newScale = `${geometry.scale}`;

        this.applyTranslation(state, geometry);
        const newTranslate = content.style.translate;
        content.style.rotate = newRotate;
        content.style.scale = newScale;

        if (!animate) return null;
        let optimizedOldRotate = oldRotate;
        if (parseInt(oldRotate) === 0 && parseInt(newRotate) === 270) {
            optimizedOldRotate = '360deg';
        } else if (parseInt(oldRotate) === 270 && parseInt(newRotate) === 0) {
            optimizedOldRotate = '-90deg';
        }

        return content.animate([
            { rotate: optimizedOldRotate, scale: oldScale, translate: oldTranslate },
            { rotate: newRotate, scale: newScale, translate: newTranslate },
        ], {
            duration: 300,
            easing: 'ease-in-out',
        });
    }

    getRenderedTransform(state: VideoControlState, geometry: VideoGeometry): RenderedTransform {
        const content = this.getContent();
        const targetTranslation = viewCenterToTranslation(state.viewCenter, geometry);
        if (!content) {
            return { radians: geometry.radians, scale: geometry.scale, translation: targetTranslation };
        }

        const style = getComputedStyle(content);
        const angle = parseFloat(style.rotate);
        const scale = parseFloat(style.scale);
        const [x, y] = style.translate.split(/\s+/).map(parseFloat);
        return {
            radians: Number.isFinite(angle) ? angle * Math.PI / 180 : geometry.radians,
            scale: Number.isFinite(scale) ? scale : geometry.scale,
            translation: {
                x: Number.isFinite(x) ? x : targetTranslation.x,
                y: Number.isFinite(y) ? y : targetTranslation.y,
            },
        };
    }
}
