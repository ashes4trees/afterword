# Agent QA runbook

How an AI agent works through [manual-tests.md](manual-tests.md) in a real browser. This
complements the Playwright end-to-end tests (#95): the agent explores and judges (wording,
layout, flows that feel wrong), and the scripted tests guard regressions on every PR.

## Tools

The Playwright MCP server is configured in `.mcp.json`: headless Chrome with an
in-memory profile. Claude Code loads it at startup and asks once to approve it. It
provides `browser_*` tools: navigate, click, type, select, take a screenshot, read the
page, and resize the window.

## Never test as the owner

The dev server on port 5173 is the owner's, with their real books. Always test against
a second server signed in as a throwaway author:

```sh
DEV_AUTHOR_EMAIL=agent-qa-$(date +%s)@example.test DEV_AUTHOR_NAME="Agent QA" \
  npx vite dev --port 5198 --strictPort
```

Browse only `http://localhost:5198`. Create every book, listing, and idea the checklist
needs from scratch. Use made-up names, never the owner's titles or pen names.

## Running a pass

1. Start the throwaway server (above), and wait until `http://localhost:5198` responds.
2. Work through `docs/manual-tests.md` section by section, newest first. For each item:
   - do what it says in the browser
   - check the result
   - take a screenshot whenever something looks off, or when a layout item needs one
3. For "at 400px" items, resize the browser to 400×900 first, and back to 1280×900 after.
4. Browser dialogs (`confirm()`) appear as a dialog event. Accept or dismiss them as the
   step requires.
5. Don't fix anything during the pass. Record it.

## Report

End with a table per section: item, **Pass**, **Fail**, or **Couldn't test**, and a
short note. Then list:

- **Bugs**: steps to reproduce, expected and actual behavior, and a screenshot
- **UI-only polish**: candidates for the #48 checklist
- **Wording**: anything that doesn't fit the brand voice in CLAUDE.md

Don't tick boxes in `manual-tests.md`. That file is the owner's own record.

## Clean up

Stop the throwaway server, then delete the throwaway author. That cascades to everything
it created:

```sh
psql afterword -c "delete from authors where email like 'agent-qa-%@example.test'"
```
