// Posts the AI review result to the pull request.
//
// Everything that can be decided deterministically lives here rather than in the model:
// which findings become inline comments, how many, in what order, and what the comments look
// like. Claude only returns {detected_count, findings[]}; it has no permission to post.
//
// Called from actions/github-script in .github/workflows/ai-review.yml. The pure functions are
// exported separately so post-review.test.js can exercise them without GitHub.

const fs = require('node:fs');

const MAX_INLINE = 5;
const SEVERITY_ORDER = { high: 0, medium: 1 };
const SEVERITY_LABEL = { high: '🔴 high', medium: '🟡 medium' };
const RULES_PATH = '.claude/skills/ai-review/references/rules.md';
// Perspectives without rules.md entries: their findings carry the perspective ID instead.
const PERSPECTIVE_TITLES = new Map([
  ['SECURITY', 'セキュリティ（ルール外の観点）'],
  ['TESTS', 'テスト（ルール外の観点）'],
]);
const FOOTER = '🤖 AIレビュー　👍 対応した ／ 👎 誤り ／ 😕 正しいが不要';

/**
 * Lines on the new side of a unified-diff patch that GitHub accepts review comments on:
 * added lines and context lines. Deleted lines have no new-side number.
 * `patch` is the per-file hunk text from pulls.listFiles (no file headers). It is undefined for
 * binary or very large files, in which case nothing is commentable.
 */
function parsePatch(patch) {
  const lines = new Set();
  if (!patch) return lines;
  let newLine = null;
  for (const raw of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (newLine === null) continue;
    if (raw.startsWith('\\')) continue; // "\ No newline at end of file"
    if (raw.startsWith('-')) continue;
    if (raw.startsWith('+') || raw.startsWith(' ')) {
      lines.add(newLine);
      newLine += 1;
    }
  }
  return lines;
}

/** Stable sort by severity (high first), then file, then line. */
function sortFindings(findings) {
  return findings
    .map((f, i) => ({ f, i }))
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.f.severity] ?? 99) - (SEVERITY_ORDER[b.f.severity] ?? 99) ||
        a.f.file.localeCompare(b.f.file) ||
        a.f.line - b.f.line ||
        a.i - b.i,
    )
    .map(({ f }) => f);
}

/**
 * Splits findings into inline comments and summary-only entries.
 * Inline: in-diff findings, highest severity first, at most `max`.
 * Summary: findings on lines GitHub would reject (a single such comment makes the whole review
 * fail with 422) plus in-diff findings beyond the cap.
 */
function partition(findings, commentableByFile, max = MAX_INLINE) {
  const inline = [];
  const outOfDiff = [];
  const overflow = [];
  for (const f of sortFindings(findings)) {
    const commentable = commentableByFile.get(f.file);
    if (!commentable || !commentable.has(f.line)) {
      outOfDiff.push(f);
    } else if (inline.length < max) {
      inline.push(f);
    } else {
      overflow.push(f);
    }
  }
  return { inline, outOfDiff, overflow };
}

/**
 * Rule titles from the "## <RULE_ID> <title>" headings in rules.md, so a comment can say what
 * DEF-001 means. A missing or unreadable file only costs the titles, never the review.
 */
function parseRuleTitles(markdown) {
  const titles = new Map(PERSPECTIVE_TITLES);
  for (const m of (markdown || '').matchAll(/^## ([A-Z]+-\d+)\s+(.+)$/gm)) {
    titles.set(m[1], m[2].trim());
  }
  return titles;
}

function ruleLabel(f, titles) {
  const title = titles.get(f.rule_id);
  return title ? `\`${f.rule_id}\` ${title}` : `\`${f.rule_id}\``;
}

// The marker must stay on the first line: review_metrics.py reads it from the thread's first comment.
function inlineBody(f, titles = new Map()) {
  return [
    `<!-- ai-review:rule=${f.rule_id} -->`,
    `**重要度**：${SEVERITY_LABEL[f.severity] ?? f.severity}　**ルール**：${ruleLabel(f, titles)}`,
    '',
    '#### 指摘',
    '',
    f.issue,
    '',
    '#### 修正案',
    '',
    f.suggestion,
    '',
    '---',
    FOOTER,
  ].join('\n');
}

function summaryLine(f, titles = new Map()) {
  return [
    `- ${SEVERITY_LABEL[f.severity] ?? f.severity}　${ruleLabel(f, titles)}　\`${f.file}:${f.line}\``,
    `  - **指摘**：${f.issue}`,
    `  - **修正案**：${f.suggestion}`,
  ].join('\n');
}

function summaryBody({
  detectedCount,
  failedGroups = 0,
  findings,
  parts,
  rulesSha,
  titles = new Map(),
}) {
  const out = [
    `<!-- ai-review:summary rules=${rulesSha} -->`,
    '## 🤖 AIレビュー',
    '',
    `検出 ${detectedCount}件 → 検証通過 ${findings.length}件（インライン ${parts.inline.length}件）`,
  ];
  if (failedGroups > 0) {
    // A failed detector group returns nothing, which would otherwise read as "no findings".
    out.push(
      '',
      `> [!WARNING]`,
      `> 検出に失敗したファイルグループが ${failedGroups} 件あります。**このレビューは不完全です。**`,
      '> 指摘が無いことは、問題が無いことを意味しません。`ai-review` ラベルで再実行してください。',
    );
  } else if (findings.length === 0) {
    out.push('', 'ルール定義に当てはまる指摘はありませんでした。');
  }
  if (parts.outOfDiff.length > 0) {
    out.push(
      '',
      `### 差分外の指摘（${parts.outOfDiff.length}件）`,
      '',
      'コメントできない行（差分に含まれない行）への指摘です。',
      '',
      ...parts.outOfDiff.map((f) => summaryLine(f, titles)),
    );
  }
  if (parts.overflow.length > 0) {
    out.push(
      '',
      `### 上限を超えた指摘（${parts.overflow.length}件）`,
      '',
      `インラインコメントは重要度順に最大 ${MAX_INLINE} 件までです。`,
      '',
      ...parts.overflow.map((f) => summaryLine(f, titles)),
    );
  }
  return out.join('\n');
}

/** Parses and validates the structured_output string. Throws with a readable message. */
function parseOutput(raw) {
  if (!raw || !raw.trim()) throw new Error('structured_output が空です');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`structured_output が JSON として読めません: ${e.message}`);
  }
  if (!Number.isInteger(data?.detected_count) || data.detected_count < 0) {
    throw new Error('detected_count が 0 以上の整数ではありません');
  }
  if (!Number.isInteger(data.failed_groups) || data.failed_groups < 0) {
    throw new Error('failed_groups が 0 以上の整数ではありません');
  }
  if (!Array.isArray(data.findings)) throw new Error('findings が配列ではありません');
  data.findings.forEach((f, i) => {
    for (const key of ['rule_id', 'file', 'issue', 'suggestion']) {
      if (typeof f?.[key] !== 'string' || f[key] === '') {
        throw new Error(`findings[${i}].${key} が空、または文字列ではありません`);
      }
    }
    if (!(f.severity in SEVERITY_ORDER)) {
      throw new Error(`findings[${i}].severity が high / medium ではありません`);
    }
    if (!Number.isInteger(f.line) || f.line < 1) {
      throw new Error(`findings[${i}].line が 1 以上の整数ではありません`);
    }
  });
  return data;
}

/** Entry point for actions/github-script. */
async function run({ github, context, core, structuredOutput, rulesSha }) {
  let data;
  try {
    data = parseOutput(structuredOutput);
  } catch (e) {
    core.setFailed(e.message);
    return;
  }

  const pr = context.payload.pull_request;
  const { owner, repo } = context.repo;

  const files = await github.paginate(github.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pr.number,
    per_page: 100,
  });
  const commentableByFile = new Map(files.map((f) => [f.filename, parsePatch(f.patch)]));

  const parts = partition(data.findings, commentableByFile);
  let titles = new Map(PERSPECTIVE_TITLES);
  try {
    titles = parseRuleTitles(fs.readFileSync(RULES_PATH, 'utf8'));
  } catch (e) {
    core.warning(`${RULES_PATH} を読めないため、ルール名を省略します: ${e.message}`);
  }
  const body = summaryBody({
    detectedCount: data.detected_count,
    failedGroups: data.failed_groups,
    findings: data.findings,
    parts,
    rulesSha: rulesSha || 'unknown',
    titles,
  });

  // One createReview call so the author gets one notification, not one per comment.
  await github.rest.pulls.createReview({
    owner,
    repo,
    pull_number: pr.number,
    commit_id: pr.head.sha,
    event: 'COMMENT',
    body,
    comments: parts.inline.map((f) => ({
      path: f.file,
      line: f.line,
      side: 'RIGHT',
      body: inlineBody(f, titles),
    })),
  });

  await core.summary
    .addHeading('AIレビュー', 2)
    .addTable([
      [
        { data: '検出', header: true },
        { data: '検証通過', header: true },
        { data: 'インライン', header: true },
        { data: '差分外', header: true },
        { data: '上限超過', header: true },
        { data: '検出失敗グループ', header: true },
      ],
      [
        String(data.detected_count),
        String(data.findings.length),
        String(parts.inline.length),
        String(parts.outOfDiff.length),
        String(parts.overflow.length),
        String(data.failed_groups),
      ],
    ])
    .addRaw(`rules.md: ${rulesSha || 'unknown'}`)
    .write();

  // Post what was found, then fail the job so an incomplete review is visible in the checks.
  if (data.failed_groups > 0) {
    core.setFailed(`検出に失敗したファイルグループが ${data.failed_groups} 件あります（レビューは不完全）`);
  }
}

module.exports = {
  run,
  parsePatch,
  partition,
  sortFindings,
  parseRuleTitles,
  parseOutput,
  inlineBody,
  summaryBody,
  MAX_INLINE,
};
