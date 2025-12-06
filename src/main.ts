/// <reference path="./global.d.ts" />

import rotateHtml from './htmls/ctrl-rotate.html';
import rotateScript from './scripts/ctrl-rotate.ts';
import {
    waitUntilElementReady,
    insertHtmlBeforeElement,
    printVersion
} from './utils.ts';


async function main() {
    const pipBtn = await waitUntilElementReady('.bpx-player-ctrl-btn.bpx-player-ctrl-pip');
    const beginTime = performance.now();

    insertHtmlBeforeElement(pipBtn, rotateHtml);
    rotateScript.onLoad();

    const cost = (performance.now() - beginTime).toFixed(1);

    printVersion(__VERSION__, cost);
}

main();