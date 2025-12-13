import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

import manifest from './config/manifest.json' with { type: 'json' };
import path from 'path';
import fs, { mkdir } from 'fs';
import { build } from './tools/build-for-tm.ts';


// 编译出油猴版本的单文件js
function buildForTampermonkey() {
    return {
        name: 'build-for-tampermonkey',
        closeBundle() {
            build();
            const filename = `bcmnp_v${manifest.version}.tampermonkey.user.js`;
            const filepath = path.resolve(__dirname, 'release', filename);
            fs.mkdirSync(path.resolve(__dirname, 'docs-dist/tampermonkey'), { recursive: true });
            const destpath = path.resolve(__dirname, 'docs-dist/tampermonkey', filename);
            fs.copyFileSync(filepath, destpath);
            console.log('copy to docs-dist complete.');
        }
    }
}

// 替换html中的版本宏
function htmlVersionReplacer() {
    return {
        name: 'html-version-replacer',
        transformIndexHtml(html: string) {
            return html.replaceAll(`{{VERSION}}`, manifest.version);
        }
    }
}

const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
    root: 'docs',
    build: {
        outDir: '../docs-dist',
    },
    plugins: [
        tailwindcss(),
        htmlVersionReplacer(),
        !isDev && buildForTampermonkey(),
    ],
    server: {
        port: 8080,
    }

})
