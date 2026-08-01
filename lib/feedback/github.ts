// Optional GitHub issue creation for submitted feedback.
//
// Entirely env-gated: with GITHUB_FEEDBACK_REPO / GITHUB_TOKEN unset this is a
// silent no-op. It NEVER throws — any API failure returns null. By the time this
// runs the feedback row is already persisted, and a report must not be lost
// because GitHub was down, rate-limited, or missing a label.
//
// Note: the labels below must already exist in the target repo. GitHub returns
// 422 for unknown labels at creation time, which degrades here to "no issue
// created" (a warning in the server log), not a failed submit.

import type { Feedback } from "../domain/types";

const ISSUE_TIMEOUT_MS = 5000;

function firstLine(message: string): string {
  const line = message.split("\n")[0].trim();
  return line.length > 72 ? `${line.slice(0, 69)}…` : line;
}

// The context block appended under the message. Deliberately carries the
// feedback row id and NOT the user id: the id is enough to join back to the
// table, without putting a user identifier in a (potentially public) issue.
function issueBody(fb: Feedback): string {
  const context = [
    ["Route", fb.path],
    ["App version", fb.appVersion],
    ["Session", fb.sessionId],
    ["Rating", fb.rating != null ? `${fb.rating}/5` : null],
    ["Feedback id", fb.id],
    ["Submitted", fb.createdAt],
    ["User agent", fb.userAgent],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `- **${k}:** ${v}`)
    .join("\n");

  return `${fb.message}\n\n---\n\n_Submitted from the app._\n\n${context}\n`;
}

export async function createFeedbackIssue(
  fb: Feedback,
): Promise<{ number: number; url: string } | null> {
  const repo = process.env.GITHUB_FEEDBACK_REPO?.trim();
  const token = process.env.GITHUB_TOKEN?.trim();
  // Unconfigured is the expected default, not an error — say nothing.
  if (!repo || !token) return null;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `[${fb.category}] ${firstLine(fb.message)}`,
        body: issueBody(fb),
        labels: ["feedback", `feedback:${fb.category}`],
      }),
      signal: AbortSignal.timeout(ISSUE_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(
        `Feedback issue creation failed: ${res.status} ${res.statusText}. ` +
          `Check that the labels "feedback" and "feedback:${fb.category}" exist in ${repo}.`,
      );
      return null;
    }

    const json = (await res.json()) as { number: number; html_url: string };
    return { number: json.number, url: json.html_url };
  } catch (err) {
    console.warn("Feedback issue creation failed:", err);
    return null;
  }
}
