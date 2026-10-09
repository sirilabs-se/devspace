/** Where a request came from, recorded with audit entries. */
export type RequestContext = {
	ipAddress: string | null;
	userAgent: string | null;
};
