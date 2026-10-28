import { customPolicies, allow, deny } from "failproofai";
import { posix } from "node:path";

// Audited against KA-1205/cascade-zero, features, 9a270383ee3c.
const protectedFiles = new Set([
  "backend/api/__init__.py",       // Operator authentication and approval receipts.
  "backend/ai/policy.py",          // Model role and response validation.
  "backend/ai/planner.py",         // Independent risk veto on model proposals.
  "backend/coordinator/__init__.py", // Recovery selection and risk threshold.
  "backend/risk/__init__.py",      // Deterministic joint-action risk scoring.
]);

customPolicies.add({
  name: "block-recovery-guard-edits",
  description: "Block Write, Edit and MultiEdit changes to Cascade Zero's designated approval and risk guard files; require human review.",
  category: "Safety",
  defaultEnabled: true,
  match: { events: ["PreToolUse"] },
  fn: async (ctx) => {
    if (ctx.eventType !== "PreToolUse") return allow();
    if (!["Write", "Edit", "MultiEdit"].includes(ctx.toolName ?? "")) return allow();
    const raw = ctx.toolInput?.file_path;
    if (typeof raw !== "string" || !raw) return allow();
    const file = raw.replaceAll("\\", "/");
    const cwd = String(ctx.payload?.cwd ?? process.cwd()).replaceAll("\\", "/");
    const absolute = file.startsWith("/") || /^[A-Za-z]:\//.test(file);
    const normalized = posix.normalize(absolute ? file : `${cwd}/${file}`);
    const guard = [...protectedFiles].find(path => normalized.endsWith(`/${path}`));
    if (!guard) return allow();
    return deny(`Cascade Zero protects ${guard}. Do not modify its approval or risk guards with coding tools. Write a proposed patch in a separate review document and request human review; keep the existing guards active.`);
  },
});
