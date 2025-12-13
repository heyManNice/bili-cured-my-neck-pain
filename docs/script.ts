// 模拟视频旋转效果
const video = document.getElementById('video-rotate-demo');

function rotateVideo(angle: number) {
    if (!video) return;

    const W = 16;
    const H = 9;
    const rad = angle * Math.PI / 180;

    const scaleX = W / (W * Math.abs(Math.cos(rad)) + H * Math.abs(Math.sin(rad)));
    const scaleY = H / (W * Math.abs(Math.sin(rad)) + H * Math.abs(Math.cos(rad)));

    const scale = Math.min(scaleX, scaleY);

    const oldRotate = video.style.rotate || '0deg';
    const oldScale = video.style.scale || '1';

    const newRotate = `${angle}deg`;
    const newScale = `${scale}`;

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

let globalAngle = 0;
setInterval(() => {
    globalAngle = (globalAngle + 90) % 360;
    rotateVideo(globalAngle);
}, 2000);
