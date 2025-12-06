/// <reference path="./global.d.ts" />

import rotateBtnHtml from './htmls/bpx-player-ctrl-rotate.html';
import {
    WaitUntilElementReady,
    InsertHtmlBeforeElement
} from './utils.ts';

async function main() {
    const pipBtn = await WaitUntilElementReady('.bpx-player-ctrl-btn.bpx-player-ctrl-pip');

    const beginTime = Date.now();
    InsertHtmlBeforeElement(pipBtn, rotateBtnHtml);

    console.log(`[B站治好了我的颈椎病] 已加载，耗时 ${Date.now() - beginTime} ms`);
}

main();