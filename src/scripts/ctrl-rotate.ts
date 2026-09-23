import {
    log,
    animateGroup
} from '../utils.ts';

import {
    rotateToggleKeyframes
} from './animates.ts';

import {
    calculateVideoGeometry,
    contentPointToMinimap,
    getVisiblePolygon,
    minimapPointToContent,
    viewCenterToTranslation,
    type Point,
    type VideoGeometry,
} from './video-geometry.ts';

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 90;

class RotateController {
    private toggle: HTMLElement;
    private panel: HTMLElement;
    private rotateItems: HTMLElement;
    private scaleItems: HTMLElement;
    private scaleSlider: HTMLInputElement;
    private scaleInput: HTMLInputElement;
    private minimap: HTMLElement;
    private minimapCanvas: HTMLCanvasElement;
    private viewport: SVGPolygonElement;
    private viewportDirection: SVGTextElement;
    private viewportControls: SVGPolygonElement;
    private resetTranslateButton: HTMLButtonElement;
    private rotateSlider: HTMLInputElement;
    private rotateInput: HTMLInputElement;

    // 当前播放器中心对应的视频自身坐标，旋转、缩放和导航共用这一份状态。
    private viewCenter: Point = { x: 0, y: 0 };
    private activePointerId: number | null = null;
    private dragOffset: Point = { x: 0, y: 0 };
    private resizeObserver: ResizeObserver | null = null;
    private thumbnailTimer: number | null = null;

    // 显示和隐藏面板共用的定时器
    private timer: number | null = null;

    // 触发器是否正在播放动画
    private isToggleAnimating = false;

    constructor() {
        const toggle = document.querySelector<HTMLElement>('.bpx-player-ctrl-rotate .bpx-player-ctrl-btn-icon');
        const panel = document.querySelector<HTMLElement>('.bpx-player-ctrl-rotate .bcmnp-rotate-box');
        const rotateItems = document.querySelector<HTMLElement>('.bcmnp-rotate-items');
        const scaleItems = document.querySelector<HTMLElement>('.bcmnp-scale-items');
        const scaleSlider = document.querySelector<HTMLInputElement>('.bcmnp-scale-slider');
        const scaleInput = document.querySelector<HTMLInputElement>('.bcmnp-scale-input');
        const rotateSlider = document.querySelector<HTMLInputElement>('.bcmnp-rotate-slider');
        const rotateInput = document.querySelector<HTMLInputElement>('.bcmnp-rotate-input');

        if (!toggle || !panel || !rotateItems || !scaleItems || !scaleSlider || !scaleInput
            || !rotateSlider || !rotateInput) {
            throw new Error('旋转按钮或面板未找到');
        }

        const minimap = panel.querySelector<HTMLElement>('.bcmnp-minimap');
        const minimapCanvas = panel.querySelector<HTMLCanvasElement>('.bcmnp-minimap-canvas');
        const viewport = panel.querySelector<SVGPolygonElement>('.bcmnp-minimap-viewport');
        const viewportDirection = panel.querySelector<SVGTextElement>('.bcmnp-minimap-direction');
        const viewportControls = panel.querySelector<SVGPolygonElement>('.bcmnp-minimap-controls');
        const resetTranslateButton = panel.querySelector<HTMLButtonElement>('.bcmnp-reset-translate');
        if (!minimap || !minimapCanvas || !viewport || !viewportDirection
            || !viewportControls || !resetTranslateButton) {
            throw new Error('缩略图未找到');
        }

        this.toggle = toggle;
        this.panel = panel;
        this.rotateItems = rotateItems;
        this.scaleItems = scaleItems;
        this.scaleSlider = scaleSlider;
        this.scaleInput = scaleInput;
        this.minimap = minimap;
        this.minimapCanvas = minimapCanvas;
        this.viewport = viewport;
        this.viewportDirection = viewportDirection;
        this.viewportControls = viewportControls;
        this.resetTranslateButton = resetTranslateButton;
        this.rotateSlider = rotateSlider;
        this.rotateInput = rotateInput;

        this.toggle.addEventListener('mouseenter', this.toggleOnMouseEnter.bind(this));
        this.toggle.addEventListener('mouseleave', this.toggleOnMouseLeave.bind(this));
        this.panel.addEventListener('mouseenter', this.panelOnMouseEnter.bind(this));
        this.panel.addEventListener('mouseleave', this.panelOnMouseLeave.bind(this));
        this.rotateItems.addEventListener('click', this.rotateItemOnClick.bind(this));
        this.scaleItems.addEventListener('click', this.scaleItemOnClick.bind(this));
        this.scaleSlider.addEventListener('input', this.sliderOnInput.bind(this));
        this.scaleInput.addEventListener('change', this.inputOnChange.bind(this));
        this.rotateSlider.addEventListener('input', this.rotateSliderOnInput.bind(this));
        this.rotateInput.addEventListener('change', this.rotateInputOnChange.bind(this));
        this.resetTranslateButton.addEventListener('click', this.resetTranslation.bind(this));

        this.minimap.addEventListener('pointerdown', this.minimapOnPointerDown.bind(this));
        this.minimap.addEventListener('pointermove', this.minimapOnPointerMove.bind(this));
        this.minimap.addEventListener('pointerup', this.minimapOnPointerUp.bind(this));
        this.minimap.addEventListener('pointercancel', this.minimapOnPointerUp.bind(this));

        this.observePlayerSize();
    }

    private useTeimer(callback: () => void, delay = 300) {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = window.setTimeout(callback, delay);
    }

    private showPanel() {
        if (this.panel.style.display === 'flex') {
            return;
        }
        this.panel.style.display = 'flex';
        this.updatePanelPosition();
        this.updateMinimap();
        this.startThumbnailRefresh();
    }

    private hidePanel() {
        if (this.panel.style.display === 'none') {
            return;
        }
        this.panel.style.display = 'none';
        this.stopThumbnailRefresh();
    }

    private getVideoContainer(): HTMLElement | null {
        return document.querySelector<HTMLElement>('.bpx-player-video-wrap');
    }

    private getPlayerViewport(): HTMLElement | null {
        return document.querySelector<HTMLElement>('.bpx-player-video-area')
            ?? this.getVideoContainer()?.parentElement
            ?? null;
    }

    private getCurrentAngle(): number {
        const value = parseFloat(this.rotateSlider.value);
        return isNaN(value) ? 0 : value;
    }

    private getUserScale(): number {
        const value = parseInt(this.scaleSlider.value, 10);
        return (isNaN(value) ? 100 : value) / 100;
    }

    private getGeometry(): VideoGeometry | null {
        const content = this.getVideoContainer();
        const viewport = this.getPlayerViewport();
        if (!content || !viewport || !content.clientWidth || !content.clientHeight
            || !viewport.clientWidth || !viewport.clientHeight) {
            return null;
        }

        return calculateVideoGeometry({
            contentWidth: content.clientWidth,
            contentHeight: content.clientHeight,
            viewportWidth: viewport.clientWidth,
            viewportHeight: viewport.clientHeight,
            angle: this.getCurrentAngle(),
            userScale: this.getUserScale(),
        });
    }

    private updateMinimap() {
        this.drawMinimapFrame();
        const geometry = this.getGeometry();
        if (!geometry) return;

        const points = getVisiblePolygon(geometry, this.viewCenter)
            .map(point => contentPointToMinimap(point, geometry, MINIMAP_WIDTH, MINIMAP_HEIGHT));
        this.viewport.setAttribute('points', this.serializePoints(points));
        this.updateViewportDirection(points);

        this.viewport.style.cursor = 'grab';
    }

    private serializePoints(points: Point[]) {
        return points.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
    }

    private interpolatePoint(start: Point, end: Point, progress: number): Point {
        return {
            x: start.x + (end.x - start.x) * progress,
            y: start.y + (end.y - start.y) * progress,
        };
    }

    private updateViewportDirection(points: Point[]) {
        const [topLeft, topRight, bottomRight, bottomLeft] = points;
        if (!topLeft || !topRight || !bottomRight || !bottomLeft) return;

        // 控制栏始终位于屏幕坐标的底边，因此旋转后仍能明确表示“下方”。
        const controlsTopLeft = this.interpolatePoint(topLeft, bottomLeft, 0.91);
        const controlsTopRight = this.interpolatePoint(topRight, bottomRight, 0.91);
        this.viewportControls.setAttribute('points', this.serializePoints([
            controlsTopLeft,
            controlsTopRight,
            bottomRight,
            bottomLeft,
        ]));

        const center = {
            x: (topLeft.x + topRight.x + bottomRight.x + bottomLeft.x) / 4,
            y: (topLeft.y + topRight.y + bottomRight.y + bottomLeft.y) / 4,
        };
        const topWidth = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
        const sideHeight = Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y);
        const fontSize = Math.max(10, Math.min(60, Math.min(topWidth, sideHeight) * 1.1));
        const rotation = Math.atan2(topRight.y - topLeft.y, topRight.x - topLeft.x) * 180 / Math.PI;

        this.viewportDirection.setAttribute('x', center.x.toFixed(2));
        this.viewportDirection.setAttribute('y', center.y.toFixed(2));
        this.viewportDirection.setAttribute('font-size', fontSize.toFixed(2));
        this.viewportDirection.setAttribute(
            'transform',
            `rotate(${rotation.toFixed(2)} ${center.x.toFixed(2)} ${center.y.toFixed(2)})`,
        );
    }

    private drawMinimapFrame() {
        const video = document.querySelector<HTMLVideoElement>('.bpx-player-video-wrap video');
        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

        const context = this.minimapCanvas.getContext('2d');
        if (!context) return;
        try {
            context.drawImage(video, 0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
            this.minimap.classList.add('has-frame');
        } catch {
            this.minimap.classList.remove('has-frame');
        }
    }

    private startThumbnailRefresh() {
        this.stopThumbnailRefresh();
        this.drawMinimapFrame();
        this.thumbnailTimer = window.setInterval(() => this.drawMinimapFrame(), 500);
    }

    private stopThumbnailRefresh() {
        if (this.thumbnailTimer !== null) {
            clearInterval(this.thumbnailTimer);
            this.thumbnailTimer = null;
        }
    }

    private applyViewCenter(geometry: VideoGeometry) {
        const video = this.getVideoContainer();
        if (!video) return;
        const translation = viewCenterToTranslation(this.viewCenter, geometry);
        video.style.translate = `${translation.x}px ${translation.y}px`;
    }

    private pointerToMinimap(e: PointerEvent): Point {
        const rect = this.minimap.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / rect.width * MINIMAP_WIDTH,
            y: (e.clientY - rect.top) / rect.height * MINIMAP_HEIGHT,
        };
    }

    private moveViewportToPointer(e: PointerEvent) {
        const geometry = this.getGeometry();
        if (!geometry) return;
        const contentPoint = minimapPointToContent(
            this.pointerToMinimap(e),
            geometry,
            MINIMAP_WIDTH,
            MINIMAP_HEIGHT,
        );
        this.viewCenter = {
            x: contentPoint.x + this.dragOffset.x,
            y: contentPoint.y + this.dragOffset.y,
        };
        this.applyViewCenter(geometry);
        this.updateMinimap();
    }

    private minimapOnPointerDown(e: PointerEvent) {
        if (e.button !== 0) return;
        const geometry = this.getGeometry();
        if (!geometry) return;

        e.preventDefault();
        this.activePointerId = e.pointerId;
        this.minimap.setPointerCapture(e.pointerId);
        const contentPoint = minimapPointToContent(
            this.pointerToMinimap(e),
            geometry,
            MINIMAP_WIDTH,
            MINIMAP_HEIGHT,
        );

        if (e.target === this.viewport) {
            this.dragOffset = {
                x: this.viewCenter.x - contentPoint.x,
                y: this.viewCenter.y - contentPoint.y,
            };
        } else {
            this.dragOffset = { x: 0, y: 0 };
            this.moveViewportToPointer(e);
        }
    }

    private minimapOnPointerMove(e: PointerEvent) {
        if (e.pointerId !== this.activePointerId) return;
        e.preventDefault();
        this.moveViewportToPointer(e);
    }

    private minimapOnPointerUp(e: PointerEvent) {
        if (e.pointerId !== this.activePointerId) return;
        if (this.minimap.hasPointerCapture(e.pointerId)) {
            this.minimap.releasePointerCapture(e.pointerId);
        }
        this.activePointerId = null;
    }

    private resetTranslation() {
        const geometry = this.getGeometry();
        if (!geometry) return;
        this.viewCenter = { x: 0, y: 0 };
        this.applyViewCenter(geometry);
        this.updateMinimap();
    }

    private observePlayerSize() {
        if (typeof ResizeObserver === 'undefined') return;
        const content = this.getVideoContainer();
        const viewport = this.getPlayerViewport();
        if (!content || !viewport) return;

        this.resizeObserver = new ResizeObserver(() => {
            const geometry = this.getGeometry();
            if (!geometry) return;
            this.applyScaleAndRotation(geometry, false);
            this.updateMinimap();
        });
        this.resizeObserver.observe(content);
        if (viewport !== content) this.resizeObserver.observe(viewport);
    }

    private toggleOnMouseEnter() {
        if (!this.isToggleAnimating) {
            this.isToggleAnimating = true;
            animateGroup(this.toggle, rotateToggleKeyframes, {
                duration: 800,
                easing: 'ease',
            });
            setTimeout(() => {
                this.isToggleAnimating = false;
            }, 1500);
        }
        this.useTeimer(() => this.showPanel());
    }

    private toggleOnMouseLeave() {
        this.useTeimer(() => this.hidePanel());
    }

    private panelOnMouseEnter() {
        if (this.timer) clearTimeout(this.timer);
    }

    private panelOnMouseLeave() {
        this.useTeimer(() => this.hidePanel());
    }

    private updatePanelPosition() {
        const toggleRect = this.toggle.getBoundingClientRect();
        const panelRect = this.panel.getBoundingClientRect();
        const screenType = document.querySelector<HTMLElement>('.bpx-player-container')?.dataset.screen ?? 'normal';

        this.panel.style.bottom = screenType === 'full' || screenType === 'web' ? '74px' : '41px';
        this.panel.style.right = `${(toggleRect.width - panelRect.width) / 2}px`;
    }

    private syncScaleUI(value: number) {
        const normalized = Math.max(10, Math.min(1000, value));
        const strValue = String(normalized);
        this.scaleSlider.value = strValue;
        this.scaleInput.value = strValue;

        const buttons = this.scaleItems.querySelectorAll<HTMLElement>('.bcmnp-btn-item');
        for (const btn of buttons) {
            const btnScale = parseFloat(btn.dataset.scale || '') * 100;
            btn.classList.toggle('checked', btnScale === normalized);
        }
    }

    private sliderOnInput() {
        this.syncScaleUI(parseInt(this.scaleSlider.value, 10));
        this.rotateAndScaleVideo();
    }

    private inputOnChange() {
        let value = parseInt(this.scaleInput.value, 10);
        if (isNaN(value)) value = 100;
        this.syncScaleUI(value);
        this.rotateAndScaleVideo();
    }

    private syncRotateUI(value: number) {
        const normalized = Math.max(0, Math.min(360, value));
        const strValue = String(normalized);
        this.rotateSlider.value = strValue;
        this.rotateInput.value = strValue;

        const buttons = this.rotateItems.querySelectorAll<HTMLElement>('.bcmnp-btn-item');
        for (const btn of buttons) {
            const btnAngle = parseFloat(btn.dataset.angle || '0');
            btn.classList.toggle('checked', Math.abs(btnAngle - normalized) < 0.01);
        }
    }

    private rotateSliderOnInput() {
        const value = parseFloat(this.rotateSlider.value);
        if (isNaN(value)) return;
        this.syncRotateUI(value);
        this.rotateAndScaleVideo();
    }

    private rotateInputOnChange() {
        let value = parseFloat(this.rotateInput.value);
        if (isNaN(value)) value = 0;
        this.syncRotateUI(value);
        this.rotateAndScaleVideo();
    }

    private rotateItemOnClick(event: Event) {
        const target = event.target as HTMLElement;
        if (!target.classList.contains('bcmnp-btn-item')) return;
        this.syncRotateUI(parseFloat(target.dataset.angle || '0'));
        this.rotateAndScaleVideo();
    }

    private scaleItemOnClick(event: Event) {
        const target = event.target as HTMLElement;
        if (!target.classList.contains('bcmnp-btn-item')) return;
        this.syncScaleUI(parseFloat(target.dataset.scale || '1') * 100);
        this.rotateAndScaleVideo();
    }

    private getAppliedAngle() {
        let angle = this.getCurrentAngle();
        const nearestCardinal = Math.round(angle / 90) * 90;
        if (nearestCardinal !== 0 && nearestCardinal !== 360
            && Math.abs(angle - nearestCardinal) < 0.01) {
            angle += 0.0001;
        }
        return angle;
    }

    private applyScaleAndRotation(geometry: VideoGeometry, animate: boolean) {
        const video = this.getVideoContainer();
        if (!video) return;

        const oldRotate = video.style.rotate || '0deg';
        const oldScale = video.style.scale || '1';
        const oldTranslate = video.style.translate || '0px 0px';
        const angle = this.getAppliedAngle();
        const newRotate = `${angle}deg`;
        const newScale = `${geometry.scale}`;

        this.applyViewCenter(geometry);
        const newTranslate = video.style.translate;
        video.style.rotate = newRotate;
        video.style.scale = newScale;

        if (!animate) return;
        let optimizedOldRotate = oldRotate;
        if (parseInt(oldRotate) === 0 && parseInt(newRotate) === 270) {
            optimizedOldRotate = '360deg';
        } else if (parseInt(oldRotate) === 270 && parseInt(newRotate) === 0) {
            optimizedOldRotate = '-90deg';
        }

        video.animate([
            { rotate: optimizedOldRotate, scale: oldScale, translate: oldTranslate },
            { rotate: newRotate, scale: newScale, translate: newTranslate }
        ], {
            duration: 300,
            easing: 'ease-in-out',
        });
    }

    private rotateAndScaleVideo() {
        const geometry = this.getGeometry();
        if (!geometry) {
            log('视频元素未找到，无法旋转');
            return;
        }
        this.applyScaleAndRotation(geometry, true);
        this.updateMinimap();
    }
}

let controller: RotateController | null = null;
export default {
    onLoad: () => {
        if (!controller) {
            controller = new RotateController();
        } else {
            log('RotateController 已存在，跳过初始化');
        }
    }
};
