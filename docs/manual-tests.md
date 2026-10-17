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

## Listings (#11)

At http://localhost:5173/listings

**The grid**
- [ ] Books run down the side, grouped by series in reading order. Stores run across the top. With no listings yet, all 8 stores show
- [ ] Every cell shows an icon and a word. Each status reads without color: dashed circle, circle, pencil, arrow, hourglass, filled check, crossed circle
- [ ] The legend counts what's in view, and the counts follow the filters
- [ ] Scrolling sideways moves only the grid, with the book column fixed. The page itself never scrolls sideways
- [ ] Search and the series, pen name, and stage filters work as on Books

**Quick edit**
- [ ] Clicking a cell opens a dialog for that book and store, with the current status highlighted
- [ ] One click on a status saves it and closes the dialog. A "Not listed" cell becomes listed
- [ ] "Remove from …" asks first, then the cell goes back to Not listed
- [ ] ×, Escape, and clicking the dimmed backdrop all close without saving
- [ ] Cmd- or Ctrl-click on a cell opens the listing's own page in a new tab. That page can also change status and returns you to the grid

**Which stores show**
- [ ] Once any book has a listing, only stores in use (plus any default stores in settings) show, and "Show all stores (+N)" adds the rest. "Show my stores" goes back
- [ ] KDP Select shows "Select · until <date>" in its cell. Settable once #12 adds Select fields

**Phone width**
- [ ] Under 768px each book becomes a card listing every shown store with its status, and tapping a row opens the same dialog

---

## Books (#9, #53)

At http://localhost:5173/books

**Adding books**
- [x ] The empty state explains what Books is for and offers "Add your first book"
- [x ] Add a standalone book with only a working title
- [x ] Add a book in a new series at position 1, with a pen name
- [x ] Add another book to the same series, typing the series name in different case. It should be suggested as you type
- [x ] Leave the pen name blank on a series book. The hint says it will use the series' pen name, and the list shows that pen name afterwards
- [ x] Type a different pen name on a series book. A warning explains the book will keep the pen name you entered
- [x ] Add a novella at position 2.5
- [x ] Add a book with no pen name at all

**Validation**
- [x ] Submit with no working title. A field error appears and your other entries stay filled in
- [x ] The position field is disabled until a series is entered
- [ x] Enter a position that isn't a whole number or half, such as 1.25. You get a field error. The arrows step by 0.5
- [x ] Enter more than 20 tropes. You get a field error

**Tropes**
- [x ] Type a trope and press Enter or a comma. It becomes a chip. Backspace in the empty box removes the last chip, and × removes any chip
- [ ] On a second book, typing suggests tropes from your other books. Picking one adds it straight away, in your existing spelling
- [x ] Type a trope and click Save without pressing Enter. It's still saved
- [ x] After 20 tropes the box says "Limit reached"

**Content intensity**
- [ x] The section is collapsed on a new book
- [ x] Rate only violence and language, save, and reopen the book. The section is open and only those two ratings are set
- [ x] The level labels read sensibly for your genre (note wording changes for #48)

**Books list**
- [x ] Books are grouped by series, alphabetically, each with its pen name and book count, in reading order (0.5 before 1). Standalones come last
- [x ] The Sort options (Series order, Release date, Date added) reorder books within each series, and series by their first book
- [x ] Group: None shows one flat list, with series and position in each row's details
- [x ] Refresh and Back keep the chosen sort and grouping
- [x ] "+ Add book to this series" opens the form with the series and the next position filled in
- [x ] Release dates show a countdown (in 9 days, in 4 months), and books without one say "No release date"
- [x ] At 400px wide, the controls and rows wrap with no sideways scrolling

**Search and filters (#64)**
- [ ] Typing in the search box narrows the list as you type. It matches title, series, pen name, genre, subgenre, and tropes, ignoring case and accents
- [ ] Several words must all match, for example "romance kidnapping"
- [ ] Dropdowns appear only for fields with a real choice (pen name, series, stage), with "No pen name" and "Standalones" where relevant
- [ ] "Showing N of M books · Clear filters" appears while filtering, and Clear filters resets everything except sort and grouping
- [ ] Changing sort or grouping keeps your search and filters, and refresh keeps all of it
- [ ] Searching for something that matches nothing shows "No books match" with Clear filters
- [ ] At 400px the dropdowns sit behind a "Filters" button, which shows a count when any are set

**Editing and deleting**
- [x ] Click a book in the list, change its stage and release date, and save. The list shows the new stage and date
- [x ] Tropes come back as chips
- [x ] Delete a book. A confirmation appears first, and the book is gone afterwards
- [ ] Visiting a made-up book address, such as /books/nope, shows "not found"

**Unsaved changes**
- [ ] Change a field on a book, then click a nav link. You're asked "You have unsaved changes to this book. Leave without saving?" Cancel keeps you there with your edits
- [ ] The same with the browser's Back button
- [ ] With unsaved changes, refresh or close the tab. The browser's own "Leave site?" dialog appears
- [ ] Add or remove a trope chip, or type a trope without pressing Enter. That counts as a change too
- [ ] Change a field and change it back. Leaving doesn't warn
- [ ] Save, and Delete after confirming, never trigger the warning
- [ ] A form you haven't touched never warns

**Layout**
- [ ] At about 400px wide, the list and form fit with no sideways scrolling
- [ ] In light and dark mode, text, hints, warnings, and errors are all readable
- [ ] Tab through the form. Every field shows a focus ring, in a sensible order

**Base layout (#5), if not already checked**
- [ ] Under 768px the sidebar becomes a ☰ menu, which closes on navigation and on Escape
- [ ] Tab on a fresh page shows "Skip to content" first
- [ ] Each section's empty state reads well
