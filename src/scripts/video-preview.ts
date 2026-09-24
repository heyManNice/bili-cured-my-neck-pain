import type { VideoControlState } from './control-state.ts';
import { PlayerDom } from './player-dom.ts';
import type { Point, VideoGeometry } from './video-geometry.ts';

export class VideoPreview {
    private timer: number | null = null;
    private pendingFrame: number | null = null;
    private animationFrame: number | null = null;
    private open = false;
    private context: CanvasRenderingContext2D | null;

    constructor(
        private readonly element: HTMLElement,
        private readonly canvas: HTMLCanvasElement,
        private readonly player: PlayerDom,
        private readonly getState: () => VideoControlState,
    ) {
        this.context = canvas.getContext('2d');
    }

    get hasFrame() {
        return this.element.classList.contains('has-frame');
    }

    start() {
        this.stop();
        this.open = true;
        this.draw();
        this.timer = window.setInterval(() => {
            if (this.animationFrame === null) this.requestDraw();
        }, 100);
    }

    stop() {
        this.open = false;
        if (this.timer !== null) clearInterval(this.timer);
        if (this.pendingFrame !== null) cancelAnimationFrame(this.pendingFrame);
        if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
        this.timer = null;
        this.pendingFrame = null;
        this.animationFrame = null;
    }

    requestDraw() {
        if (!this.open || this.pendingFrame !== null || this.animationFrame !== null) return;
        this.pendingFrame = requestAnimationFrame(() => {
            this.pendingFrame = null;
            this.draw();
        });
    }

    followAnimation(animation: Animation) {
        if (!this.open) return;
        if (this.pendingFrame !== null) cancelAnimationFrame(this.pendingFrame);
        if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
        this.pendingFrame = null;
        const update = () => {
            this.animationFrame = null;
            if (!this.open) return;
            this.draw();
            if (animation.playState === 'running') {
                this.animationFrame = requestAnimationFrame(update);
            }
        };
        this.animationFrame = requestAnimationFrame(update);
    }

    screenDelta(delta: Point, geometry: VideoGeometry): Point {
        const rect = this.element.getBoundingClientRect();
        const scale = Math.min(rect.width / geometry.viewportWidth, rect.height / geometry.viewportHeight);
        return { x: delta.x / scale, y: delta.y / scale };
    }

    screenPoint(client: Point, geometry: VideoGeometry): Point {
        const rect = this.element.getBoundingClientRect();
        const scale = Math.min(rect.width / geometry.viewportWidth, rect.height / geometry.viewportHeight);
        return {
            x: (client.x - rect.left - rect.width / 2) / scale,
            y: (client.y - rect.top - rect.height / 2) / scale,
        };
    }

    private draw() {
        const state = this.getState();
        const video = this.player.getVideo();
        const geometry = this.player.getGeometry(state);
        if (!video || !geometry || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            this.element.classList.remove('has-frame');
            return;
        }
        const context = this.context;
        if (!context) return;

        try {
            const { width, height } = this.canvas;
            const previewScale = Math.min(width / geometry.viewportWidth, height / geometry.viewportHeight);
            const rendered = this.player.getRenderedTransform(state, geometry);
            context.resetTransform();
            context.fillStyle = '#111820';
            context.fillRect(0, 0, width, height);
            context.setTransform(
                previewScale, 0, 0, previewScale,
                width / 2 + rendered.translation.x * previewScale,
                height / 2 + rendered.translation.y * previewScale,
            );
            context.rotate(rendered.radians);
            context.scale(rendered.scale, rendered.scale);
            context.drawImage(
                video,
                -geometry.frameWidth / 2,
                -geometry.frameHeight / 2,
                geometry.frameWidth,
                geometry.frameHeight,
            );
            context.resetTransform();
            this.element.classList.add('has-frame');
        } catch {
            context.resetTransform();
            this.element.classList.remove('has-frame');
        }
    }
}
