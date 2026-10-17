/** The one confirmation for deleting a book, wherever the delete starts. */
export const confirmDeleteBook = (title: string) =>
	confirm(`Delete “${title}”? This can't be undone.`);
