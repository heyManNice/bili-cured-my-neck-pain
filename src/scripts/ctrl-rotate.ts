import { animateGroup, log } from '../utils.ts';
import { rotateToggleKeyframes } from './animates.ts';
import { initialControlState, type VideoControlState } from './control-state.ts';
import { PlayerDom } from './player-dom.ts';
import { QuickPresets } from './quick-presets.ts';
import { VideoPreview } from './video-preview.ts';
import { screenPointToContent, viewCenterToTranslation, type Point } from './video-geometry.ts';

function parseValueWithUnit(value: string, unit: '%' | '°'): number | null {
    const pattern = unit === '%'
        ? /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*[%％]?\s*$/
        : /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*°?\s*$/;
    const match = pattern.exec(value);
    return match ? Number(match[1]) : null;
}

class RotateController {
    private readonly toggle: HTMLElement;
    private readonly panel: HTMLElement;
    private readonly scaleSlider: HTMLInputElement;
    private readonly scaleInput: HTMLInputElement;
    private readonly rotateSlider: HTMLInputElement;
    private readonly rotateInput: HTMLInputElement;
    private readonly minimap: HTMLElement;
    private readonly player = new PlayerDom();
    private readonly preview: VideoPreview;
    private readonly presets: QuickPresets;

    private state: VideoControlState = initialControlState;
    private activePointerId: number | null = null;
    private dragStartPointer: Point = { x: 0, y: 0 };
    private dragStartCenter: Point = { x: 0, y: 0 };
    private resizeObserver: ResizeObserver | null = null;
    private timer: number | null = null;
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
        const minimap = panel?.querySelector<HTMLElement>('.bcmnp-minimap');
        const minimapCanvas = panel?.querySelector<HTMLCanvasElement>('.bcmnp-minimap-canvas');
        const resetTranslateButton = panel?.querySelector<HTMLButtonElement>('.bcmnp-reset-translate');
        if (!toggle || !panel || !rotateItems || !scaleItems || !scaleSlider || !scaleInput
            || !rotateSlider || !rotateInput || !minimap || !minimapCanvas || !resetTranslateButton) {
            throw new Error('旋转按钮或面板未找到');
        }

        this.toggle = toggle;
        this.panel = panel;
        this.scaleSlider = scaleSlider;
        this.scaleInput = scaleInput;
        this.rotateSlider = rotateSlider;
        this.rotateInput = rotateInput;
        this.minimap = minimap;
        this.preview = new VideoPreview(minimap, minimapCanvas, this.player, () => this.state);
        this.presets = new QuickPresets(
            panel,
            scaleItems,
            rotateItems,
            (type, value) => type === 'scale' ? this.setScale(value) : this.setAngle(value),
            type => type === 'scale' ? this.state.scalePercent : this.state.angle,
        );

        toggle.addEventListener('mouseenter', this.toggleOnMouseEnter.bind(this));
        toggle.addEventListener('mouseleave', this.toggleOnMouseLeave.bind(this));
        panel.addEventListener('mouseenter', this.panelOnMouseEnter.bind(this));
        panel.addEventListener('mouseleave', this.panelOnMouseLeave.bind(this));
        scaleSlider.addEventListener('input', () => this.setScale(parseInt(scaleSlider.value, 10)));
        scaleInput.addEventListener('change', () => {
            const value = parseValueWithUnit(scaleInput.value, '%');
            if (value === null) scaleInput.value = `${this.state.scalePercent}%`;
            else this.setScale(Math.trunc(value));
        });
        rotateSlider.addEventListener('input', () => this.setAngle(parseFloat(rotateSlider.value)));
        rotateInput.addEventListener('change', () => {
            const value = parseValueWithUnit(rotateInput.value, '°');
            if (value === null) rotateInput.value = `${this.state.angle}°`;
            else this.setAngle(value);
        });
        scaleSlider.closest<HTMLElement>('.bcmnp-slider-row')?.addEventListener('wheel', event => {
            this.changeByWheel(event, 'scale');
        }, { passive: false });
        rotateSlider.closest<HTMLElement>('.bcmnp-slider-row')?.addEventListener('wheel', event => {
            this.changeByWheel(event, 'rotate');
        }, { passive: false });
        resetTranslateButton.addEventListener('click', () => this.resetTranslation());
        minimap.addEventListener('pointerdown', this.minimapOnPointerDown.bind(this));
        minimap.addEventListener('pointermove', this.minimapOnPointerMove.bind(this));
        minimap.addEventListener('pointerup', this.minimapOnPointerUp.bind(this));
        minimap.addEventListener('pointercancel', this.minimapOnPointerUp.bind(this));

        document.addEventListener('loadedmetadata', event => {
            if (!(event.target instanceof HTMLVideoElement)
                || !event.target.matches('.bpx-player-video-wrap video')) return;
            this.player.invalidateGeometry();
            this.observePlayerSize();
            this.applyState(false);
        }, true);
        this.observePlayerSize();
    }

    private setScale(value: number) {
        const requestedPercent = Math.max(10, Math.min(1000, value));
        this.scaleSlider.value = String(requestedPercent);
        const scalePercent = parseInt(this.scaleSlider.value, 10);
        this.state = { ...this.state, scalePercent };
        this.scaleInput.value = `${scalePercent}%`;
        this.presets.syncChecked('scale', scalePercent);
        this.applyState(true);
    }

    private setAngle(value: number) {
        const requestedAngle = Math.max(0, Math.min(360, value));
        this.rotateSlider.value = String(requestedAngle);
        const angle = parseFloat(this.rotateSlider.value);
        this.state = { ...this.state, angle };
        this.rotateInput.value = `${angle}°`;
        this.presets.syncChecked('rotate', angle);
        this.applyState(true);
    }

    private changeByWheel(event: WheelEvent, type: 'scale' | 'rotate') {
        if (event.deltaY === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const direction = event.deltaY < 0 ? 1 : -1;
        if (type === 'scale') this.setScale(this.state.scalePercent + direction);
        else this.setAngle(this.state.angle + direction);
    }

    private applyState(animate: boolean) {
        const geometry = this.player.getGeometry(this.state);
        if (!geometry) {
            if (animate) log('视频元素未找到，无法旋转');
            return;
        }
        const animation = this.player.applyTransform(this.state, geometry, animate);
        if (animation) this.preview.followAnimation(animation);
        this.preview.requestDraw();
    }

    private resetTranslation() {
        const geometry = this.player.getGeometry(this.state);
        if (!geometry) return;
        this.state = { ...this.state, viewCenter: { x: 0, y: 0 } };
        this.player.applyTranslation(this.state, geometry);
        this.preview.requestDraw();
    }

    private movePreviewWithPointer(event: PointerEvent) {
        const geometry = this.player.getGeometry(this.state);
        if (!geometry) return;
        const screenDelta = this.preview.screenDelta({
            x: event.clientX - this.dragStartPointer.x,
            y: event.clientY - this.dragStartPointer.y,
        }, geometry);
        const contentDelta = screenPointToContent(screenDelta, { x: 0, y: 0 }, geometry);
        this.state = {
            ...this.state,
            viewCenter: {
                x: this.dragStartCenter.x - contentDelta.x,
                y: this.dragStartCenter.y - contentDelta.y,
            },
        };
        this.player.applyTranslation(this.state, geometry);
        this.preview.requestDraw();
    }

    private minimapOnPointerDown(event: PointerEvent) {
        if (event.button !== 0 || !this.preview.hasFrame) return;
        const geometry = this.player.getGeometry(this.state);
        if (!geometry) return;
        const translation = viewCenterToTranslation(this.state.viewCenter, geometry);
        const screenPoint = this.preview.screenPoint({ x: event.clientX, y: event.clientY }, geometry);
        const contentPoint = screenPointToContent(screenPoint, translation, geometry);
        if (Math.abs(contentPoint.x) > geometry.contentWidth / 2
            || Math.abs(contentPoint.y) > geometry.contentHeight / 2) return;

        event.preventDefault();
        this.activePointerId = event.pointerId;
        this.dragStartPointer = { x: event.clientX, y: event.clientY };
        this.dragStartCenter = { ...this.state.viewCenter };
        this.minimap.setPointerCapture(event.pointerId);
    }

    private minimapOnPointerMove(event: PointerEvent) {
        if (event.pointerId !== this.activePointerId) return;
        event.preventDefault();
        this.movePreviewWithPointer(event);
    }

    private minimapOnPointerUp(event: PointerEvent) {
        if (event.pointerId !== this.activePointerId) return;
        if (this.minimap.hasPointerCapture(event.pointerId)) {
            this.minimap.releasePointerCapture(event.pointerId);
        }
        this.activePointerId = null;
        const rect = this.panel.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right
            || event.clientY < rect.top || event.clientY > rect.bottom) {
            this.useTimer(() => this.hidePanel());
        }
    }

    private observePlayerSize() {
        if (typeof ResizeObserver === 'undefined') return;
        const content = this.player.getContent();
        const viewport = this.player.getViewport();
        if (!content || !viewport) return;
        this.resizeObserver?.disconnect();
        this.resizeObserver = new ResizeObserver(() => {
            this.player.invalidateGeometry();
            this.applyState(false);
        });
        this.resizeObserver.observe(content);
        if (viewport !== content) this.resizeObserver.observe(viewport);
    }

    private useTimer(callback: () => void, delay = 300) {
        if (this.timer) clearTimeout(this.timer);
        this.timer = window.setTimeout(callback, delay);
    }

    private showPanel() {
        if (this.panel.style.display === 'flex') return;
        this.panel.style.display = 'flex';
        this.updatePanelPosition();
        this.preview.start();
    }

    private hidePanel() {
        if (this.panel.style.display === 'none') return;
        this.panel.style.display = 'none';
        this.presets.close();
        this.preview.stop();
    }

    private toggleOnMouseEnter() {
        if (!this.isToggleAnimating) {
            this.isToggleAnimating = true;
            animateGroup(this.toggle, rotateToggleKeyframes, {
                duration: 800,
                easing: 'ease',
            });
            setTimeout(() => { this.isToggleAnimating = false; }, 1500);
        }
        this.useTimer(() => this.showPanel());
    }

    private toggleOnMouseLeave() {
        this.useTimer(() => this.hidePanel());
    }

    private panelOnMouseEnter() {
        if (this.timer) clearTimeout(this.timer);
    }

    private panelOnMouseLeave() {
        if (this.activePointerId !== null) return;
        this.useTimer(() => this.hidePanel());
    }

    private updatePanelPosition() {
        const toggleRect = this.toggle.getBoundingClientRect();
        const panelRect = this.panel.getBoundingClientRect();
        const screenType = document.querySelector<HTMLElement>('.bpx-player-container')?.dataset.screen ?? 'normal';
        this.panel.style.bottom = screenType === 'full' || screenType === 'web' ? '74px' : '41px';
        this.panel.style.right = `${(toggleRect.width - panelRect.width) / 2}px`;
    }
}

let controller: RotateController | null = null;
export default {
    onLoad: () => {
        if (!controller) controller = new RotateController();
        else log('RotateController 已存在，跳过初始化');
    },
};
