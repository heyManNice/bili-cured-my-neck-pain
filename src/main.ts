/// <reference path="./global.d.ts" />

import rotateBtnHtml from './htmls/bpx-player-ctrl-rotate.html';
import rotateBtnScript from './scripts/bpx-player-ctrl-rotate.ts';
import {
    waitUntilElementReady,
    insertHtmlBeforeElement,
    log
} from './utils.ts';


async function main() {
    const pipBtn = await waitUntilElementReady('.bpx-player-ctrl-btn.bpx-player-ctrl-pip');

    const beginTime = Date.now();
    insertHtmlBeforeElement(pipBtn, rotateBtnHtml);
    rotateBtnScript.onLoad();

    log(`已加载，耗时 ${Date.now() - beginTime} ms`);
}

main();