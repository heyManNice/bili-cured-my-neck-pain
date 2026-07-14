import {
    log,
    animateGroup
} from '../utils.ts';

import {
    rotateToggleKeyframes
} from './animates.ts';

class RotateController {
    private toggle: HTMLElement;
    private panel: HTMLElement;
    private rotateItems: HTMLElement;
    private scaleItems: HTMLElement;
    private scaleSlider: HTMLInputElement;
    private scaleInput: HTMLInputElement;
    private minimap: HTMLElement;
    private viewport: HTMLElement;
    private rotateSlider: HTMLInputElement;
    private rotateInput: HTMLInputElement;
    private translateX = 0;
    private translateY = 0;

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
        const viewport = panel.querySelector<HTMLElement>('.bcmnp-minimap-viewport');
        if (!minimap || !viewport) {
            throw new Error('缩略图未找到');
        }

        // 赋值
        this.toggle = toggle;
        this.panel = panel;
        this.rotateItems = rotateItems;
        this.scaleItems = scaleItems;
        this.scaleSlider = scaleSlider;
        this.scaleInput = scaleInput;
        this.minimap = minimap;
        this.viewport = viewport;
        this.rotateSlider = rotateSlider;
        this.rotateInput = rotateInput;

        // 监听事件
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

        this.minimap.addEventListener('mousedown', this.onViewportMouseDown.bind(this));
        this.viewport.addEventListener('mousedown', this.onViewportMouseDown.bind(this));
    }

    // 共用定时器
    private useTeimer(callback: () => void, delay = 300) {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = window.setTimeout(() => {
            callback();
        }, delay);
    }

    // 显示面板
    private showPanel() {
        if (this.panel.style.display === 'flex') {
            return;
        }
        this.panel.style.display = 'flex';
        this.updatePanelPosition();
        this.updateMinimap();
    }

    // 隐藏面板
    private hidePanel() {
        if (this.panel.style.display === 'none') {
            return;
        }
        this.panel.style.display = 'none';
    }

    // 获取视频容器
    private getVideoContainer(): HTMLElement | null {
        return document.querySelector<HTMLElement>('.bpx-player-video-wrap');
    }

    // 获取当前旋转角度（统一入口）
    private getCurrentAngle(): number {
        const value = parseFloat(this.rotateSlider.value);
        return isNaN(value) ? 0 : value;
    }

    // 计算复合缩放（用户缩放 × 旋转自适应补偿）
    private getCompositeScale(): number {
        const userScale = parseInt(this.scaleSlider.value, 10) / 100;
        const angle = this.getCurrentAngle();
        const rad = angle * Math.PI / 180;
        const W = 16;
        const H = 9;
        const scaleX = W / (W * Math.abs(Math.cos(rad)) + H * Math.abs(Math.sin(rad)));
        const scaleY = H / (W * Math.abs(Math.sin(rad)) + H * Math.abs(Math.cos(rad)));
        return Math.min(scaleX, scaleY) * userScale;
    }

    // 更新缩略图视口框
    private updateMinimap() {
        const compositeScale = this.getCompositeScale();

        const MW = 160;
        const MH = 90;

        if (compositeScale <= 1) {
            this.viewport.style.width = `${MW}px`;
            this.viewport.style.height = `${MH}px`;
            this.viewport.style.left = '0px';
            this.viewport.style.top = '0px';
            return;
        }

        // 视口大小（固定 minimap 比例 16:9）
        const vw = MW / compositeScale;
        const vh = MH / compositeScale;
        this.viewport.style.width = `${vw}px`;
        this.viewport.style.height = `${vh}px`;

        // 视口位置（translate 映射到 minimap 坐标）
        const container = this.getVideoContainer();
        if (!container) return;
        const cw = container.clientWidth;
        const ch = container.clientHeight;

        const offsetX = -this.translateX / (compositeScale * cw) * MW;
        const offsetY = -this.translateY / (compositeScale * ch) * MH;

        const left = (MW - vw) / 2 + offsetX;
        const top = (MH - vh) / 2 + offsetY;

        this.viewport.style.left = `${left}px`;
        this.viewport.style.top = `${top}px`;
    }

    // 设置视频 translate
    private applyTranslate() {
        const video = this.getVideoContainer();
        if (!video) return;
        video.style.translate = `${this.translateX}px ${this.translateY}px`;
    }

    // 缩略图/视口框 mousedown
    private onViewportMouseDown(e: MouseEvent) {
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        const startTX = this.translateX;
        const startTY = this.translateY;

        const onMove = (ev: MouseEvent) => this.onViewportMouseMove(ev, startX, startY, startTX, startTY);
        const onUp = (ev: MouseEvent) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            this.onViewportMouseUp();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    // 拖动中
    private onViewportMouseMove(
        e: MouseEvent,
        startX: number,
        startY: number,
        startTX: number,
        startTY: number
    ) {
        const compositeScale = this.getCompositeScale();
        if (compositeScale <= 1) return;

        const container = this.getVideoContainer();
        if (!container) return;
        const cw = container.clientWidth;
        const ch = container.clientHeight;

        // minimap 轴对齐，鼠标位移直接映射到 translate 变化
        const MW = 160;
        const factor = compositeScale * cw / MW;
        const mappedDX = -(e.clientX - startX) * factor;
        const mappedDY = -(e.clientY - startY) * factor;

        let newTX = startTX + mappedDX;
        let newTY = startTY + mappedDY;

        // clamp 范围（基于复合缩放）
        const maxTX = cw * (compositeScale - 1) / 2;
        const maxTY = ch * (compositeScale - 1) / 2;
        newTX = Math.max(-maxTX, Math.min(maxTX, newTX));
        newTY = Math.max(-maxTY, Math.min(maxTY, newTY));

        this.translateX = newTX;
        this.translateY = newTY;
        this.applyTranslate();
        this.updateMinimap();
    }

    // 拖动结束
    private onViewportMouseUp() {}

    // 鼠标移入触发器
    private toggleOnMouseEnter(event: Event) {
        // 触发动画
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
        this.useTeimer(() => {
            this.showPanel();
        });
    }

    // 鼠标移出触发器
    private toggleOnMouseLeave(event: Event) {
        this.useTeimer(() => {
            this.hidePanel();
        });
    }

    // 鼠标移入面板
    private panelOnMouseEnter(event: Event) {
        if (this.timer) {
            clearTimeout(this.timer);
        }
    }

    // 鼠标移出面板
    private panelOnMouseLeave(event: Event) {
        this.useTeimer(() => {
            this.hidePanel();
        });
    }

    // 更新面板位置
    private updatePanelPosition() {
        const toggleRect = this.toggle.getBoundingClientRect();
        const panelRect = this.panel.getBoundingClientRect();

        const screenType = document.querySelector<HTMLElement>('.bpx-player-container')?.dataset.screen ?? 'normal';

        if (screenType === 'full' || screenType === 'web') {
            this.panel.style.bottom = `74px`;
        } else {
            this.panel.style.bottom = `41px`;
        }
        this.panel.style.right = `${(toggleRect.width - panelRect.width) / 2}px`;
    }

    // 同步滑条、输入框和快捷按钮的状态
    private syncScaleUI(value: number) {
        const strValue = String(value);
        this.scaleSlider.value = strValue;
        this.scaleInput.value = strValue;

        // 更新快捷按钮选中状态
        const buttons = this.scaleItems.querySelectorAll<HTMLElement>('.bcmnp-btn-item');
        for (const btn of buttons) {
            const btnScale = parseFloat(btn.dataset.scale || '') * 100;
            if (btnScale === value) {
                btn.classList.add('checked');
            } else {
                btn.classList.remove('checked');
            }
        }
    }

    // 滑条拖动
    private sliderOnInput(event: Event) {
        const value = parseInt(this.scaleSlider.value, 10);
        this.syncScaleUI(value);
        this.rotateAndScaleVideo();
    }

    // 输入框变更
    private inputOnChange(event: Event) {
        let value = parseInt(this.scaleInput.value, 10);
        if (isNaN(value)) {
            value = 100;
        }
        value = Math.max(10, value);
        this.syncScaleUI(value);
        this.rotateAndScaleVideo();
    }

    // 同步旋转滑条、输入框和快捷按钮的状态
    private syncRotateUI(value: number) {
        const strValue = String(value);
        this.rotateSlider.value = strValue;
        this.rotateInput.value = strValue;

        const buttons = this.rotateItems.querySelectorAll<HTMLElement>('.bcmnp-btn-item');
        for (const btn of buttons) {
            const btnAngle = parseFloat(btn.dataset.angle || '0');
            // 允许浮点微调（0.0001°）仍匹配预设按钮
            if (Math.abs(btnAngle - value) < 0.01) {
                btn.classList.add('checked');
            } else {
                btn.classList.remove('checked');
            }
        }
    }

    // 旋转滑条拖动
    private rotateSliderOnInput(event: Event) {
        const value = parseFloat(this.rotateSlider.value);
        if (isNaN(value)) return;
        this.syncRotateUI(value);
        this.rotateAndScaleVideo();
    }

    // 旋转输入框变更
    private rotateInputOnChange(event: Event) {
        let value = parseFloat(this.rotateInput.value);
        if (isNaN(value)) {
            value = 0;
        }
        // 边界检查：clamp 到 0–360
        value = Math.max(0, Math.min(360, value));
        this.syncRotateUI(value);
        this.rotateAndScaleVideo();
    }

    // 鼠标点击旋转选项
    private rotateItemOnClick(event: Event) {
        const target = event.target as HTMLElement;
        if (!target.classList.contains('bcmnp-btn-item')) {
            return;
        }

        const angle = parseFloat(target.dataset.angle || '0');
        this.syncRotateUI(angle);

        this.rotateAndScaleVideo();
    }

    // 鼠标点击缩放选项
    private scaleItemOnClick(event: Event) {
        const target = event.target as HTMLElement;
        if (!target.classList.contains('bcmnp-btn-item')) {
            return;
        }
        // 更新选中状态
        const checked = this.scaleItems.querySelector<HTMLElement>('.bcmnp-scale-items .bcmnp-btn-item.checked');
        if (checked) {
            checked.classList.remove('checked');
        }
        target.classList.add('checked');

        // 同步滑条和输入框
        const btnScale = parseFloat(target.dataset.scale || '1') * 100;
        this.syncScaleUI(btnScale);

        this.rotateAndScaleVideo();
    }

    // 旋转视频
    private rotateAndScaleVideo() {
        const video = document.querySelector<HTMLVideoElement>('.bpx-player-video-wrap');
        if (!video) {
            log('视频元素未找到，无法旋转');
            return;
        }

        let angle = this.getCurrentAngle();
        const compositeScale = this.getCompositeScale();

        // 可以修复全屏的时候旋转失效和在视频增强模式下旋转黑屏的问题，不知道为什么
        // 可能与浏览器底层的视频播放优化算法有关，需要进一步研究
        // 仅在角度非常接近 90/180/270 时加微小偏移，避免影响任意角度
        const nearestCardinal = Math.round(angle / 90) * 90;
        if (nearestCardinal !== 0 && nearestCardinal !== 360
            && Math.abs(angle - nearestCardinal) < 0.01) {
            angle += 0.0001;
        }

        const oldRotate = video.style.rotate || '0deg';
        const oldScale = video.style.scale || '1';

        const newRotate = `${angle}deg`;
        const newScale = `${compositeScale}`;

        video.style.rotate = newRotate;
        video.style.scale = newScale;

        // 优化动画效果的老旋转角度
        let optimizedOldRotate = oldRotate;
        if (parseInt(oldRotate) === 0 && parseInt(newRotate) === 270) {
            optimizedOldRotate = '360deg';
        } else if (parseInt(oldRotate) === 270 && parseInt(newRotate) === 0) {
            optimizedOldRotate = '-90deg';
        }

        video.animate([
            {
                rotate: optimizedOldRotate,
                scale: oldScale
            },
            {
                rotate: newRotate,
                scale: newScale
            }
        ], {
            duration: 300,
            easing: 'ease-in-out',
        });

        // 缩放改变后重置平移并刷新缩略图
        this.translateX = 0;
        this.translateY = 0;
        this.applyTranslate();
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