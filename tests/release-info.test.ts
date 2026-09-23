import { describe, expect, test } from 'bun:test';
import {
    classifyRelease,
    extractReleaseNotes,
    getReleaseTitle,
    parseStableTag,
} from '../tools/release-info.ts';

describe('release information', () => {
    test('classifies semantic version increments', () => {
        expect(classifyRelease(parseStableTag('v0.3.1'), parseStableTag('v0.3.0'))).toBe('patch');
        expect(classifyRelease(parseStableTag('v0.4.0'), parseStableTag('v0.3.1'))).toBe('minor');
        expect(classifyRelease(parseStableTag('v1.0.0'), parseStableTag('v0.4.0'))).toBe('major');
        expect(classifyRelease(parseStableTag('v0.1.0'))).toBe('initial');
    });

    test('rejects ambiguous or invalid version jumps', () => {
        expect(() => classifyRelease(parseStableTag('v0.4.2'), parseStableTag('v0.3.1'))).toThrow();
        expect(() => classifyRelease(parseStableTag('v0.3.3'), parseStableTag('v0.3.1'))).toThrow();
        expect(() => classifyRelease(parseStableTag('v0.3.0'), parseStableTag('v0.3.0'))).toThrow();
    });

    test('extracts only the requested changelog section', () => {
        const changelog = `# Changelog

## [0.3.1] - 2026-09-23

Patch notes.

## [0.3.0] - 2026-07-20

Old notes.`;
        expect(extractReleaseNotes(changelog, '0.3.1')).toBe('Patch notes.');
    });

    test('creates a patch release title', () => {
        expect(getReleaseTitle('v0.3.1', 'patch')).toBe('v0.3.1 Patch 🔧');
    });
});
