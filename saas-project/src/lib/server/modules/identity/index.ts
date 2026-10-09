// Public interface of the Identity module: the only file other code may import.
export { recordAuditEvent, type AuditContext } from './audit';
export { changePassword, signOutEverywhere, type ChangePasswordResult } from './change-password';
export { logIn, logOut, type LogInResult } from './log-in';
export {
	requestPasswordReset,
	resetPassword,
	resetPasswordLinkState,
	type RequestPasswordResetResult,
	type ResetLinkState,
	type ResetPasswordResult
} from './password-reset';
export type { RateLimitResult } from './rate-limit';
export type { RequestContext } from './request-context';
export { limitRequests, type RequestLimit } from './request-limits';
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
