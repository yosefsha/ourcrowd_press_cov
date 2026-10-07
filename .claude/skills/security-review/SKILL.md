---
name: security-review
description: Security review of this repo's code. Scope is diff / a specific folder / the whole project, chosen interactively or via invocation args. Runs standard security checks (secrets, injection, auth, logging, deserialization, dependencies). Use on any PR before merge.
context: fork
agent: Explore
allowed-tools: Read, Bash, Glob, Grep
argument-hint: "diff|<folder>|whole project  <absolute worktree path>"
---

# Security Review

**ARGS = $ARGUMENTS**

## Step 0 — Resolve WHERE and WHAT to review

**Where.** Skill context is pre-rendered in the session's starting directory, which is usually the
primary checkout on `main` — *not* the worktree being reviewed. So never trust a pre-computed diff;
resolve the checkout explicitly and run every git command with `git -C "$TARGET"`:

- If ARGS contain an absolute path to a checkout or worktree (e.g. `diff /…/.claude/worktrees/issue-7-companies`),
  that path is `$TARGET`.
- Otherwise use the directory the caller is working in; if that is the primary checkout and it is on
  `main` with a clean tree, list `git worktree list` and ask which worktree/branch to review instead
  of reporting an empty diff.

**What.** Scope from ARGS, else ask:
1. **Diff** (default for PR review) — everything the branch adds on top of where it forked from main:
   ```bash
   git -C "$TARGET" fetch -q origin main 2>/dev/null || true
   git -C "$TARGET" diff --name-only origin/main...HEAD   # three dots: merge-base, ignores newer main commits
   git -C "$TARGET" diff origin/main...HEAD
   git -C "$TARGET" status --porcelain                     # uncommitted work is in scope too
   git -C "$TARGET" diff HEAD                              # include it if non-empty
   ```
   Fall back to local `main...HEAD` if `origin/main` is unavailable. If both the branch diff and the
   working tree are empty, say exactly which `$TARGET` and branch you checked, then stop.
2. **Specific folder** — `git -C "$TARGET" ls-files -- <folder>` and review every file returned.
3. **Whole project** — `git -C "$TARGET" ls-files`.

For folder/whole-project scope exclude lockfiles, binaries and generated assets (`*.lock`,
`package-lock.json`, `*.png`, `*.jpg`, `dist/`, `build/`, `node_modules/`, `__pycache__/`).

Start the report with one line: `Reviewed <scope> of <branch> at <$TARGET> (<n> files)`.

---

## Step 1 — Standard security checks (apply to every file in scope)

Check every file for:

- **Secrets / credentials** — hardcoded API keys, passwords, tokens, AWS keys, client secrets. Flag any string that looks like a secret not sourced from the environment (`process.env` only inside the config factory, `os.environ` in Python).
- **SQL injection** — queries built by string concatenation / template literals / f-strings instead of parameterized queries (TypeORM query builder parameters, `$1` placeholders). Flag any interpolated value inside a SQL string.
- **Shell injection** — `child_process.exec`/`spawn` with `shell: true` or unsanitized input, `subprocess`/`os.system()` in Python scripts.
- **Sensitive data in logs** — `logger.*`, `print()`, `console.log()` emitting tokens, passwords, PII, or financial amounts.
- **Auth gaps** — missing authentication/authorization checks on endpoints, IDOR (resources fetched without ownership/scope checks), trusting client-supplied identity fields (`user_id`, `org_id`, etc.) instead of validating them server-side.
- **Debug/dev backdoors** — `DEBUG=True` committed to non-dev config, `AllowAny` on non-auth endpoints, commented-out auth checks, `verify=False` on HTTPS calls.
- **Insecure deserialization** — `pickle.loads`, `yaml.load()` without `Loader=`, `eval()` on external input.
- **Cloud/IAM least privilege** (for CDK/Terraform/CloudFormation) — wildcard resource ARNs (`"*"`), overly broad managed policies (`s3:*`, `dynamodb:*`), `removal_policy=DESTROY` on stateful resources (databases, user pools, buckets with data) instead of `RETAIN`.
- **SSRF / unsafe URLs** — server-side fetches of user- or feed-supplied URLs without scheme/host restrictions; links rendered from external data without an http(s) check.
- **New dependencies** — flag new entries in `requirements.txt` or `package.json` that have known CVEs or look suspicious.

---

## Step 2 — Project-specific checks

<!-- Add this project's own security rules here (e.g. tenant/org scoping conventions, auth helper functions that must be called, domain-specific data handling). Empty for now — populate as the codebase grows. -->

---

## Step 3 — Output format

For each finding output:

```
[SEVERITY] Category — file:line
Issue description.
Recommended fix.
```

Severity levels:
- **CRITICAL** — exploitable now (auth bypass, cross-tenant data leak, hardcoded secret in committed code)
- **HIGH** — exploitable with moderate effort (missing scope/ownership check, token logged, weak crypto in prod path)
- **MEDIUM** — defense-in-depth gap (missing input validation, broad IAM, missing ownership check)
- **LOW** — hygiene / best practice (print() instead of logger, overly broad exception swallowing)

End with a summary:

| Severity | Count |
|----------|-------|
| CRITICAL | n |
| HIGH     | n |
| MEDIUM   | n |
| LOW      | n |

If a category has no issues, write: `✅ <Category> — nothing to flag`
