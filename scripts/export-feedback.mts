// Exports the feedback log from Supabase for triage and prioritization.
// Run AFTER applying supabase/migrations/0005_feedback.sql in the Supabase SQL editor.
//
//   npx tsx scripts/export-feedback.mts                     # markdown, all rows
//   npx tsx scripts/export-feedback.mts --status=new        # only untriaged
//   npx tsx scripts/export-feedback.mts --format=csv > feedback.csv
//
// Writes to stdout only, so the caller decides where it lands. The row count goes
// to stderr so it never pollutes a redirected file. Reads NEXT_PUBLIC_SUPABASE_URL
// + SUPABASE_SERVICE_ROLE_KEY from .env.local.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader (this runs outside Next, which normally injects these).
function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* no .env.local — rely on the ambient environment */
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function arg(name: string, fallback: string): string {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const format = arg("format", "md");
const status = arg("status", "all");

if (!["md", "csv"].includes(format)) {
  console.error(`Unknown --format=${format} (expected md or csv)`);
  process.exit(1);
}
if (!["all", "new", "triaged", "done"].includes(status)) {
  console.error(`Unknown --status=${status} (expected all, new, triaged or done)`);
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

let query = db
  .from("feedback")
  .select("*")
  .order("created_at", { ascending: false });
if (status !== "all") query = query.eq("status", status);

const { data, error } = await query;

if (error) {
  console.error("Export failed:", error.message);
  console.error("Did you apply supabase/migrations/0005_feedback.sql first?");
  process.exit(1);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows: any[] = data ?? [];

if (format === "csv") {
  const cols = [
    "id",
    "created_at",
    "category",
    "status",
    "rating",
    "path",
    "app_version",
    "session_id",
    "github_issue_url",
    "message",
  ];
  // Wrap every value and double any inner quotes; newlines inside a quoted field
  // are valid CSV, so multi-line messages survive intact.
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  console.log(cols.join(","));
  for (const r of rows) console.log(cols.map((c) => cell(r[c])).join(","));
} else {
  const GROUPS: [string, string][] = [
    ["bug", "Bugs"],
    ["idea", "Ideas"],
    ["exercise-request", "Exercise requests"],
    ["other", "Other"],
  ];

  const scope = status === "all" ? "" : ` — ${status}`;
  console.log(`# Feedback export${scope} (${rows.length} items)\n`);

  for (const [category, heading] of GROUPS) {
    const group = rows.filter((r) => r.category === category);
    if (group.length === 0) continue;
    console.log(`## ${heading} (${group.length})\n`);
    for (const r of group) {
      const title = String(r.message).split("\n")[0].trim().slice(0, 72);
      console.log(`### ${title}\n`);
      console.log(
        String(r.message)
          .split("\n")
          .map((l: string) => `> ${l}`)
          .join("\n") + "\n",
      );
      const meta = [
        ["Status", r.status],
        ["Submitted", r.created_at],
        ["Route", r.path],
        ["App version", r.app_version],
        ["Rating", r.rating != null ? `${r.rating}/5` : null],
        ["Session", r.session_id],
        ["Issue", r.github_issue_url],
        ["Id", r.id],
      ].filter(([, v]) => v);
      for (const [k, v] of meta) console.log(`- **${k}:** ${v}`);
      console.log("");
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

console.error(`${rows.length} rows`);
