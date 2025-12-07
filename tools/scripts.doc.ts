declare const $0: HTMLElement;

// 保持视频窗口控件显示
setInterval(() => { document.querySelector('.bpx-player-container')?.setAttribute('data-ctrl-hidden', 'false') }, 1000);

// 当前控件按钮元素展开悬浮框
$0.classList.add('bpx-state-show');