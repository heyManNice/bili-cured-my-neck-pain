import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

import manifest from '../config/manifest.json' with { type: 'json' };
import {
    classifyRelease,
    compareVersions,
    extractReleaseNotes,
    getReleaseTitle,
    parseStableTag,
} from './release-info.ts';

const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.resolve(rootDir, 'release');
const currentTag = process.argv[2];

if (!currentTag) {
    throw new Error('Usage: bun tools/prepare-release.ts <vMAJOR.MINOR.PATCH> [github-output-file]');
}

const currentVersion = parseStableTag(currentTag);
const versionString = `${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}`;
if (manifest.version !== versionString) {
    throw new Error(`Tag ${currentTag} does not match manifest version ${manifest.version}`);
}

const tags = execFileSync(
    'git',
    ['tag', '--merged', 'HEAD'],
    { cwd: rootDir, encoding: 'utf8' },
).split(/\r?\n/).filter(Boolean);

const previousTags = tags
    .filter(tag => tag !== currentTag && /^v\d+\.\d+\.\d+$/.test(tag))
    .map(tag => ({ tag, version: parseStableTag(tag) }))
    .filter(item => compareVersions(item.version, currentVersion) < 0)
    .sort((left, right) => compareVersions(right.version, left.version));

const previous = previousTags[0];
const releaseType = classifyRelease(currentVersion, previous?.version);
const changelog = fs.readFileSync(path.resolve(rootDir, 'CHANGELOG.md'), 'utf8');
const releaseNotes = extractReleaseNotes(changelog, versionString);
const releaseTitle = getReleaseTitle(currentTag, releaseType);

fs.mkdirSync(releaseDir, { recursive: true });
fs.writeFileSync(path.resolve(releaseDir, 'release-notes.md'), releaseNotes, 'utf8');

const result = {
    tag: currentTag,
    version: versionString,
    previous_tag: previous?.tag ?? '',
    release_type: releaseType,
    release_title: releaseTitle,
};

const githubOutput = process.argv[3];
if (githubOutput) {
    fs.appendFileSync(
        githubOutput,
        Object.entries(result).map(([key, value]) => `${key}=${value}`).join('\n') + '\n',
        'utf8',
    );
}

console.log(JSON.stringify(result, null, 2));
