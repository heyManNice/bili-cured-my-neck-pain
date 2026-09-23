export interface Version {
    major: number;
    minor: number;
    patch: number;
}

export type ReleaseType = 'initial' | 'major' | 'minor' | 'patch';

export function parseStableTag(tag: string): Version {
    const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag);
    if (!match) {
        throw new Error(`Invalid stable release tag: ${tag}`);
    }
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
    };
}

export function compareVersions(left: Version, right: Version): number {
    return left.major - right.major
        || left.minor - right.minor
        || left.patch - right.patch;
}

export function classifyRelease(current: Version, previous?: Version): ReleaseType {
    if (!previous) return 'initial';
    if (compareVersions(current, previous) <= 0) {
        throw new Error('The release version must be newer than the previous tag');
    }

    if (current.major !== previous.major) {
        if (current.major !== previous.major + 1 || current.minor !== 0 || current.patch !== 0) {
            throw new Error('A major release must increment major by one and reset minor/patch to zero');
        }
        return 'major';
    }
    if (current.minor !== previous.minor) {
        if (current.minor !== previous.minor + 1 || current.patch !== 0) {
            throw new Error('A minor release must increment minor by one and reset patch to zero');
        }
        return 'minor';
    }
    if (current.patch !== previous.patch + 1) {
        throw new Error('A patch release must increment patch by one');
    }
    return 'patch';
}

export function extractReleaseNotes(changelog: string, version: string): string {
    const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const heading = new RegExp(`^## \\[${escapedVersion}\\](?:\\s+-\\s+.+)?\\s*$`, 'm');
    const match = heading.exec(changelog);
    if (!match) {
        throw new Error(`CHANGELOG.md does not contain a section for ${version}`);
    }

    const bodyStart = match.index + match[0].length;
    const remaining = changelog.slice(bodyStart);
    const nextHeading = /^## \[/m.exec(remaining);
    const notes = remaining.slice(0, nextHeading?.index ?? remaining.length).trim();
    if (!notes) {
        throw new Error(`CHANGELOG.md section for ${version} is empty`);
    }
    return notes;
}

export function getReleaseTitle(tag: string, releaseType: ReleaseType): string {
    const suffix: Record<ReleaseType, string> = {
        initial: 'Initial Release 🚀',
        major: 'Breaking Release 💥',
        minor: 'New Feature! ✨',
        patch: 'Patch 🔧',
    };
    return `${tag} ${suffix[releaseType]}`;
}
