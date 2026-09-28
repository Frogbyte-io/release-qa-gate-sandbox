import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { packageName, releaseVersion } from '../scripts/qa-source.mjs';

test('matches the release marker to the packaged version', () => {
  assert.equal(releaseVersion('0.1.0\n', '{"version":"0.1.0"}'), '0.1.0');
  assert.throws(() => releaseVersion('0.1.1\n', '{"version":"0.1.0"}'), /must match/);
  assert.throws(() => releaseVersion('not-a-version', '{"version":"0.1.0"}'), /must match/);
});

test('accepts only the final package filenames for each profile', () => {
  const configuration = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const artifactName = configuration.build.artifactName;
  const fromTemplate = (os, arch, ext) => artifactName
    .replace('${version}', configuration.version).replace('${os}', os).replace('${arch}', arch).replace('${ext}', ext);
  assert.equal(packageName('windows', configuration.version), fromTemplate('win', 'x64', 'exe'));
  // The live Linux CI build emits amd64 for its Debian package architecture.
  assert.equal(packageName('linux', configuration.version), fromTemplate('linux', 'amd64', 'deb'));
  assert.throws(() => packageName('macos', '0.1.0'), /Unknown release profile/);
});
