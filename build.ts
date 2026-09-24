import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import * as dir from './tools/dir.ts';

import manifest from './config/manifest.json' with { type: 'json' };
import { minify } from 'html-minifier-terser';

const distDir = path.resolve(__dirname, 'dist');
const metaDir = path.resolve(__dirname, 'config');


const htmlMinifyPlugin = {
    name: 'html-minify',
    setup(build: esbuild.PluginBuild) {
        build.onLoad({ filter: /\.html$/ }, async (args) => {
            const source = await fs.promises.readFile(args.path, 'utf8');
            const minified = await minify(source, {
                collapseWhitespace: true,
                removeComments: true,
            });
            return {
                contents: minified,
                loader: 'text',
            };
        });
    },
};

async function main() {
    dir.mkdir(distDir);
    dir.cpdir(metaDir, distDir);

    await Promise.all([
        esbuild.build({
            entryPoints: ['src/main.ts'],
            outfile: 'dist/main.js',
            bundle: true,
            minify: true,
            sourcemap: false,
            target: ['es2020'],
            plugins: [htmlMinifyPlugin],
            define: {
                __VERSION__: JSON.stringify(manifest.version),
            }
        }),
        esbuild.build({
            entryPoints: ['src/styles/main.css'],
            outfile: 'dist/main.css',
            minify: true,
            loader: { '.css': 'css' }
        }),
    ]);
}

if (module === require.main) {
    main().then(() => {
        console.log('build complete.');
    });
}
