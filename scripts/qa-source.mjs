/** The manifest version and package version must identify the same final files. */
export function releaseVersion(versionText, packageText) {
  const version = versionText.trim();
  const packageVersion = JSON.parse(packageText).version;
  if (!/^\d+\.\d+\.\d+$/.test(version) || version !== packageVersion) {
    throw new Error('Release VERSION must match the package version at the exact PR source');
  }
  return version;
}

export function packageName(profile, version) {
  if (profile === 'windows') return `Orbit-Orchard-${version}-win-x64.exe`;
  if (profile === 'linux') return `Orbit-Orchard-${version}-linux-amd64.deb`;
  throw new Error(`Unknown release profile ${profile}`);
}
