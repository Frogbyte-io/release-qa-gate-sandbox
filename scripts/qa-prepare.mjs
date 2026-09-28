// Trusted default-branch coordinator for the Orbit Orchard QA sandbox.
// The PR's npm scripts run only in separate read-only package jobs.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: runId, GITHUB_RUN_ATTEMPT: attempt,
  GITHUB_SHA: workflowHeadSha, PR_NUMBER: numberText, EXPECTED_HEAD: sourceSha,
  EXPECTED_BASE: baseSha, POLICY_DIGEST: policyDigest } = process.env;
const sha = /^[0-9a-f]{40}$/;
const digest = /^[0-9a-f]{64}$/;
const prNumber = Number(numberText);
if (!/^\d+$/.test(numberText ?? '') || !Number.isSafeInteger(prNumber) || prNumber < 1 ||
    !sha.test(sourceSha ?? '') || !sha.test(baseSha ?? '') || !digest.test(policyDigest ?? '') ||
    !sha.test(workflowHeadSha ?? '') || !/^\d+$/.test(runId ?? '') || !/^\d+$/.test(attempt ?? '')) {
  throw new Error('Invalid candidate preparation inputs');
}
const api = (...args) => execFileSync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const json = (...args) => JSON.parse(api(...args));
const postJson = (endpoint, body) => JSON.parse(execFileSync('gh', ['api', '--method', 'POST', '--input', '-', endpoint], {
  input: JSON.stringify(body), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
}));
const list = (path) => api('--paginate', path, '--jq', '.[]').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const path = (suffix) => `repos/${repo}/${suffix}`;
const releaseName = `QA PR #${prNumber}`;
const candidateId = `cand-${runId}-${attempt}`;

function assertCurrent() {
  const repository = json(`repos/${repo}`);
  const pr = json(path(`pulls/${prNumber}`));
  if (pr.state !== 'open' || pr.head.repo.id !== repository.id || pr.base.repo.id !== repository.id ||
      pr.head.sha !== sourceSha) throw new Error('PR is closed, forked, or has changed source head');
  const tip = json(path(`branches/${encodeURIComponent(pr.base.ref)}`)).commit.sha;
  if (tip !== baseSha) throw new Error('Target branch tip changed');
  const bytes = Buffer.from(json(path(`contents/qa/policy.json?ref=${baseSha}`)).content, 'base64');
  if (hash(bytes) !== policyDigest) throw new Error('Trusted policy changed');
  const policy = JSON.parse(bytes.toString('utf8'));
  const changed = list(path(`pulls/${prNumber}/files?per_page=100`)).map((entry) => entry.filename);
  if (!pr.head.ref.startsWith(policy.releaseBranchPrefix) &&
      !pr.labels.some((label) => label.name === policy.releaseLabel) &&
      !changed.some((name) => policy.releaseFiles.includes(name))) throw new Error('No trusted release intent');
  return { repository, pr };
}

function draftRelease() {
  return list(path('releases?per_page=100')).find((item) => item.draft && item.name === releaseName);
}

function upload(release, name, file) {
  const url = `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
  return json('--method', 'POST', '-H', 'Content-Type: application/octet-stream', '--input', file, url);
}

function invalidate() {
  assertCurrent();
  let release = draftRelease();
  if (!release) release = postJson(path('releases'), {
    tag_name: `qa-pr-${prNumber}`, target_commitish: baseSha, name: releaseName,
    body: 'Release QA candidate records for this pull request.', draft: true, prerelease: true,
  });
  const selected = release.assets.find((asset) => asset.name === 'candidate.json');
  if (selected) {
    const previous = Buffer.from(api('-H', 'Accept: application/octet-stream', path(`releases/assets/${selected.id}`)));
    const archivedName = `candidate-previous-${selected.id}.json`;
    writeFileSync(archivedName, previous);
    upload(release, archivedName, archivedName);
    api('--method', 'DELETE', path(`releases/assets/${selected.id}`));
  }
  if (draftRelease()?.assets.some((asset) => asset.name === 'candidate.json')) throw new Error('Could not withdraw active selection');
  console.log(`Withdrew active selection for PR #${prNumber}; packages may now build`);
}

function select() {
  const { repository } = assertCurrent();
  const release = draftRelease();
  if (!release || release.assets.some((asset) => asset.name === 'candidate.json')) throw new Error('Selection was not withdrawn');
  const run = json(path(`actions/runs/${runId}`));
  if (run.path !== '.github/workflows/qa-prepare.yml' || run.head_sha !== workflowHeadSha ||
      run.repository.id !== repository.id || run.run_attempt !== Number(attempt) ||
      run.event !== 'workflow_dispatch' || run.display_title !== `qa-prepare PR #${prNumber} ${sourceSha}`) {
    throw new Error('Wrong preparation workflow run or source binding');
  }
  const actions = list(path(`actions/runs/${runId}/artifacts?per_page=100`));
  const artifacts = [];
  for (const [profile, suffix] of [['windows', '.exe'], ['linux', '.deb']]) {
    const action = actions.find((item) => item.name === `candidate-${profile}` && !item.expired);
    if (!action) throw new Error(`Missing ${profile} Actions artifact`);
    const origin = json(path(`actions/artifacts/${action.id}`)).workflow_run;
    if (origin.id !== Number(runId) || origin.repository_id !== repository.id || origin.head_sha !== workflowHeadSha) {
      throw new Error(`Wrong ${profile} Actions artifact origin`);
    }
    const directory = join('candidate-files', `candidate-${profile}`);
    const names = readdirSync(directory).filter((name) => name.endsWith(suffix));
    if (names.length !== 1 || !/^Orbit-Orchard-[A-Za-z0-9.-]+\.(exe|deb)$/.test(names[0])) throw new Error(`Expected one ${profile} package`);
    const name = `${candidateId}-${names[0]}`;
    const file = join(directory, names[0]);
    const sha256 = hash(readFileSync(file));
    const asset = upload(release, name, file);
    if (asset.state !== 'uploaded' || asset.name !== name || asset.digest !== `sha256:${sha256}`) throw new Error(`${profile} release asset digest differs`);
    artifacts.push({ profile, name, sha256, assetId: asset.id, actionsArtifactId: action.id });
  }
  const tree = json(path(`git/commits/${sourceSha}`)).tree.sha;
  if (!sha.test(tree)) throw new Error('Source tree identity unavailable');
  assertCurrent();
  const manifest = { schemaVersion: 1, id: candidateId, repositoryId: repository.id, pullRequest: prNumber,
    sourceSha, baseSha, sourceTreeSha: tree, testRevision: sourceSha, policyDigest,
    build: { workflowPath: '.github/workflows/qa-prepare.yml', workflowHeadSha, runId: Number(runId), attempt: Number(attempt) }, artifacts };
  const history = `${candidateId}.json`;
  writeFileSync(history, JSON.stringify(manifest, null, 2) + '\n');
  upload(release, history, history);
  // The final API mutation is selection; every referenced file was already uploaded and checked.
  const selected = upload(release, 'candidate.json', history);
  if (selected.digest !== `sha256:${hash(readFileSync(history))}`) throw new Error('Selected manifest digest differs');
  console.log(`Selected ${candidateId} from exact source ${sourceSha}`);
}

if (process.argv[2] === 'invalidate') invalidate();
else if (process.argv[2] === 'select') select();
else throw new Error('Expected invalidate or select');
