# Manual tests

Checklists for testing each screen by hand, newest first. Tick items as you go. Put
anything purely visual on the UI polish checklist (#48), and anything broken in a new
issue or straight to Claude.

## Starting the app

```sh
npm run dev
```

Then open http://localhost:5173. Postgres.app must be running with the PostgreSQL 18
server started. You're signed in automatically as the author in `DEV_AUTHOR_EMAIL`.

---

## Books (#9, #53)

At http://localhost:5173/books

**Adding books**
- [ ] The empty state explains what Books is for and offers "Add your first book"
- [ ] Add a standalone book with only a working title
- [ ] Add a book in a new series at position 1, with a pen name
- [ ] Add another book to the same series, typing the series name in different case. It should be suggested as you type
- [ ] Leave the pen name blank on a series book. The hint says it will use the series' pen name, and the list shows that pen name afterwards
- [ ] Type a different pen name on a series book. A warning explains the book will keep the pen name you entered
- [ ] Add a novella at position 2.5
- [ ] Add a book with no pen name at all

**Validation**
- [ ] Submit with no working title. A field error appears and your other entries stay filled in
- [ ] The position field is disabled until a series is entered
- [ ] Enter a position that isn't a whole number or half, such as 1.25. You get a field error. The arrows step by 0.5
- [ ] Enter more than 20 tropes. You get a field error

**Tropes**
- [ ] Type a trope and press Enter or a comma. It becomes a chip. Backspace in the empty box removes the last chip, and × removes any chip
- [ ] On a second book, typing suggests tropes from your other books. Picking one adds it straight away, in your existing spelling
- [ ] Type a trope and click Save without pressing Enter. It's still saved
- [ ] After 20 tropes the box says "Limit reached"

**Content intensity**
- [ ] The section is collapsed on a new book
- [ ] Rate only violence and language, save, and reopen the book. The section is open and only those two ratings are set
- [ ] The level labels read sensibly for your genre (note wording changes for #48)

**Books list**
- [ ] Books are grouped by series, alphabetically, each with its pen name and book count, in reading order (0.5 before 1). Standalones come last
- [ ] The Sort options (Series order, Release date, Date added) reorder books within each series, and series by their first book
- [ ] Group: None shows one flat list, with series and position in each row's details
- [ ] Refresh and Back keep the chosen sort and grouping
- [ ] "+ Add book to this series" opens the form with the series and the next position filled in
- [ ] Release dates show a countdown (in 9 days, in 4 months), and books without one say "No release date"
- [ ] At 400px wide, the controls and rows wrap with no sideways scrolling

**Editing and deleting**
- [ ] Click a book in the list, change its stage and release date, and save. The list shows the new stage and date
- [ ] Tropes come back as chips
- [ ] Delete a book. A confirmation appears first, and the book is gone afterwards
- [ ] Visiting a made-up book address, such as /books/nope, shows "not found"

**Layout**
- [ ] At about 400px wide, the list and form fit with no sideways scrolling
- [ ] In light and dark mode, text, hints, warnings, and errors are all readable
- [ ] Tab through the form. Every field shows a focus ring, in a sensible order

**Base layout (#5), if not already checked**
- [ ] Under 768px the sidebar becomes a ☰ menu, which closes on navigation and on Escape
- [ ] Tab on a fresh page shows "Skip to content" first
- [ ] Each section's empty state reads well
