// What the lifecycle and the scenario share: where the app goes, where its data lives, how to run a process to its end as
// something the run owns, and the one live session. Paths in qa/project.json are relative to qa/, so this is `qa/app.mjs`.
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Release QA's own driver code. The run workflow checks the tool out next to the sandbox (`subject/` and `release-qa/`),
 * and a local clone sits beside this one too, so the default finds it in both places. Set RELEASE_QA_TOOL to say where
 * else it is. It is imported on demand so that only a run, never `npm test` or the app, needs it.
 * @param {string} relative path under the tool's repository root, e.g. `packages/qa/src/drivers/electron.ts`
 */
export function tool(relative) {
  const root = process.env.RELEASE_QA_TOOL ?? resolve(import.meta.dirname, '..', '..', 'release-qa');
  return import(pathToFileURL(join(root, ...relative.split('/'))).href);
}

/** Where the .deb's files are unpacked: inside the designated test root, so the run owns it and the runner can remove it. */
export const installDir = (ctx) => join(ctx.testRoot, 'orbit-orchard-app');

/** The packaged executable, where the .deb puts it (`/opt/<productName>/<executableName>`, see the .desktop file's Exec). */
export const executable = (ctx) => join(installDir(ctx), 'opt', 'Orbit Orchard', 'orbit-orchard');

/**
 * The app's data directory. The run pins it (`--user-data-dir`) inside the test root instead of leaving it at Electron's
 * default (`~/.config/Orbit Orchard`), so the run never touches, and never depends on, data the machine's user has there.
 */
export const dataDir = (ctx) => join(ctx.testRoot, 'electron-user-data');

/** Where the app keeps the best score (app/score.cjs). */
export const scoreFile = (ctx) => join(dataDir(ctx), 'score.json');

/** Removes the app's data directory. */
export const removeData = (ctx) => rm(dataDir(ctx), { recursive: true, force: true });

/** Runs a command as a process the run owns, and waits for it; a non-zero exit is an error naming the command. */
export async function runToEnd(ctx, label, command, args) {
  const child = await ctx.spawn(label, command, args, { stdio: 'ignore', windowsHide: true });
  // `ctx.spawn` already rejects when the process cannot start; an error after that (one that comes without an exit)
  // must not leave this waiting forever either.
  const ended = await new Promise((resolveExit, rejectExit) => {
    if (child.exitCode !== null || child.signalCode !== null) resolveExit(child.exitCode ?? `signal ${child.signalCode}`);
    else {
      child.once('exit', (exitCode, signal) => resolveExit(exitCode ?? `signal ${signal}`));
      child.once('error', (error) => rejectExit(new Error(`${label} (${command}) failed: ${error.message}`)));
    }
  });
  if (ended !== 0) throw new Error(`${label} (${command}) exited with ${ended}`);
}

/**
 * The chromedriver built for the app's Electron release. It is not part of the app or of the tool, so the run workflow
 * installs the `electron-chromedriver` package at the app's Electron version and names the binary in
 * RELEASE_QA_CHROMEDRIVER. Locally, set it to a chromedriver built for the same Electron release.
 */
export function chromedriver() {
  const configured = process.env.RELEASE_QA_CHROMEDRIVER;
  if (configured !== undefined && configured !== '') return configured;
  const installed = join(import.meta.dirname, '..', 'node_modules', 'electron-chromedriver', 'bin', 'chromedriver');
  if (existsSync(installed)) return installed;
  throw new Error('chromedriver was not found: set RELEASE_QA_CHROMEDRIVER to the chromedriver built for the packaged Electron release (the `electron-chromedriver` package at the same version as `electron`)');
}

/** The live session, set by the lifecycle's launch hook and ended by its cleanup hook. */
export const app = { session: undefined };

export function session() {
  if (app.session === undefined) throw new Error('the app was not launched');
  return app.session;
}
