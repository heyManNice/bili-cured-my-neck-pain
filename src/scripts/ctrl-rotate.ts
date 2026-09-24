import {
    log,
    animateGroup
} from '../utils.ts';

import {
    rotateToggleKeyframes
} from './animates.ts';

import {
    calculateVideoGeometry,
    screenPointToContent,
    viewCenterToTranslation,
    type Point,
    type VideoGeometry,
} from './video-geometry.ts';

type PresetType = 'scale' | 'rotate';

class RotateController {
    private toggle: HTMLElement;
    private panel: HTMLElement;
    private rotateItems: HTMLElement;
    private scaleItems: HTMLElement;
    private scaleSlider: HTMLInputElement;
    private scaleInput: HTMLInputElement;
    private minimap: HTMLElement;
    private minimapCanvas: HTMLCanvasElement;
    private resetTranslateButton: HTMLButtonElement;
    private rotateSlider: HTMLInputElement;
    private rotateInput: HTMLInputElement;
    private presetMenu: HTMLElement;
    private presetActions: HTMLElement;
    private presetForm: HTMLFormElement;
    private presetInput: HTMLInputElement;
    private presetUnit: HTMLElement;
    private presetDefaults = new Map<HTMLButtonElement, number>();
    private presetTarget: { type: PresetType; button: HTMLButtonElement; index: number } | null = null;

    // 当前播放器中心对应的视频自身坐标，旋转、缩放和位置移动共用这一份状态。
    private viewCenter: Point = { x: 0, y: 0 };
    private activePointerId: number | null = null;
    private dragStartPointer: Point = { x: 0, y: 0 };
    private dragStartCenter: Point = { x: 0, y: 0 };
    private resizeObserver: ResizeObserver | null = null;
    private thumbnailTimer: number | null = null;
    private previewAnimationFrame: number | null = null;

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
        const resetTranslateButton = panel.querySelector<HTMLButtonElement>('.bcmnp-reset-translate');
        const presetMenu = panel.querySelector<HTMLElement>('.bcmnp-preset-menu');
        const presetActions = panel.querySelector<HTMLElement>('.bcmnp-preset-actions');
        const presetForm = panel.querySelector<HTMLFormElement>('.bcmnp-preset-form');
        const presetInput = presetForm?.querySelector<HTMLInputElement>('input');
        const presetUnit = presetForm?.querySelector<HTMLElement>('.bcmnp-preset-unit');
        if (!minimap || !minimapCanvas || !resetTranslateButton || !presetMenu
            || !presetActions || !presetForm || !presetInput || !presetUnit) {
            throw new Error('旋转面板元素未找到');
        }

        this.toggle = toggle;
        this.panel = panel;
        this.rotateItems = rotateItems;
        this.scaleItems = scaleItems;
        this.scaleSlider = scaleSlider;
        this.scaleInput = scaleInput;
        this.minimap = minimap;
        this.minimapCanvas = minimapCanvas;
        this.resetTranslateButton = resetTranslateButton;
        this.rotateSlider = rotateSlider;
        this.rotateInput = rotateInput;
        this.presetMenu = presetMenu;
        this.presetActions = presetActions;
        this.presetForm = presetForm;
        this.presetInput = presetInput;
        this.presetUnit = presetUnit;

        this.restorePresets();

        this.toggle.addEventListener('mouseenter', this.toggleOnMouseEnter.bind(this));
        this.toggle.addEventListener('mouseleave', this.toggleOnMouseLeave.bind(this));
        this.panel.addEventListener('mouseenter', this.panelOnMouseEnter.bind(this));
        this.panel.addEventListener('mouseleave', this.panelOnMouseLeave.bind(this));
        this.rotateItems.addEventListener('click', this.rotateItemOnClick.bind(this));
        this.scaleItems.addEventListener('click', this.scaleItemOnClick.bind(this));
        this.rotateItems.addEventListener('contextmenu', event => this.openPresetMenu(event, 'rotate'));
        this.scaleItems.addEventListener('contextmenu', event => this.openPresetMenu(event, 'scale'));
        presetMenu.querySelector('.bcmnp-preset-edit')?.addEventListener('click', () => this.editPreset());
        presetMenu.querySelector('.bcmnp-preset-reset')?.addEventListener('click', () => this.resetPreset());
        presetMenu.querySelector('.bcmnp-preset-cancel')?.addEventListener('click', () => this.closePresetMenu());
        presetForm.addEventListener('submit', event => this.savePreset(event));
        document.addEventListener('pointerdown', event => {
            if (!this.presetMenu.contains(event.target as Node)) this.closePresetMenu();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') this.closePresetMenu();
        });
        this.scaleSlider.addEventListener('input', this.sliderOnInput.bind(this));
        this.scaleInput.addEventListener('change', this.inputOnChange.bind(this));
        this.rotateSlider.addEventListener('input', this.rotateSliderOnInput.bind(this));
        this.rotateInput.addEventListener('change', this.rotateInputOnChange.bind(this));
        this.scaleSlider.closest('.bcmnp-slider-row')?.addEventListener(
            'wheel',
            this.scaleRowOnWheel.bind(this),
            { passive: false },
        );
        this.rotateSlider.closest('.bcmnp-slider-row')?.addEventListener(
            'wheel',
            this.rotateRowOnWheel.bind(this),
            { passive: false },
        );
        this.resetTranslateButton.addEventListener('click', this.resetTranslation.bind(this));

        this.minimap.addEventListener('pointerdown', this.minimapOnPointerDown.bind(this));
        this.minimap.addEventListener('pointermove', this.minimapOnPointerMove.bind(this));
        this.minimap.addEventListener('pointerup', this.minimapOnPointerUp.bind(this));
        this.minimap.addEventListener('pointercancel', this.minimapOnPointerUp.bind(this));

        document.addEventListener('loadedmetadata', event => {
            if (!(event.target instanceof HTMLVideoElement)
                || !event.target.matches('.bpx-player-video-wrap video')) return;
            const geometry = this.getGeometry();
            if (!geometry) return;
            this.applyScaleAndRotation(geometry, false);
            this.updateMinimap();
        }, true);

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
        this.closePresetMenu();
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

    private presetStorageKey(type: PresetType, index: number) {
        return `bcmnp:quick-${type}:${index}`;
    }

    private isValidPreset(type: PresetType, value: number) {
        return Number.isInteger(value)
            && value >= (type === 'scale' ? 10 : 0)
            && value <= (type === 'scale' ? 1000 : 360);
    }

    private setPresetValue(type: PresetType, button: HTMLButtonElement, value: number) {
        if (type === 'scale') {
            button.dataset.scale = String(value / 100);
            button.textContent = `${value}%`;
            this.syncScaleUI(parseInt(this.scaleSlider.value, 10));
        } else {
            button.dataset.angle = String(value);
            button.textContent = `${value}°`;
            this.syncRotateUI(this.getCurrentAngle());
        }
    }

    private restorePresets() {
        for (const type of ['scale', 'rotate'] as const) {
            const group = type === 'scale' ? this.scaleItems : this.rotateItems;
            group.querySelectorAll<HTMLButtonElement>('.bcmnp-btn-item').forEach((button, index) => {
                const defaultValue = type === 'scale'
                    ? Math.round(Number(button.dataset.scale) * 100)
                    : Number(button.dataset.angle);
                this.presetDefaults.set(button, defaultValue);
                try {
                    const saved = localStorage.getItem(this.presetStorageKey(type, index));
                    if (saved === null) return;
                    const value = Number(saved);
                    if (this.isValidPreset(type, value)) this.setPresetValue(type, button, value);
                } catch {
                    // Presets remain usable when page storage is unavailable.
                }
            });
        }
    }

    private openPresetMenu(event: MouseEvent, type: PresetType) {
        const button = event.target instanceof Element
            ? event.target.closest<HTMLButtonElement>('.bcmnp-btn-item')
            : null;
        const group = type === 'scale' ? this.scaleItems : this.rotateItems;
        if (!button || !group.contains(button)) return;
        event.preventDefault();
        event.stopPropagation();

        const index = Array.from(group.querySelectorAll('.bcmnp-btn-item')).indexOf(button);
        this.presetTarget = { type, button, index };
        this.presetActions.hidden = false;
        this.presetForm.hidden = true;
        this.presetMenu.hidden = false;
        const rect = this.panel.getBoundingClientRect();
        this.presetMenu.style.left = `${Math.max(0, Math.min(event.clientX - rect.left, rect.width - this.presetMenu.offsetWidth))}px`;
        this.presetMenu.style.top = `${Math.max(0, Math.min(event.clientY - rect.top, rect.height - this.presetMenu.offsetHeight))}px`;
    }

    private closePresetMenu() {
        this.presetMenu.hidden = true;
        this.presetTarget = null;
    }

    private editPreset() {
        const target = this.presetTarget;
        if (!target) return;
        const value = target.type === 'scale'
            ? Math.round(Number(target.button.dataset.scale) * 100)
            : Number(target.button.dataset.angle);
        this.presetInput.min = target.type === 'scale' ? '10' : '0';
        this.presetInput.max = target.type === 'scale' ? '1000' : '360';
        this.presetInput.value = String(value);
        this.presetUnit.textContent = target.type === 'scale' ? '%' : '°';
        this.presetActions.hidden = true;
        this.presetForm.hidden = false;
        this.presetMenu.style.top = `${Math.max(0, Math.min(this.presetMenu.offsetTop, this.panel.clientHeight - this.presetMenu.offsetHeight))}px`;
        this.presetInput.focus();
        this.presetInput.select();
    }

    private savePreset(event: SubmitEvent) {
        event.preventDefault();
        const target = this.presetTarget;
        if (!target) return;
        const value = Number(this.presetInput.value);
        if (!this.presetInput.checkValidity() || !this.isValidPreset(target.type, value)) {
            this.presetInput.reportValidity();
            return;
        }
        this.setPresetValue(target.type, target.button, value);
        try {
            localStorage.setItem(this.presetStorageKey(target.type, target.index), String(value));
        } catch {
            // Keep the updated slot for this session if storage is unavailable.
        }
        this.closePresetMenu();
    }

    private resetPreset() {
        const target = this.presetTarget;
        if (!target) return;
        const defaultValue = this.presetDefaults.get(target.button);
        if (defaultValue === undefined) return;
        this.setPresetValue(target.type, target.button, defaultValue);
        try {
            localStorage.removeItem(this.presetStorageKey(target.type, target.index));
        } catch {
            // The default still applies for this session.
        }
        this.closePresetMenu();
    }

    private getGeometry(): VideoGeometry | null {
        const content = this.getVideoContainer();
        const viewport = this.getPlayerViewport();
        const video = content?.querySelector<HTMLVideoElement>('video');
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
            videoWidth: video?.videoWidth || content.clientWidth,
            videoHeight: video?.videoHeight || content.clientHeight,
        });
    }

    private updateMinimap() {
        this.drawMinimapFrame();
    }

    private drawMinimapFrame() {
        const video = document.querySelector<HTMLVideoElement>('.bpx-player-video-wrap video');
        const content = this.getVideoContainer();
        const geometry = this.getGeometry();
        if (!video || !content || !geometry || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            this.minimap.classList.remove('has-frame');
            return;
        }

        const context = this.minimapCanvas.getContext('2d');
        if (!context) return;
        try {
            const { width, height } = this.minimapCanvas;
            const previewScale = Math.min(
                width / geometry.viewportWidth,
                height / geometry.viewportHeight,
            );
            const renderedStyle = getComputedStyle(content);
            const renderedAngle = parseFloat(renderedStyle.rotate);
            const renderedScale = parseFloat(renderedStyle.scale);
            const scale = Number.isFinite(renderedScale) ? renderedScale : geometry.scale;
            const [renderedX, renderedY] = renderedStyle.translate.split(/\s+/).map(parseFloat);
            const targetTranslation = viewCenterToTranslation(this.viewCenter, geometry);
            const translation = {
                x: Number.isFinite(renderedX) ? renderedX : targetTranslation.x,
                y: Number.isFinite(renderedY) ? renderedY : targetTranslation.y,
            };

            context.resetTransform();
            context.fillStyle = '#111820';
            context.fillRect(0, 0, width, height);
            context.setTransform(
                previewScale, 0, 0, previewScale,
                width / 2 + translation.x * previewScale,
                height / 2 + translation.y * previewScale,
            );
            context.rotate(Number.isFinite(renderedAngle) ? renderedAngle * Math.PI / 180 : geometry.radians);
            context.scale(scale, scale);
            context.drawImage(
                video,
                -geometry.frameWidth / 2,
                -geometry.frameHeight / 2,
                geometry.frameWidth,
                geometry.frameHeight,
            );
            context.resetTransform();
            this.minimap.classList.add('has-frame');
        } catch {
            context.resetTransform();
            this.minimap.classList.remove('has-frame');
        }
    }

    private startThumbnailRefresh() {
        this.stopThumbnailRefresh();
        this.drawMinimapFrame();
        this.thumbnailTimer = window.setInterval(() => this.drawMinimapFrame(), 100);
    }

    private stopThumbnailRefresh() {
        if (this.thumbnailTimer !== null) {
            clearInterval(this.thumbnailTimer);
            this.thumbnailTimer = null;
        }
        if (this.previewAnimationFrame !== null) {
            cancelAnimationFrame(this.previewAnimationFrame);
            this.previewAnimationFrame = null;
        }
    }

    private followVideoAnimation(animation: Animation) {
        if (this.previewAnimationFrame !== null) {
            cancelAnimationFrame(this.previewAnimationFrame);
            this.previewAnimationFrame = null;
        }
        if (this.panel.style.display !== 'flex') return;

        const update = () => {
            this.previewAnimationFrame = null;
            if (this.panel.style.display !== 'flex') return;
            this.drawMinimapFrame();
            if (animation.playState === 'running') {
                this.previewAnimationFrame = requestAnimationFrame(update);
            }
        };
        this.previewAnimationFrame = requestAnimationFrame(update);
    }

    private applyViewCenter(geometry: VideoGeometry) {
        const video = this.getVideoContainer();
        if (!video) return;
        const translation = viewCenterToTranslation(this.viewCenter, geometry);
        video.style.translate = `${translation.x}px ${translation.y}px`;
    }

    private movePreviewWithPointer(e: PointerEvent) {
        const geometry = this.getGeometry();
        if (!geometry) return;
        const rect = this.minimap.getBoundingClientRect();
        const previewScale = Math.min(
            rect.width / geometry.viewportWidth,
            rect.height / geometry.viewportHeight,
        );
        const screenDelta = {
            x: (e.clientX - this.dragStartPointer.x) / previewScale,
            y: (e.clientY - this.dragStartPointer.y) / previewScale,
        };
        const contentDelta = screenPointToContent(screenDelta, { x: 0, y: 0 }, geometry);
        this.viewCenter = {
            x: this.dragStartCenter.x - contentDelta.x,
            y: this.dragStartCenter.y - contentDelta.y,
        };
        this.applyViewCenter(geometry);
        this.updateMinimap();
    }

    private minimapOnPointerDown(e: PointerEvent) {
        if (e.button !== 0 || !this.minimap.classList.contains('has-frame')) return;
        const geometry = this.getGeometry();
        if (!geometry) return;
        const rect = this.minimap.getBoundingClientRect();
        const previewScale = Math.min(
            rect.width / geometry.viewportWidth,
            rect.height / geometry.viewportHeight,
        );
        const translation = viewCenterToTranslation(this.viewCenter, geometry);
        const screenPoint = {
            x: (e.clientX - rect.left - rect.width / 2) / previewScale,
            y: (e.clientY - rect.top - rect.height / 2) / previewScale,
        };
        const contentPoint = screenPointToContent(screenPoint, translation, geometry);
        if (Math.abs(contentPoint.x) > geometry.contentWidth / 2
            || Math.abs(contentPoint.y) > geometry.contentHeight / 2) return;

        e.preventDefault();
        this.activePointerId = e.pointerId;
        this.dragStartPointer = { x: e.clientX, y: e.clientY };
        this.dragStartCenter = { ...this.viewCenter };
        this.minimap.setPointerCapture(e.pointerId);
    }

    private minimapOnPointerMove(e: PointerEvent) {
        if (e.pointerId !== this.activePointerId) return;
        e.preventDefault();
        this.movePreviewWithPointer(e);
    }

    private minimapOnPointerUp(e: PointerEvent) {
        if (e.pointerId !== this.activePointerId) return;
        if (this.minimap.hasPointerCapture(e.pointerId)) {
            this.minimap.releasePointerCapture(e.pointerId);
        }
        this.activePointerId = null;
        const panelRect = this.panel.getBoundingClientRect();
        if (e.clientX < panelRect.left || e.clientX > panelRect.right
            || e.clientY < panelRect.top || e.clientY > panelRect.bottom) {
            this.useTeimer(() => this.hidePanel());
        }
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
        if (this.activePointerId !== null) return;
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

    private scaleRowOnWheel(event: WheelEvent) {
        if (event.deltaY === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const direction = event.deltaY < 0 ? 1 : -1;
        this.syncScaleUI(parseInt(this.scaleSlider.value, 10) + direction);
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

    private rotateRowOnWheel(event: WheelEvent) {
        if (event.deltaY === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const direction = event.deltaY < 0 ? 1 : -1;
        this.syncRotateUI(this.getCurrentAngle() + direction);
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

        const animation = video.animate([
            { rotate: optimizedOldRotate, scale: oldScale, translate: oldTranslate },
            { rotate: newRotate, scale: newScale, translate: newTranslate }
        ], {
            duration: 300,
            easing: 'ease-in-out',
        });
        this.followVideoAnimation(animation);
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
