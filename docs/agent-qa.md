# Agent QA runbook

How an AI agent works through [manual-tests.md](manual-tests.md) in a real browser. This
complements the Playwright end-to-end tests (#95): the agent explores and judges (wording,
layout, flows that feel wrong), and the scripted tests guard regressions on every PR.

## Tools

The Playwright MCP server is configured in `.mcp.json`: headless Chrome with an
in-memory profile. Claude Code loads it at startup and asks once to approve it. It
provides `browser_*` tools: navigate, click, type, select, take a screenshot, read the
page, and resize the window.

## Tips from the first pass

- Wait for each page to finish loading (`waitUntil: 'networkidle'`) before typing. The dev
  server loads code lazily, and a too-early click can submit before the page is ready.
- The browser tool answers `confirm()` and "Leave site?" prompts on its own. To check a
  prompt's wording, replace `window.confirm` in the page with one that records the message.
- Navigate between app pages by clicking links, not by typing addresses. Typed addresses
  make Back a full page change, which behaves differently from in-app Back.
- Snapshots land in `.playwright-mcp/`, which git ignores.

## Tips from the second pass

- Never `page.goto()` away from a form you've changed. The page's "Leave site?" prompt
  takes over the browser tool, and every later step fails until it's answered, sometimes
  several times. Navigate in-app instead, with `window.confirm` stubbed:

  ```js
  const go = async (p) => {
    await page.evaluate((path) => {
      window.confirm = () => true;
      const a = document.createElement('a');
      a.href = path;
      document.body.append(a);
      a.click();
      a.remove();
    }, p);
    await page.waitForURL((u) => u.pathname + u.search === p);
    await page.waitForLoadState('networkidle');
  };
  ```

- Start each script with `page.setDefaultTimeout(8000)`. A step with no timeout once hung
  the tool for an hour.
- If the tool gets stuck on a dialog, `browser_close` and navigate again. It's quicker
  than answering prompts one by one.
- Keep scripts short and return results often. A failed step loses everything the
  script collected.
- Never use Playwright's `dragTo()`. Native drag and drop stalls it in this headless
  browser and hangs the tool. Fire the events the page listens for instead:

  ```js
  const dt = await page.evaluateHandle(() => new DataTransfer());
  for (const [el, type] of [[source, 'dragstart'], [target, 'dragover'], [target, 'drop'], [source, 'dragend']])
    await el.dispatchEvent(type, { dataTransfer: dt });
  ```

- `getByLabel` matches `aria-label` on buttons too (setup steps' "Mark … done"). Prefer
  `input[name=…]` for form fields.

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

Stop the throwaway server, then delete the throwaway author **by its exact email**, never
by a pattern (CLAUDE.md: never delete by a broad filter). That cascades to everything it
created:

```sh
echo "delete from authors where email = 'agent-qa-<n>@example.test' returning id, email;" \
  | psql -v ON_ERROR_STOP=1 afterword
```

Delete-account testing (#40) leaves one more: the dev bypass recreates an empty author
with the same email on the next request. Delete that one too, the same way.
