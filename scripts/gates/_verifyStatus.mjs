const VERIFY_RESULT_TERMINAL_PATTERN =
  /(ASSERTIONS MATCH|ASSERTIONS DIFFER|ASSERTIONS INCOMPLETE|CHECKS ALIGNED|CHECKS FAILED|CHECKS NEED REVIEW|DESIGN BLOCKED|CANNOT VERIFY|INCONCLUSIVE|STIMULUS ONLY|OBSERVATION ONLY|OBSERVATION ONLY|OBSERVATION|PASS|FAIL|TRACE)/i;
const VERIFY_PASS_PATTERN = /(ASSERTIONS MATCH|CHECKS ALIGNED|PASS)/i;
const VERIFY_FAIL_PATTERN = /(ASSERTIONS DIFFER|CHECKS FAILED|CHECKS NEED REVIEW|FAIL)/i;
const VERIFY_TRACE_PATTERN = /(STIMULUS ONLY|OBSERVATION ONLY|OBSERVATION|TRACE)/i;

function normalizeStatusText(value) {
  return String(value ?? '').trim();
}

export function isVerifyResultTerminal(value) {
  return VERIFY_RESULT_TERMINAL_PATTERN.test(normalizeStatusText(value));
}

export function isVerifyPass(value) {
  return VERIFY_PASS_PATTERN.test(normalizeStatusText(value));
}

export function isVerifyFail(value) {
  return VERIFY_FAIL_PATTERN.test(normalizeStatusText(value));
}

export function isVerifyTrace(value) {
  return VERIFY_TRACE_PATTERN.test(normalizeStatusText(value));
}

export async function waitForVerifyResult(page, { timeout = 15000, testId = 'ide-verify-summary-status' } = {}) {
  await page.waitForFunction(
    ({ selector, source }) => {
      const status = document.querySelector(selector);
      return Boolean(status && new RegExp(source, 'i').test(status.textContent || ''));
    },
    {
      selector: `[data-testid="${testId}"]`,
      source: VERIFY_RESULT_TERMINAL_PATTERN.source,
    },
    { timeout }
  );
}
