// Experiment evaluator for Release QA Task 0.2. Reads candidate/report records from a
// draft release named "QA PR #<n>" and fails the job unless the current PR head has a
// complete, matching set of passing reports. Never emits neutral/skipped.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const gh = (...args) => JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8' }));
const repo = process.env.GITHUB_REPOSITORY;
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const prNumber = event.pull_request?.number ?? Number(process.env.PR_NUMBER);
const summary = [];
const say = (line) => { console.log(line); summary.push(line); };
const finish = (ok, title) => {
  say(`\n**${ok ? 'PASS' : 'BLOCKED'}**: ${title}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  process.exit(ok ? 0 : 1);
};

const pr = gh(`repos/${repo}/pulls/${prNumber}`);
say(`- event: ${process.env.GITHUB_EVENT_NAME}/${event.action ?? ''}`);
say(`- GITHUB_SHA (checked-out ref): ${process.env.GITHUB_SHA}`);
say(`- event head sha: ${event.pull_request?.head.sha}`);
say(`- current PR head sha: ${pr.head.sha}`);
say(`- current base sha: ${pr.base.sha}`);
say(`- merge_commit_sha: ${pr.merge_commit_sha}`);

if (event.pull_request && event.pull_request.head.sha !== pr.head.sha) {
  finish(false, `obsolete evaluation: event head ${event.pull_request.head.sha} is not current head ${pr.head.sha}`);
}

const policy = JSON.parse(
  Buffer.from(gh(`repos/${repo}/contents/qa/policy.json?ref=${pr.base.sha}`).content, 'base64').toString(),
);
const isRelease =
  pr.head.ref.startsWith(policy.releaseBranchPrefix) ||
  pr.labels.some((l) => l.name === policy.releaseLabel);
if (!isRelease) finish(true, 'not a release PR; normal policy applies');

const releases = gh(`repos/${repo}/releases?per_page=100`);
const draft = releases.find((r) => r.draft && r.name === `QA PR #${prNumber}`);
if (!draft) finish(false, 'manual check required: no candidate release record for this PR');

const assetJson = (asset) =>
  JSON.parse(execFileSync('gh', ['api', '-H', 'Accept: application/octet-stream', `repos/${repo}/releases/assets/${asset.id}`], { encoding: 'utf8' }));
const candidateAsset = draft.assets.find((a) => a.name === 'candidate.json');
if (!candidateAsset) finish(false, 'manual check required: no active candidate selected');
const candidate = assetJson(candidateAsset);
say(`- candidate ${candidate.id} for source ${candidate.sourceSha}`);
if (candidate.sourceSha !== pr.head.sha) {
  finish(false, `candidate was prepared for ${candidate.sourceSha}, current head is ${pr.head.sha}`);
}

const reports = draft.assets.filter((a) => a.name.startsWith('report-')).map(assetJson)
  .filter((r) => r.candidateId === candidate.id);
const missing = [];
for (const key of policy.required) {
  const mine = reports.filter((r) => r.requirement === key);
  if (mine.some((r) => r.outcome === 'failed')) missing.push(`${key} (failed attempt present)`);
  else if (!mine.some((r) => r.outcome === 'passed')) missing.push(key);
}
if (missing.length) finish(false, `manual check required: ${missing.join(', ')}`);
finish(true, `all ${policy.required.length} required results present for candidate ${candidate.id}`);
