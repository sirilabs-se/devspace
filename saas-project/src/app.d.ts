// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionUser } from '$lib/server/modules/identity';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** The signed-in person, or null. Set once in hooks.server.ts. */
			user: SessionUser | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
