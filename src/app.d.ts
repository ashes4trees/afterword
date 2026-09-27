// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionAuthor } from '$lib/server/auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Set by hooks.server.ts. Read the author from here, never from a global or constant. */
			author: SessionAuthor | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
