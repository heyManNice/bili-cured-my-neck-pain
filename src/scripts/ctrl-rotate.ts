import {
    log
} from '../utils.ts';

class RotateController {
    private toggle: HTMLElement;
    private panel: HTMLElement;

    // 显示和隐藏面板共用的定时器
    private timer: number | null = null;

    // 触发器是否正在播放动画
    private isToggleAnimating = false;

    constructor() {
        const toggle = document.querySelector<HTMLElement>('.bpx-player-ctrl-rotate .bpx-player-ctrl-btn-icon');
        const panel = document.querySelector<HTMLElement>('.bpx-player-ctrl-rotate .bcmnp-rotate-box');

        if (!toggle || !panel) {
            throw new Error('旋转按钮或面板未找到');
        }

        this.toggle = toggle;
        this.panel = panel;

        this.toggle.addEventListener('mouseenter', this.toggleOnMouseEnter.bind(this));
        this.toggle.addEventListener('mouseleave', this.toggleOnMouseLeave.bind(this));

        this.panel.addEventListener('mouseenter', this.panelOnMouseEnter.bind(this));
        this.panel.addEventListener('mouseleave', this.panelOnMouseLeave.bind(this));
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
            this.toggle.animate([
                { transform: 'scale(1)' },
                { transform: 'scale(0.8)' },
                { transform: 'scale(0.8)' },
                { transform: 'scale(1)' }
            ], {
                duration: 500,
                easing: 'ease-in-out',
            });
            setTimeout(() => {
                this.isToggleAnimating = false;
            }, 1000);
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

        const isScreenFull = document.fullscreenElement != null;
        if (isScreenFull) {
            this.panel.style.bottom = `74px`;
        } else {
            this.panel.style.bottom = `41px`;
        }
        this.panel.style.right = `${(toggleRect.width - panelRect.width) / 2}px`;
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