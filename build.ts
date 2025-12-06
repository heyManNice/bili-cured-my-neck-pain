import * as esbuild from 'esbuild';
import * as path from 'path';
import * as dir from './tools/dir.ts';

const distDir = path.resolve(__dirname, 'dist');
const metaDir = path.resolve(__dirname, 'config');

async function main() {
    dir.mkdir(distDir);
    dir.cpdir(metaDir, distDir);

    // main.ts
    esbuild.build({
        entryPoints: ['src/main.ts'],
        outfile: 'dist/main.js',
        bundle: true,
        minify: true,
        sourcemap: false,
        target: ['es2020']
    }).catch(() => process.exit(1));

    // main.css
    esbuild.build({
        entryPoints: ['src/main.css'],
        outfile: 'dist/main.css',
        minify: true,
        loader: { '.css': 'css' }
    }).catch(() => process.exit(1));
}

if (module === require.main) {
    main().then(() => {
        console.log('build complete.');
    });
}