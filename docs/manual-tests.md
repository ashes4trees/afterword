# Manual tests

Checklists for testing each screen by hand, newest first. Tick items as you go. Put
anything purely visual on the UI polish checklist (#48), and anything broken in a new
issue or straight to Claude.

## Your to-do list

What still needs you, not an agent. An agent pass (docs/agent-qa.md) has clicked
through every section below, so these are the things only a person can judge.

- [ ] **Content**: read the launch timeline, the promo ideas, and the KDP and IngramSpark
      setup steps as an author. Is the advice right, the timing realistic, anything missing?
      Merge in your own research where it differs
- [ ] **Phone** (on your home Wi-Fi): start with `npm run dev -- --host`, open the Network
      address Vite prints, and try the book form with the keyboard open, the date pickers,
      scrolling Listings, and the timeline calendar (dragging, then the Move and Add to a
      week buttons). Restart without `--host` when you're done
- [ ] **Export**: open the CSV zip from Export your data in your own spreadsheet app
- [ ] **Look and feel**: anything that bugs you goes on #48
- [ ] **Sign-off**: once you're happy, say so, and the end-to-end tests (#95) get written
      around what you approved

---

## Starting the app

```sh
npm run dev
```

Then open http://localhost:5173. Postgres.app must be running with the PostgreSQL 18
server started. You're signed in automatically as the author in `DEV_AUTHOR_EMAIL`.

---

## Listing editor (#12)

From Listings, click a cell, then "Edit price, store ID, and more →" at the bottom of the dialog. Cmd- or Ctrl-click a cell to open the editor directly in a new tab.

- [ ] An untracked listing says "You're not tracking this listing yet", and Save starts tracking it
- [ ] Status, store ID, and price with currency save and come back as entered. "4.999" or a blank currency shows a friendly error
- [ ] Amazon KDP · Ebook has a KDP Select section. Tick Enrolled and the term dates appear. Saving without an end date asks "When does this term end?"
- [ ] After saving an enrollment, "Last decision: Enrolled in KDP Select, term ending …" appears. Change the end date or untick Enrolled, and the last decision updates
- [ ] The grid cell shows "Select · until <date>"
- [ ] With your reminder window wide enough (Settings → Reminders, 30 days or more), Coming up shows "KDP Select term ends on Amazon KDP", linking back to this page
- [ ] KDP · Paperback has no KDP Select section. IngramSpark · Paperback has Bookstore terms (wholesale discount and returnable)
- [ ] "+ Add a marketplace" with a code like GB opens a GB tab with its own status and fields. Other tabs are unaffected
- [ ] "Stop tracking this listing" asks first, then returns to the grid
- [ ] Leaving with unsaved changes asks first
- [ ] Advice appears under fields on Amazon KDP · Ebook (price, KDP Select, store ID) and IngramSpark · Paperback (store ID, price, wholesale discount, returnable), each with "Advice last reviewed"

**Store setup steps (#14, #15)**
- [ ] Below the form, "Setting up on Amazon KDP" lists seven steps for an ebook, and "Setting up on IngramSpark" eight for a paperback. Other stores and formats show none yet
- [ ] Before you save the listing, the steps can be read but not ticked ("Save this listing to start ticking these off")
- [ ] After saving, tick and untick steps, skip one and bring it back. The count follows, and a refresh keeps it all
- [ ] Type in Store ID without saving, then tick a step. Your typing stays, and leaving still asks first
- [ ] On IngramSpark, the discount and returns steps say "Waiting on: an ISBN" until a store ID is saved. Steps say "Waiting on: a release date" until the book has one
- [ ] A marketplace tab shows the same steps, ticked the same way
- [ ] "Advice" opens each step's walkthrough and pitfalls. Keywords offers Publisher Rocket as a popular option

---

## Delete your account (#40)

**Only as a throwaway author** (see docs/agent-qa.md): run a second server with `DEV_AUTHOR_EMAIL=probe-<n>@example.test npx vite dev --port 5198`. Never on your own account.

- [ ] Settings → Delete your account explains what goes, links to "downloading your data", and says backups keep deleted data for up to 30 days
- [ ] A wrong email says "That isn't your account's email. Nothing was deleted."
- [ ] The right email (any case) asks once more, then shows "Your account is deleted", and the throwaway's books are gone. (The dev sign-in bypass then starts a fresh empty account with the same email. Delete that one by its exact email afterwards.)

---

## Export your data (#17)

From **Export your data** at the bottom of the sidebar.

- [ ] "Download everything (JSON)" saves `afterword-export-<date>.json`. It opens in a text editor and holds your books, pen names, series, listings, decisions, tasks, your own ideas, ideas you set aside, and your settings
- [ ] "Spreadsheets (CSV, zipped)" saves a zip that opens with one CSV per table plus `export.json` and `account.csv`. The CSVs open in a spreadsheet with titles, tropes, and dates intact
- [ ] A title that starts with "=" shows as text in the spreadsheet, not a formula

---

## Stores for a new book (#41)

At http://localhost:5173/books/new

- [ ] Your first book has a Stores section with nothing ticked
- [ ] Tick some stores and add the book. Listings shows "Not started" on each, for the formats each store sells (an ebook-only book gets nothing on ACX)
- [ ] Add another book: the same stores are ticked, with "Same as “<your last book>”"
- [ ] With books under two pen names, typing a pen name ticks the stores of your latest book under that pen name. A new pen name falls back to your latest book overall
- [ ] Once you tick or untick a store yourself, changing the pen name leaves your choice alone
- [ ] Tick "Start every new book with these stores": later books say "Your default stores", and Settings → Stores for new books lists them. "Suggest stores from my latest book instead" goes back
- [ ] Nothing is created until you click Add book, and no step anywhere asks which stores you use before you've added a book

---

## Decisions (#26)

From **Decisions** in the sidebar, and each book's **Decisions** tab.

- [ ] Enrolling in KDP Select on a listing shows up in the log, with the book, format, store, and "Committed until"
- [ ] "+ Log a decision" records a choice, a kind, an optional reason, and an optional commitment date, about one book or "All your books"
- [ ] Logging another decision of the same kind about the same book replaces the old one: it disappears from view, and "Show replaced decisions" brings it back, faded and marked "Replaced by a later decision"
- [ ] The Kind filter narrows the list
- [ ] A book's Decisions tab shows only that book's decisions, including its listings'
- [ ] A commitment date within your reminder window shows in Coming up as "Commitment ends: …", linking back to the log

---

## Timeline calendar (#112)

Open a book with a release date, then **Launch timeline → Calendar**.

- [ ] One row per week, "N weeks out", "★ Release week", "N weeks after", with dates. "This week" is marked. Empty weeks are slim rows
- [ ] Drag a step to another week: it moves, keeps its weekday, and the List view shows "date set by you"
- [ ] Drag an idea from "Ideas to drag in" onto a week: a bar asks to confirm the date (inside the idea's best timing when it overlaps) and, for repeatable ideas, how often. Add puts it on the calendar
- [ ] "Move" on a step and "Add to a week" on an idea do the same without dragging, offering this week onwards
- [ ] Done and skipped steps can't be dragged
- [ ] A book without a release date says the calendar needs one, with a link
- [ ] On your phone: the tray sits above the weeks, and the pickers work by tapping

**Dropdowns everywhere**
- [ ] Every dropdown (stage, content ratings, status, currency, returnable, filters, idea timing, how often) has the same arrow, close to its text, in light and dark mode

---

## My ideas (#91)

Open a book's **Launch timeline** tab and scroll to **Ideas → My ideas**.

- [ ] "+ Save a new idea" takes a name, an optional short note, when it fits, "Can repeat weekly", and optional timing in weeks before or after release. Saved ideas show under My ideas with their timing ("Best 4 weeks to 1 week before release")
- [ ] Timing with only one end, or an end before its start, shows a plain error and keeps what you typed
- [ ] Your ideas show on every one of your books, and add to the timeline like shared ones: a suggested date, "Weekly, N times" if repeatable, and the "Idea" tag
- [ ] "Edit" changes the idea. Copies already on a timeline keep their old name
- [ ] "Not for this book" moves it to "Ideas you've set aside", and "Bring back" restores it
- [ ] "Delete from My ideas" asks first. Copies already on a timeline stay until you remove them
- [ ] "+ Add your own step" with "Also save to My ideas" adds the step and saves the idea, timed the same distance from release when the step has a date
- [ ] A second author (another DEV_AUTHOR_EMAIL) never sees your ideas
- [ ] "Share with other authors" when saving an idea, or "and share it" on an own step, shows a "Shared" badge. Unticking it on Edit removes the badge. There's no "Suggest it" link any more

---

## Promo ideas (#84)

Open a book, then the **Launch timeline** tab, and scroll to **Ideas**.

- [ ] Ideas are grouped While you write, Before launch, Launch week, and After launch, each with a plain timing line ("Best 8 to 5 weeks before release") and a short description
- [ ] No idea appears on the timeline until you add it
- [ ] "Add to timeline" suggests a date (the start of its window, or today if that's passed). Saving adds it to the timeline in date order, tagged "Idea"
- [ ] Repeatable ideas (teaser quotes, character intros) offer "Weekly, N times" and add numbered steps a week apart, labelled (1 of 4), (2 of 4), and so on. Afterwards the idea says "On your timeline ×4" and offers "Add again"
- [ ] One-off ideas say "On your timeline" once added, with no second add
- [ ] Added ideas can be ticked, re-dated, or removed. Core steps can only be skipped
- [ ] "Not for this book" moves an idea to "Ideas you've set aside", where "Bring back" restores it
- [ ] "+ Add your own step" adds a step tagged "Your step", with an optional date
- [ ] The "Reveal your tropes" idea is a key date: once added, it shows in Coming up when it's near
- [ ] Unboxing only appears for books with a print format
- [ ] Moving the release date doesn't move or remove added ideas or your own steps

---

## Reminders and Coming up (#46)

- [ ] Home shows **Coming up**: key dates within your reminder window, soonest first, each linking to its book's timeline. Overdue key dates you haven't done show first, in amber
- [ ] Plain steps (not key dates), done or skipped steps, and dates beyond your window don't appear
- [ ] With nothing due, Home says "Nothing in the next N days"
- [ ] In **Settings → Reminders**, tick different times (for example 30 days before) and Save. "Saved." appears, and Coming up widens to match
- [ ] "Choose different times" for key dates overrides the defaults just for them
- [ ] Untick everything and save: Home says reminders are off. Overdue key dates still show, under "Reminders are off. Overdue dates still show here."
- [ ] Tick only "On the day": with nothing due today, Home says "Nothing due today", not that reminders are off
- [ ] "Hide overdue" under Coming up hides overdue items and says "N overdue dates hidden. Show". The choice sticks after a refresh, and saving Settings doesn't undo it. Show brings them back. The timeline still shows them either way
- [ ] Leaving Settings with unsaved changes asks first
- [ ] Opening Settings from Home's "Reminder settings" link and saving takes you back to Home. Opening it from the sidebar and saving stays on Settings and shows "Saved."

---

## Launch timeline (#45)

Open a book, then the **Launch timeline** tab.

- [ ] A book with a release date shows 11 dated steps counting back from it, with a "Key date" label on the big moments. Steps already in the past are outlined in amber as overdue
- [ ] Add a book releasing in a week or two: key dates that had already passed show as "Skipped: this date had passed when you added the book", and stay out of Coming up. "Bring back" puts one back as overdue. Plain steps that have passed still show as overdue
- [ ] A book without a release date shows the steps undated, with a link to add a release date
- [ ] Ticking a step marks it done and strikes it through. Ticking again undoes it. A step waiting on it ("Waiting on: …") stops waiting
- [ ] "Skip for this book" greys a step out, and "Bring back" restores it
- [ ] "Change date" sets your own date, labelled "date set by you". Move the book's release date: that step stays put and the rest move. "Back to the schedule" puts it back on the schedule
- [ ] "Advice" expands the step's details and pitfalls (the KDP 72-hour rule on the preorder step), plus "Popular options" links on some steps that open in a new tab
- [ ] The footer says "Advice last reviewed <date>"
- [ ] The ebook-only steps (preorder, final files) disappear for a print-only or audio-only book
- [ ] At 400px everything wraps and stays usable

---

## Listings (#11)

At http://localhost:5173/listings

**The grid**
- [ ] Books run down the side, grouped by series in reading order. Stores run across the top. With no stores hidden, all 11 show
- [ ] Every cell shows an icon and a word. Each status reads without color: dashed circle, circle, pencil, arrow, hourglass, filled check, crossed circle
- [ ] The legend counts what's in view, and the counts follow the filters
- [ ] Scrolling sideways moves only the grid, with the book column fixed. The page itself never scrolls sideways
- [ ] Search and the series, pen name, and stage filters work as on Books

**Formats (#72)**
- [ ] Each book shows a row per format it's published in. Change a book's Formats on its edit page and the rows follow
- [ ] Cells where a store doesn't sell that format show a faint "—" and aren't clickable, for example Kobo · Paperback or ACX · Ebook
- [ ] On Amazon KDP, set Ebook to Live and Paperback to In review: two separate cells, two separate statuses
- [ ] Remove a format from a book that has listings in it: the row stays until those listings are removed
- [ ] New books start with Ebook and Paperback ticked, and saving with no format shows an error

**Quick edit**
- [ ] Clicking a cell opens a dialog for that book and store, with the current status highlighted
- [ ] One click on a status saves it and closes the dialog. A "Not listed" cell becomes listed
- [ ] "Remove from …" asks first, then the cell goes back to Not listed
- [ ] ×, Escape, and clicking the dimmed backdrop all close without saving
- [ ] Cmd- or Ctrl-click on a cell opens the listing's own page in a new tab. That page can also change status and returns you to the grid

**Which stores show**
- [ ] All stores show until you hide some, even after listing a book somewhere
- [ ] The Stores menu lists every store with a checkbox, and marks stores that have listings. Untick Kobo and Save: its column disappears, and the button says "Stores (1 hidden)"
- [ ] Tick Kobo again and Save: it comes back, along with any listings it had
- [ ] Unticking every store and saving shows "Keep at least one store."
- [ ] "Only show stores in use" at the top of the Stores menu narrows the grid to stores where some book has a listing, and the button says "Stores (in use)". It still respects hidden stores, follows new listings as you add them, and clicking it again turns it off
- [ ] The choice sticks after a refresh and a restart
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
