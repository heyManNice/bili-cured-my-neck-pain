// 生成 Tampermonkey 单 JS 文件
import manifest from '../config/manifest.json' assert { type: 'json' };
import * as fs from 'fs';
import * as path from 'path';


export function build() {
    const version = manifest.version;
    const script = fs.readFileSync(path.resolve(__dirname, '../dist/main.js'), 'utf-8');
    const style = fs.readFileSync(path.resolve(__dirname, '../dist/main.css'), 'utf-8');

    const result = `// ==UserScript==
// @name         B站治好了我的颈椎病
// @namespace    https://github.com/heyManNice/bili-cured-my-neck-pain
// @version      ${version}
// @description  给B站PC网页版添加视频旋转功能，喜欢的话点点小星星哟~
// @author       https://github.com/heyManNice
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/list/watchlater/*
// @icon         https://heymannice.github.io/bili-cured-my-neck-pain/assets/bcmnp-logo.png
// @grant        GM_addStyle
// ==/UserScript==
GM_addStyle(\`${style}\`);
${script}`;
    fs.writeFileSync(path.resolve(__dirname, `../release/bcmnp_v${version}.tampermonkey.user.js`), result, 'utf-8');
    console.log('build for tampermonkey complete.');
}

if (module === require.main) {
    build();
}
