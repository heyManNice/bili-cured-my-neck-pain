

// 触发按钮的组合式动画
export const rotateToggleKeyframes: {
    [selector: string]: Keyframe;
}[] = [
        // 0%
        {
            '@all': {
                scale: '1',
                translate: '0px 0px',
            },
            '#bcmnp-toggle-icon-dot': {
                opacity: '1',
            },
            '#bcmnp-toggle-icon-horizontal': {
                scale: '1',
                rotate: '0deg',
                transformOrigin: '50% 60%',
                translate: '0px 0px',
            },
            '#bcmnp-toggle-icon-vertical': {
                opacity: '1',
            },
            '#bcmnp-toggle-icon-shake': {
                opacity: '1',
            }
        },
        // 25%
        {
            '@all': {
                scale: '1.2',
                translate: '-3px 0px',
            },
            '#bcmnp-toggle-icon-dot': {
                opacity: '0',
            },
            '#bcmnp-toggle-icon-horizontal': {
                scale: '1.1',
                rotate: '90deg',
                transformOrigin: '50% 60%',
                translate: '200px -50px',

            },
            '#bcmnp-toggle-icon-vertical': {
                opacity: '0',
            },
            '#bcmnp-toggle-icon-shake': {
                opacity: '0',
            }
        },
        // 75%
        {
            '@all': {
                scale: '1.2',
                translate: '-3px 0px',
            },
            '#bcmnp-toggle-icon-dot': {
                opacity: '0',
            },
            '#bcmnp-toggle-icon-horizontal': {
                scale: '1.1',
                rotate: '90deg',
                transformOrigin: '50% 60%',
                translate: '200px -50px',
            },
            '#bcmnp-toggle-icon-vertical': {
                opacity: '0',
            },
            '#bcmnp-toggle-icon-shake': {
                opacity: '0',
            }
        },
        // 100%
        {
            '@all': {
                scale: '1',
                translate: '0px 0px',
            },
            '#bcmnp-toggle-icon-dot': {
                opacity: '1',
            },
            '#bcmnp-toggle-icon-horizontal': {
                scale: '1',
                rotate: '0deg',
                transformOrigin: '50% 60%',
                translate: '0px 0px',
            },
            '#bcmnp-toggle-icon-vertical': {
                opacity: '1',
            },
            '#bcmnp-toggle-icon-shake': {
                opacity: '1',
            }
        }
    ];