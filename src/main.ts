/// <reference path="./global.d.ts" />

import rotateHtml from './htmls/ctrl-rotate.html';
import rotateScript from './scripts/ctrl-rotate.ts';
import {
    waitUntilElementReady,
    insertHtmlAfterElement,
    printVersion
} from './utils.ts';


async function main() {
    const settingBtn = await waitUntilElementReady('.bpx-player-ctrl-btn.bpx-player-ctrl-setting');
    const beginTime = performance.now();

    const existingRotateControls = document.querySelectorAll('.bpx-player-ctrl-btn.bpx-player-ctrl-rotate');
    if (existingRotateControls.length > 1) {
        for (let i = 1; i < existingRotateControls.length; i++) {
            existingRotateControls[i].remove();
        }
    }

    if (existingRotateControls.length === 0) {
        insertHtmlAfterElement(settingBtn, rotateHtml);
    }
    rotateScript.onLoad();

    const cost = (performance.now() - beginTime).toFixed(1);

    printVersion(__VERSION__, cost);
}

main();