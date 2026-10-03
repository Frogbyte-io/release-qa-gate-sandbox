// The lifecycle `release-qa run` uses for Orbit Orchard on Linux. The candidate's verified .deb is unpacked with
// `dpkg-deb -x` into the test root: nothing is installed (no root, no dpkg database), and nothing is written outside the
// test root, because the run pins the app's data directory there too. Cleanup closes the app; the runner removes what the
// run owns. The Windows profile has manual requirements only, so this lifecycle refuses to run anywhere but Linux.
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { app, chromedriver, dataDir, executable, installDir, removeData, runToEnd, tool } from './app.mjs';

async function install(ctx) {
  if (process.platform !== 'linux') throw new Error('the Orbit Orchard lifecycle unpacks the Linux .deb and runs on Linux only');
  if (ctx.artifact === undefined) throw new Error('this lifecycle unpacks the candidate artifact, and the run has none');
  const dir = installDir(ctx);
  // Files already there are not this run's: owning the directory would let cleanup delete them.
  if (existsSync(dir)) throw new Error(`${dir} already exists and is not this run's; remove it before running`);
  await ctx.own({ kind: 'path', path: dir, label: 'unpacked app' });
  await mkdir(dir, { recursive: true });
  await runToEnd(ctx, 'unpack', 'dpkg-deb', ['-x', ctx.artifact.path, dir]);
  if (!existsSync(executable(ctx))) throw new Error(`the package was unpacked but ${executable(ctx)} does not exist`);
}

async function reset(ctx) {
  await removeData(ctx);
}

async function launch(ctx) {
  const { ElectronApp } = await tool('packages/qa/src/drivers/electron.ts');
  // The data directory is the run's from the moment the app can create it.
  await ctx.own({ kind: 'path', path: dataDir(ctx), label: 'app data' });
  app.session = await ElectronApp.start(ctx, {
    application: executable(ctx),
    chromedriver: chromedriver(),
    userDataDir: dataDir(ctx),
    // An unpacked .deb has no setuid chrome-sandbox, and Ubuntu 24.04 restricts unprivileged user namespaces, so
    // Chromium's sandbox cannot start (and Electron refuses outright as root). It is only turned off when the machine's
    // owner asks for it; the run workflow does, on its disposable runner.
    appArgs: process.env.RELEASE_QA_ELECTRON_NO_SANDBOX === '1' ? ['--no-sandbox'] : [],
  });
}

async function cleanup(ctx) {
  // Only once the app is gone: a profile removed under a running app is being written to. The session is forgotten only
  // after it closed, so a failed close leaves it for another attempt; the run also owns the app's process and directory
  // and stops and removes them itself.
  await app.session?.close();
  app.session = undefined;
  await removeData(ctx);
}

export const lifecycle = { install, reset, launch, cleanup };
