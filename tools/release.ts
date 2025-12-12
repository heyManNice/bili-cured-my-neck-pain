import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import AdmZip from "adm-zip";

const log = console.log;
const error = (msg: string) => {
    console.error(msg);
    process.exit(1);
}

function system(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                reject(stderr);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

class Version {
    private manifestPath = path.resolve(__dirname, '../config/manifest.json');

    public getVersion() {
        const manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
        const version = manifest.version;
        if (!version) error('Version not found in manifest.json');
        const [major, minor, patch] = version.split('.').map(Number);
        return { major, minor, patch };
    }

    public setVersion(newVersion: { major: number; minor: number; patch: number }) {
        const manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
        manifest.version = `${newVersion.major}.${newVersion.minor}.${newVersion.patch}`;
        fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 4), 'utf-8');
        log(`Version updated to ${manifest.version}`);
    }
}
const version = new Version();

class Git {
    public async commitAndPush(newVersion: { major: number; minor: number; patch: number }, releaseType: string) {
        const versionStr = `${newVersion.major}.${newVersion.minor}.${newVersion.patch}`;
        await system('git checkout main');
        await system('git pull origin main');
        await system('git add .');
        await system(`git commit -m "release (${releaseType}) : v${versionStr}"`);
        await system('git push origin main');
        log(`Changes pushed to main branch with version v${versionStr}`);
    }

    public async tagAndRelease(newVersion: { major: number; minor: number; patch: number }, releaseType: string) {
        const versionStr = `v${newVersion.major}.${newVersion.minor}.${newVersion.patch}`;

        // 打标签并推送
        await system(`git tag ${versionStr}`);
        await system(`git push origin ${versionStr}`);

        // 标题后缀
        let suffix = 'Patch 🔧';
        if (releaseType === 'feature') suffix = 'New Feature! ✨';
        else if (releaseType === 'break') suffix = 'Break News! 💥';

        // 从 CHANGELOG.md 获取更新日志
        const changelogPath = path.resolve(__dirname, '../release/CHANGELOG.md');
        const changelog = fs.readFileSync(changelogPath, 'utf-8');
        const releaseNotes = `## [${versionStr}] ${suffix} (${new Date().toLocaleString()})\n${changelog || '修复了已知问题'}`;

        // 写到临时文件
        const tmpFile = path.resolve(__dirname, `../release/.changelog_${versionStr}.md`);
        fs.writeFileSync(tmpFile, releaseNotes, 'utf-8');

        // 用 gh 发布 release 并附带 zip 包
        const zipPath = path.resolve(__dirname, `../release/bcmnp_${versionStr}.zip`);

        // 油猴版本文件
        const tmPath = path.resolve(__dirname, `../release/bcmnp_${versionStr}.tampermonkey.user.js`);

        await system(`gh release create ${versionStr} -F ${tmpFile} ${zipPath} ${tmPath}`);

        log(`Release ${versionStr} created with notes from CHANGELOG.md`);
    }
}
const git = new Git();

class Builder {
    public async runBuild() {
        log(await system('npm run build'));
        log(await system('npm run build:tm'));
        const zip = new AdmZip();
        zip.addLocalFolder(path.resolve(__dirname, '../dist'));
        const v = version.getVersion();
        const zipPath = path.resolve(__dirname, `../release/bcmnp_v${v.major}.${v.minor}.${v.patch}.zip`);
        zip.writeZip(zipPath);
        return zipPath;
    }
}
const build = new Builder();

async function main() {
    const releaseType = process.argv[2];
    if (!['break', 'feature', 'patch'].includes(releaseType)) {
        error(`Invalid release type. Use one of: break, feature, patch.`);
    }
    log(`Starting release process for type: ${releaseType}`);

    let { major, minor, patch } = version.getVersion();

    if (releaseType === 'break') {
        major += 1;
        minor = 0;
        patch = 0;
    } else if (releaseType === 'feature') {
        minor += 1;
        patch = 0;
    } else {
        patch += 1;
    }

    const newVersion = {
        major,
        minor,
        patch
    };

    version.setVersion(newVersion);

    await build.runBuild();
    await git.commitAndPush(newVersion, releaseType);
    await git.tagAndRelease(newVersion, releaseType);
}

if (module === require.main) {
    const startTime = Date.now();
    main().then(() => {
        console.log(`Release process completed successfully. Time taken: ${Date.now() - startTime} ms`);
    });
}
