import * as fs from 'fs';
import * as path from 'path';

const log = console.log;
const error = (msg: string) => {
    console.error(msg);
    process.exit(1);
}

class Version {
    private manifestPath = path.resolve(__dirname, '../config/manifest.json');

    public getVersion(): {
        major: number;
        minor: number;
        patch: number;
    } {
        const manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
        const version = manifest.version;
        if (!version) {
            error('Version not found in manifest.json');
        }
        const [major, minor, patch] = version.split('.').map(Number);
        return { major, minor, patch };
    }
    public setVersion(major: number, minor: number, patch: number): void {
        const manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
        manifest.version = `${major}.${minor}.${patch}`;
        fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 4), 'utf-8');
        log(`Version updated to ${manifest.version}`);
    }
}


async function main() {
    // 获取发布类型
    const releaseType = process.argv[2];
    if (!['break', 'feature', 'fix'].includes(releaseType)) {
        error(`Invalid release type. Use one of: break, feature, fix.`);
    }
    log(`Starting release process for type: ${releaseType}`);

    // 更新版本号
    const version = new Version();
    const { major, minor, patch } = version.getVersion();

    version.setVersion(
        releaseType === 'break' ? major + 1 : major,
        releaseType === 'feature' ? minor + 1 : minor,
        releaseType === 'fix' ? patch + 1 : patch
    );


}

if (module === require.main) {
    const startTime = Date.now();
    main().then(() => {
        console.log(`Release process completed successfully. Time taken: ${Date.now() - startTime} ms`);
    })
}