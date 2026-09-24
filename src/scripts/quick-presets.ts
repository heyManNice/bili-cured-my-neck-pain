export type PresetType = 'scale' | 'rotate';

interface PresetTarget {
    readonly type: PresetType;
    readonly index: number;
}

export class QuickPresets {
    private readonly menu: HTMLElement;
    private readonly actions: HTMLElement;
    private readonly form: HTMLFormElement;
    private readonly input: HTMLInputElement;
    private readonly unit: HTMLElement;
    private readonly groups: Record<PresetType, HTMLElement>;
    private readonly buttons: Record<PresetType, HTMLButtonElement[]>;
    private readonly defaults: Record<PresetType, number[]> = { scale: [], rotate: [] };
    private readonly values: Record<PresetType, number[]> = { scale: [], rotate: [] };
    private target: PresetTarget | null = null;

    constructor(
        private readonly panel: HTMLElement,
        scaleGroup: HTMLElement,
        rotateGroup: HTMLElement,
        private readonly onSelect: (type: PresetType, value: number) => void,
        private readonly currentValue: (type: PresetType) => number,
    ) {
        const menu = panel.querySelector<HTMLElement>('.bcmnp-preset-menu');
        const actions = panel.querySelector<HTMLElement>('.bcmnp-preset-actions');
        const form = panel.querySelector<HTMLFormElement>('.bcmnp-preset-form');
        const input = form?.querySelector<HTMLInputElement>('input');
        const unit = form?.querySelector<HTMLElement>('.bcmnp-preset-unit');
        if (!menu || !actions || !form || !input || !unit) {
            throw new Error('快捷按钮菜单未找到');
        }
        this.menu = menu;
        this.actions = actions;
        this.form = form;
        this.input = input;
        this.unit = unit;
        this.groups = { scale: scaleGroup, rotate: rotateGroup };
        this.buttons = {
            scale: Array.from(scaleGroup.querySelectorAll<HTMLButtonElement>('.bcmnp-btn-item')),
            rotate: Array.from(rotateGroup.querySelectorAll<HTMLButtonElement>('.bcmnp-btn-item')),
        };

        for (const type of ['scale', 'rotate'] as const) {
            this.buttons[type].forEach((button, index) => {
                const defaultValue = type === 'scale'
                    ? Math.round(Number(button.dataset.scale) * 100)
                    : Number(button.dataset.angle);
                this.defaults[type].push(defaultValue);
                this.values[type].push(this.restore(type, index) ?? defaultValue);
                this.renderButton(type, index);
            });
            this.syncChecked(type, this.currentValue(type));
            this.groups[type].addEventListener('click', event => this.handleClick(event, type));
            this.groups[type].addEventListener('contextmenu', event => this.open(event, type));
        }

        menu.querySelector('.bcmnp-preset-edit')?.addEventListener('click', () => this.edit());
        menu.querySelector('.bcmnp-preset-reset')?.addEventListener('click', () => this.reset());
        menu.querySelector('.bcmnp-preset-cancel')?.addEventListener('click', () => this.close());
        form.addEventListener('submit', event => this.save(event));
        document.addEventListener('pointerdown', event => {
            if (!this.menu.contains(event.target as Node)) this.close();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') this.close();
        });
    }

    syncChecked(type: PresetType, current: number) {
        this.buttons[type].forEach((button, index) => {
            const value = this.values[type][index];
            button.classList.toggle('checked', type === 'scale'
                ? value === current
                : Math.abs(value - current) < 0.01);
        });
    }

    close() {
        this.menu.hidden = true;
        this.target = null;
    }

    private storageKey(type: PresetType, index: number) {
        return `bcmnp:quick-${type}:${index}`;
    }

    private valid(type: PresetType, value: number) {
        return Number.isInteger(value)
            && value >= (type === 'scale' ? 10 : 0)
            && value <= (type === 'scale' ? 1000 : 360);
    }

    private restore(type: PresetType, index: number): number | null {
        try {
            const saved = localStorage.getItem(this.storageKey(type, index));
            if (saved === null) return null;
            const value = Number(saved);
            return this.valid(type, value) ? value : null;
        } catch {
            return null;
        }
    }

    private renderButton(type: PresetType, index: number) {
        const value = this.values[type][index];
        const button = this.buttons[type][index];
        button.textContent = `${value}${type === 'scale' ? '%' : '°'}`;
        if (type === 'scale') button.dataset.scale = String(value / 100);
        else button.dataset.angle = String(value);
        this.syncChecked(type, this.currentValue(type));
    }

    private buttonIndex(event: Event, type: PresetType): number {
        const button = event.target instanceof Element
            ? event.target.closest<HTMLButtonElement>('.bcmnp-btn-item')
            : null;
        return button ? this.buttons[type].indexOf(button) : -1;
    }

    private handleClick(event: Event, type: PresetType) {
        const index = this.buttonIndex(event, type);
        if (index >= 0) this.onSelect(type, this.values[type][index]);
    }

    private open(event: MouseEvent, type: PresetType) {
        const index = this.buttonIndex(event, type);
        if (index < 0) return;
        event.preventDefault();
        event.stopPropagation();
        this.target = { type, index };
        this.actions.hidden = false;
        this.form.hidden = true;
        this.menu.hidden = false;
        const rect = this.panel.getBoundingClientRect();
        this.menu.style.left = `${Math.max(0, Math.min(event.clientX - rect.left, rect.width - this.menu.offsetWidth))}px`;
        this.menu.style.top = `${Math.max(0, Math.min(event.clientY - rect.top, rect.height - this.menu.offsetHeight))}px`;
    }

    private edit() {
        const target = this.target;
        if (!target) return;
        this.input.min = target.type === 'scale' ? '10' : '0';
        this.input.max = target.type === 'scale' ? '1000' : '360';
        this.input.value = String(this.values[target.type][target.index]);
        this.unit.textContent = target.type === 'scale' ? '%' : '°';
        this.actions.hidden = true;
        this.form.hidden = false;
        this.menu.style.top = `${Math.max(0, Math.min(this.menu.offsetTop, this.panel.clientHeight - this.menu.offsetHeight))}px`;
        this.input.focus();
        this.input.select();
    }

    private save(event: SubmitEvent) {
        event.preventDefault();
        const target = this.target;
        if (!target) return;
        const value = Number(this.input.value);
        if (!this.input.checkValidity() || !this.valid(target.type, value)) {
            this.input.reportValidity();
            return;
        }
        this.values[target.type][target.index] = value;
        this.renderButton(target.type, target.index);
        try {
            localStorage.setItem(this.storageKey(target.type, target.index), String(value));
        } catch {
            // Keep the edited slot for this session if storage is unavailable.
        }
        this.close();
    }

    private reset() {
        const target = this.target;
        if (!target) return;
        this.values[target.type][target.index] = this.defaults[target.type][target.index];
        this.renderButton(target.type, target.index);
        try {
            localStorage.removeItem(this.storageKey(target.type, target.index));
        } catch {
            // The default still applies for this session.
        }
        this.close();
    }
}
