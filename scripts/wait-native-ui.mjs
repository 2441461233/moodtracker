// Pages must not publish a commit whose native recording UI has not passed.
import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
const { GITHUB_REPOSITORY: repository, GITHUB_SHA: sha } = process.env;
if (!repository || !/^[a-f0-9]{40}$/.test(sha ?? ''))
  throw new Error('Missing CI repository/commit');
const deadline = Date.now() + 45 * 60 * 1000;
let last = '';
while (Date.now() < deadline) {
  const response = JSON.parse(
    execFileSync(
      'gh',
      [
        'api',
        `repos/${repository}/actions/workflows/verify-ios.yml/runs?head_sha=${sha}&per_page=20`,
      ],
      { encoding: 'utf8' },
    ),
  );
  const run = response.workflow_runs.find((item) => item.head_sha === sha);
  if (run?.status === 'completed') {
    if (run.conclusion !== 'success')
      throw new Error(`Native UI gate failed (${run.conclusion}): ${run.html_url}`);
    console.log(`Native app compilation and recording UI passed: ${run.html_url}`);
    process.exit(0);
  }
  const status = run
    ? `${run.id}: ${run.status}`
    : 'Waiting for the native verification workflow to start';
  if (status !== last) {
    console.log(status);
    last = status;
  }
  await setTimeout(20_000);
}
throw new Error('Native UI verification did not pass within 45 minutes; deployment stopped.');
