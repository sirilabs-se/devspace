declare const userIdBrand: unique symbol;

/**
 * A user's ID. A distinct type, so a function that needs the acting user
 * can't be handed any other string by mistake.
 */
export type UserId = string & { readonly [userIdBrand]: true };

export function toUserId(id: string): UserId {
	return id as UserId;
}
