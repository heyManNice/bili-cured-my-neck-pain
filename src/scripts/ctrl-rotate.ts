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

    // 显示和隐藏面板共用的定时器
    private timer: number | null = null;

    // 触发器是否正在播放动画
    private isToggleAnimating = false;

    constructor() {
        const toggle = document.querySelector<HTMLElement>('.bpx-player-ctrl-rotate .bpx-player-ctrl-btn-icon');
        const panel = document.querySelector<HTMLElement>('.bpx-player-ctrl-rotate .bcmnp-rotate-box');
        const rotateItems = document.querySelector<HTMLElement>('.bcmnp-rotate-items');
        const scaleItems = document.querySelector<HTMLElement>('.bcmnp-scale-items');

        if (!toggle || !panel || !rotateItems || !scaleItems) {
            throw new Error('旋转按钮或面板未找到');
        }

        // 赋值
        this.toggle = toggle;
        this.panel = panel;
        this.rotateItems = rotateItems;
        this.scaleItems = scaleItems;

        // 监听事件
        this.toggle.addEventListener('mouseenter', this.toggleOnMouseEnter.bind(this));
        this.toggle.addEventListener('mouseleave', this.toggleOnMouseLeave.bind(this));

        this.panel.addEventListener('mouseenter', this.panelOnMouseEnter.bind(this));
        this.panel.addEventListener('mouseleave', this.panelOnMouseLeave.bind(this));

        this.rotateItems.addEventListener('click', this.rotateItemOnClick.bind(this));
        this.scaleItems.addEventListener('click', this.scaleItemOnClick.bind(this));
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
    }

    // 隐藏面板
    private hidePanel() {
        if (this.panel.style.display === 'none') {
            return;
        }
        this.panel.style.display = 'none';
    }

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

    // 鼠标点击旋转选项
    private rotateItemOnClick(event: Event) {
        const target = event.target as HTMLElement;
        if (!target.classList.contains('bcmnp-btn-item')) {
            return;
        }

        // 更新选中状态
        const checked = this.rotateItems.querySelector<HTMLElement>('.bcmnp-rotate-items .bcmnp-btn-item.checked');
        if (checked) {
            checked.classList.remove('checked');
        }
        target.classList.add('checked');

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

        this.rotateAndScaleVideo();
    }

    // 旋转视频
    private rotateAndScaleVideo() {
        const video = document.querySelector<HTMLVideoElement>('.bpx-player-video-wrap');
        if (!video) {
            log('视频元素未找到，无法旋转');
            return;
        }

        const angleStr = document.querySelector<HTMLElement>('.bcmnp-rotate-items .bcmnp-btn-item.checked')?.dataset.angle;
        if (!angleStr) {
            log('未找到当前旋转角度数据');
            return;
        }
        const angle = parseInt(angleStr, 10);

        const scaleStr = document.querySelector<HTMLElement>('.bcmnp-scale-items .bcmnp-btn-item.checked')?.dataset.scale;
        if (!scaleStr) {
            log('未找到当前缩放数据');
            return;
        }
        const scale = parseFloat(scaleStr);

        // 计算最佳缩放参数
        const W = 16;
        const H = 9;
        const rad = angle * Math.PI / 180;

        const scaleX = W / (W * Math.abs(Math.cos(rad)) + H * Math.abs(Math.sin(rad)));
        const scaleY = H / (W * Math.abs(Math.sin(rad)) + H * Math.abs(Math.cos(rad)));

        let scaleNew = Math.min(scaleX, scaleY) * scale;

        // 可以修复全屏的时候旋转失效的问题，不知道为什么
        if (angle === 90 || angle === 270 || angle === 180) {
            scaleNew += 0.01;
        }

        const oldRotate = video.style.rotate || '0deg';
        const oldScale = video.style.scale || '1';

        const newRotate = `${angle}deg`;
        const newScale = `${scaleNew}`;

        video.style.rotate = newRotate;
        video.style.scale = newScale;

        // 优化动画效果的老旋转角度
        let optimizedOldRotate = oldRotate;
        if (oldRotate === '0deg' && newRotate === '270deg') {
            optimizedOldRotate = '360deg';
        } else if (oldRotate === '270deg' && newRotate === '0deg') {
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