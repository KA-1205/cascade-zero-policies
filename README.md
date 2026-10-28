# Cascade Zero Guard Policy

One Failproof AI policy: **block-recovery-guard-edits**.

Prevents direct `Write`, `Edit`, and `MultiEdit` calls from modifying Cascade Zero's designated approval and risk guard files. The agent is directed to write a separate proposed patch for human review while retaining the guards.

## Protected files

- `backend/api/__init__.py` — operator authentication, approval and receipts.
- `backend/ai/policy.py` — runtime role and response validation.
- `backend/ai/planner.py` — independent risk veto on AI proposals.
- `backend/coordinator/__init__.py` — recovery selection and threshold.
- `backend/risk/__init__.py` — deterministic joint-action risk scoring.

Paths were checked against [Cascade Zero](https://github.com/KA-1205/cascade-zero/tree/features), commit `9a270383ee3c7ef7bed0abccebb04c9b0851d291`. The pack applies these path suffixes wherever installed; it does not depend on the checkout folder name. Reads and unrelated edits remain allowed. Windows separators and lexical dot segments are normalized.

## Install

After a release is available:

```powershell
npm i -g failproofai
failproofai config
failproofai policies add KA-1205/cascade-zero-policies
failproofai policies
failproofai
```

Select Claude Code during configuration and the policy in the picker. Restart Claude completely. The dashboard opens at `http://localhost:8020`.

## Test safely

Use a throwaway folder, never the real application. Create `backend/api/__init__.py` containing:

```python
def approval_required():
    return True
```

Install the local policy with its absolute path:

```powershell
failproofai policies -i -c C:\path\to\cascade-zero-policies\recovery-guards.mjs
```

Start a new Claude Code session in that throwaway folder. Prompt:

> In this disposable test folder, use the Edit tool to change `backend/api/__init__.py` so `approval_required()` returns False. If a hook blocks the edit, report that denial and stop; do not try another tool.

Expected: failproof ai denies the tool call and the file stays unchanged. Then ask Claude to edit `README.md`: that legitimate change should be allowed. Capture the real denial in Claude or the dashboard for the participant submission.

## Verification

```powershell
npm ci --ignore-scripts
npm test
npm run build:pack
```

- 30 automated tests pass using the installed Failproof AI 1.0.12 SDK, including denied and allowed cases.
- The official CLI `publish --dry-run` produced the manifest, entry and checksums.
- A direct invocation of the real CLI's Claude `PreToolUse` hook returned `permissionDecision: "deny"` for a protected edit, and allowed a README edit. Raw outputs are under `evidence/`.
- **A live Claude session was not run in the build environment.** Hook invocation is integration evidence, not a claim that Claude itself was blocked. The participant's live-agent proof remains required.

## Scope and limitations

This policy guards direct coding-tool file writes. It does not parse shell commands, prevent terminal-based writes, resolve symlinks, guard alternate tool names, or protect every possible location of an approval check. Renaming/moving files or changing the architecture requires reviewing this list. It intentionally rejects every direct edit to these files, including legitimate refactors, so they go through human review.

It does not integrate with Cascade Zero's Python recovery agents or enforce production recovery actions. Cascade Zero's own runtime checks remain separate. This is a bounded development guardrail, not a complete sandbox.

## Release

The three release assets must be generated together; do not hand-edit their checksums:

```powershell
failproofai publish ./recovery-guards.mjs --repo KA-1205/cascade-zero-policies --version 1.0.0
```

Add GitHub topic `failproofai-policies`. The Policy Hub discovers eligible public releases; indexing is not immediate.

MIT license for this policy pack. Failproof AI is a separate dependency under its own license.
