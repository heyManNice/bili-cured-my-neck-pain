import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

import manifest from './config/manifest.json' with { type: 'json' }

function htmlVersionReplacer() {
    return {
        name: 'html-version-replacer',
        transformIndexHtml(html) {
            return html.replaceAll(`{{VERSION}}`, manifest.version);
        }
    }
}

export default defineConfig({
    root: 'docs',
    build: {
        outDir: '../docs-dist',
    },
    plugins: [
        tailwindcss(),
        htmlVersionReplacer()
    ],
    server: {
        port: 8080,
    }

})
