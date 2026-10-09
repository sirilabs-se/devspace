// Public interface of the Identity module: the only file other code may import.
export { recordAuditEvent, type AuditContext } from './audit';
export type { RequestContext } from './request-context';
export { getSessionUser, requireUser, type CookieJar, type SessionUser } from './session';
export {
	signUp,
	type SignUpErrorCode,
	type SignUpErrors,
	type SignUpField,
	type SignUpResult
} from './sign-up';
export type { UserId } from './user-id';
export {
	checkUsernameAvailable,
	type UsernameAvailability,
	type UsernameProblem
} from './username';
export {
	resendVerificationEmail,
	verifyEmail,
	type ResendVerificationResult,
	type VerifyEmailResult
} from './verify-email';
