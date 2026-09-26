// Run with: node --test .github/scripts/post-review.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  run,
  parsePatch,
  partition,
  parseOutput,
  inlineBody,
  summaryBody,
  MAX_INLINE,
} = require('./post-review.js');

// New side: 10 ctx, 11 added, 12 added, 13 ctx, (deleted line), 14 ctx | 40 ctx, 41 added, 42 ctx
const PATCH = [
  '@@ -10,5 +10,6 @@ class A {',
  '   int a;',
  '+  int b;',
  '+  int c;',
  '   int d;',
  '-  int removed;',
  '   int e;',
  '@@ -38,2 +40,3 @@ void m() {',
  '   x();',
  '+  y();',
  '   z();',
  '\\ No newline at end of file',
].join('\n');

const FILE = 'backend/src/main/java/A.java';

function finding(overrides) {
  return {
    rule_id: 'DEF-002',
    severity: 'medium',
    file: FILE,
    line: 11,
    issue: 'issue',
    suggestion: 'suggestion',
    ...overrides,
  };
}

test('parsePatch: added and context lines are commentable, deleted lines are not', () => {
  assert.deepEqual([...parsePatch(PATCH)].sort((a, b) => a - b), [10, 11, 12, 13, 14, 40, 41, 42]);
});

test('parsePatch: missing patch (binary / too large) yields nothing', () => {
  assert.equal(parsePatch(undefined).size, 0);
});

test('partition: out-of-diff lines and unknown files go to the summary', () => {
  const commentable = new Map([[FILE, parsePatch(PATCH)]]);
  const { inline, outOfDiff, overflow } = partition(
    [
      finding({ line: 11 }), // added
      finding({ line: 13 }), // context
      finding({ line: 20 }), // outside any hunk
      finding({ line: 15 }), // would be the deleted line's old number; not on new side
      finding({ file: 'other/B.java', line: 1 }), // file not in the PR
    ],
    commentable,
  );
  assert.deepEqual(
    inline.map((f) => f.line),
    [11, 13],
  );
  assert.deepEqual(outOfDiff.map((f) => `${f.file}:${f.line}`).sort(), [
    `${FILE}:15`,
    `${FILE}:20`,
    'other/B.java:1',
  ]);
  assert.equal(overflow.length, 0);
});

test('partition: high before medium, then file and line; cap at MAX_INLINE', () => {
  const commentable = new Map([[FILE, parsePatch(PATCH)]]);
  const findings = [
    finding({ line: 10, severity: 'medium' }),
    finding({ line: 11, severity: 'medium' }),
    finding({ line: 12, severity: 'medium' }),
    finding({ line: 42, severity: 'high', rule_id: 'SEC-001' }),
    finding({ line: 13, severity: 'medium' }),
    finding({ line: 41, severity: 'high', rule_id: 'DEF-001' }),
    finding({ line: 14, severity: 'medium' }),
  ];
  const { inline, overflow } = partition(findings, commentable);
  assert.equal(MAX_INLINE, 5);
  assert.deepEqual(
    inline.map((f) => `${f.severity}:${f.line}`),
    ['high:41', 'high:42', 'medium:10', 'medium:11', 'medium:12'],
  );
  assert.deepEqual(
    overflow.map((f) => f.line),
    [13, 14],
  );
});

test('inlineBody: marker first, then rule, issue, suggestion, footer', () => {
  const body = inlineBody(finding({ rule_id: 'DEF-001', severity: 'high' }));
  assert.ok(body.startsWith('<!-- ai-review:rule=DEF-001 -->\n'));
  assert.match(body, /\*\*DEF-001\*\*（high）/);
  assert.match(body, /修正案/);
  assert.ok(body.endsWith('🤖 AIレビュー　👍 対応した ／ 👎 誤り ／ 😕 正しいが不要'));
});

test('summaryBody: marker with rules SHA and the counts line', () => {
  const findings = [finding({ line: 11 }), finding({ line: 99 })];
  const parts = partition(findings, new Map([[FILE, parsePatch(PATCH)]]));
  const body = summaryBody({ detectedCount: 4, findings, parts, rulesSha: 'abc123' });
  assert.ok(body.startsWith('<!-- ai-review:summary rules=abc123 -->\n'));
  assert.match(body, /検出 4件 → 検証通過 2件（インライン 1件）/);
  assert.match(body, /差分外の指摘（1件）/);
  assert.match(body, /A\.java:99/);
});

test('parseOutput: rejects empty, non-JSON and malformed findings', () => {
  assert.throws(() => parseOutput(''), /空/);
  assert.throws(() => parseOutput('not json'), /JSON/);
  assert.throws(() => parseOutput('{"findings":[]}'), /detected_count/);
  assert.throws(
    () => parseOutput(JSON.stringify({ detected_count: 1, findings: [finding({ line: 0 })] })),
    /line/,
  );
  assert.throws(
    () =>
      parseOutput(JSON.stringify({ detected_count: 1, findings: [finding({ severity: 'low' })] })),
    /severity/,
  );
  assert.deepEqual(parseOutput('{"detected_count":0,"findings":[]}').findings, []);
});

function mocks(files) {
  const calls = { createReview: [], failed: null };
  const summary = {
    addHeading() {
      return summary;
    },
    addTable() {
      return summary;
    },
    addRaw() {
      return summary;
    },
    async write() {},
  };
  return {
    calls,
    github: {
      paginate: async () => files,
      rest: {
        pulls: {
          listFiles: () => {},
          createReview: async (args) => calls.createReview.push(args),
        },
      },
    },
    context: {
      repo: { owner: 'o', repo: 'r' },
      payload: { pull_request: { number: 7, head: { sha: 'headsha' } } },
    },
    core: {
      setFailed: (m) => (calls.failed = m),
      summary,
    },
  };
}

test('run: posts exactly one review with inline comments and summary', async () => {
  const m = mocks([{ filename: FILE, patch: PATCH }]);
  const structuredOutput = JSON.stringify({
    detected_count: 3,
    findings: [finding({ line: 41, severity: 'high' }), finding({ line: 99 })],
  });
  await run({ ...m, structuredOutput, rulesSha: 'sha1' });
  assert.equal(m.calls.failed, null);
  assert.equal(m.calls.createReview.length, 1);
  const review = m.calls.createReview[0];
  assert.equal(review.event, 'COMMENT');
  assert.equal(review.commit_id, 'headsha');
  assert.deepEqual(
    review.comments.map((c) => [c.path, c.line, c.side]),
    [[FILE, 41, 'RIGHT']],
  );
  assert.match(review.body, /検出 3件 → 検証通過 2件（インライン 1件）/);
});

test('run: invalid output fails the step and posts nothing', async () => {
  const m = mocks([]);
  await run({ ...m, structuredOutput: '', rulesSha: 'sha1' });
  assert.match(m.calls.failed, /空/);
  assert.equal(m.calls.createReview.length, 0);
});
