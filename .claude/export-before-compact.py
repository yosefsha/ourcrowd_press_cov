#!/usr/bin/env python3
"""PreCompact / SessionEnd hook: renders the session's JSONL transcript as a
plain-text conversation export (like /export) into
docs/ai-prompts/<date>-<session-id>.md of the primary checkout.

The transcript JSONL always holds the whole session, so each run overwrites the
session's file with a complete, current copy instead of appending duplicates.
Sessions running in a git worktree still write to the primary checkout, so every
transcript ends up in one place on main."""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

SCRIPT_CHECKOUT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_SUBDIR = os.path.join("docs", "ai-prompts")

SKIP_TYPES = {
    "mode",
    "permission-mode",
    "file-history-snapshot",
    "system",
    "ai-title",
    "last-prompt",
    "attachment",
}


def resolve_transcript_path(payload: dict) -> str:
    path = payload.get("transcript_path") or ""
    if path and os.path.exists(path):
        return path

    session_id = payload.get("session_id") or ""
    cwd = payload.get("cwd") or ""
    if not session_id or not cwd:
        return path

    project_dir = re.sub(r"[^A-Za-z0-9]", "-", cwd)
    fallback = os.path.join(
        os.path.expanduser("~"), ".claude", "projects", project_dir, f"{session_id}.jsonl"
    )
    return fallback if os.path.exists(fallback) else path


def resolve_primary_checkout() -> str:
    """The main working tree, even when this script runs from a linked worktree."""
    try:
        common_dir = subprocess.run(
            ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
            cwd=SCRIPT_CHECKOUT,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    except Exception:
        return SCRIPT_CHECKOUT
    return os.path.dirname(common_dir) if os.path.basename(common_dir) == ".git" else SCRIPT_CHECKOUT


def session_date(transcript_path: str) -> str:
    """Date of the session's first timestamped entry, so the filename is stable across runs."""
    try:
        with open(transcript_path, "r") as fp:
            for line in fp:
                try:
                    timestamp = json.loads(line).get("timestamp")
                except Exception:
                    continue
                if timestamp:
                    return timestamp[:10]
    except Exception:
        pass
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def truncate(text: str, limit: int = 500) -> str:
    text = text if isinstance(text, str) else json.dumps(text)
    return text if len(text) <= limit else text[:limit] + "... [truncated]"


def render_content_block(block) -> str:
    if not isinstance(block, dict):
        return truncate(str(block))

    block_type = block.get("type")
    if block_type == "text":
        return block.get("text", "")
    if block_type == "thinking":
        thinking_text = block.get("thinking", "")
        return f"[thinking] {thinking_text}" if thinking_text else ""
    if block_type == "tool_use":
        return f"[tool_call] {block.get('name')}({json.dumps(block.get('input', {}), separators=(',', ':'))})"
    if block_type == "tool_result":
        return f"[tool_result for {block.get('tool_use_id')}] {truncate(block.get('content'))}"
    return truncate(block)


def is_skippable_user_text(text: str) -> bool:
    return text.startswith("<local-command-caveat>") or text.startswith("<command-name>")


def render_entry(entry: dict) -> str:
    entry_type = entry.get("type")
    if entry_type not in ("user", "assistant"):
        return ""
    if entry.get("isMeta"):
        return ""

    message = entry.get("message") or {}
    content = message.get("content")
    timestamp = entry.get("timestamp", "")
    role_label = "User" if entry_type == "user" else "Assistant"

    if isinstance(content, str):
        if entry_type == "user" and is_skippable_user_text(content):
            return ""
        return f"### {role_label} [{timestamp}]\n{content}\n"

    if isinstance(content, list):
        rendered_blocks = [render_content_block(b) for b in content]
        rendered_blocks = [b for b in rendered_blocks if b]
        if not rendered_blocks:
            return ""
        return f"### {role_label} [{timestamp}]\n" + "\n".join(rendered_blocks) + "\n"

    return ""


def render_transcript(transcript_path: str) -> str:
    if not transcript_path or not os.path.exists(transcript_path):
        return f"[no transcript found at '{transcript_path}']\n"

    sections = []
    with open(transcript_path, "r") as fp:
        for line in fp:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except Exception:
                continue
            if entry.get("type") in SKIP_TYPES:
                continue
            rendered = render_entry(entry)
            if rendered:
                sections.append(rendered)

    return "\n".join(sections) if sections else "[transcript had no renderable turns]\n"


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except Exception as exc:
        print(f"export-before-compact: failed to parse hook input: {exc}", file=sys.stderr)
        sys.exit(0)

    session_id = re.sub(r"[^A-Za-z0-9-]", "", payload.get("session_id") or "") or "unknown"
    event = payload.get("hook_event_name", "unknown")
    reason = payload.get("trigger") or payload.get("reason") or "unknown"
    transcript_path = resolve_transcript_path(payload)
    now = datetime.now(timezone.utc).isoformat()

    header = f"# AI session transcript\n\nsession={session_id} | last export: {event} ({reason}) | {now}\n\n"
    body = render_transcript(transcript_path)

    output_dir = os.path.join(resolve_primary_checkout(), OUTPUT_SUBDIR)
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, f"{session_date(transcript_path)}-{session_id}.md")
    temp_file = f"{output_file}.tmp"
    with open(temp_file, "w") as fp:
        fp.write(header)
        fp.write(body)
    os.replace(temp_file, output_file)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"export-before-compact: unexpected error: {exc}", file=sys.stderr)
    sys.exit(0)
