import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

import manifest from '../config/manifest.json' with { type: 'json' };

const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const releaseDir = path.resolve(rootDir, 'release');

function assertFile(filePath: string) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw new Error(`Required release file not found: ${filePath}`);
    }
}

function main() {
    const expectedVersion = process.argv[2]?.replace(/^v/, '');
    if (expectedVersion && expectedVersion !== manifest.version) {
        throw new Error(
            `Release version ${expectedVersion} does not match manifest version ${manifest.version}`,
        );
    }

    assertFile(path.resolve(distDir, 'manifest.json'));
    assertFile(path.resolve(distDir, 'main.js'));
    assertFile(path.resolve(distDir, 'main.css'));

    fs.mkdirSync(releaseDir, { recursive: true });
    const userscriptPath = path.resolve(
        releaseDir,
        `bcmnp_v${manifest.version}.tampermonkey.user.js`,
    );
    assertFile(userscriptPath);

    const zipPath = path.resolve(releaseDir, `bcmnp_v${manifest.version}.zip`);
    const zip = new AdmZip();
    zip.addLocalFolder(distDir);
    zip.writeZip(zipPath);

    console.log(`Release assets ready:\n- ${zipPath}\n- ${userscriptPath}`);
}

if (import.meta.main) {
    main();
}
