import assert from 'node:assert/strict';
import { test } from 'node:test';
import { packageName, releaseVersion } from '../scripts/qa-source.mjs';

test('matches the release marker to the packaged version', () => {
  assert.equal(releaseVersion('0.1.0\n', '{"version":"0.1.0"}'), '0.1.0');
  assert.throws(() => releaseVersion('0.1.1\n', '{"version":"0.1.0"}'), /must match/);
  assert.throws(() => releaseVersion('not-a-version', '{"version":"0.1.0"}'), /must match/);
});

test('accepts only the final package filenames for each profile', () => {
  assert.equal(packageName('windows', '0.1.0'), 'Orbit-Orchard-0.1.0-win-x64.exe');
  assert.equal(packageName('linux', '0.1.0'), 'Orbit-Orchard-0.1.0-linux-amd64.deb');
  assert.throws(() => packageName('macos', '0.1.0'), /Unknown release profile/);
});
