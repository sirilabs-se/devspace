// Public interface of the Identity module: the only file other code may import.
export { recordAuditEvent, type AuditContext } from './audit';
export {
	AVATAR_MAX_BYTES,
	readAvatar,
	removeAvatar,
	setAvatar,
	type SetAvatarResult
} from './avatar';
export { changePassword, signOutEverywhere, type ChangePasswordResult } from './change-password';
export {
	listConnections,
	setFirstPassword,
	startLinkingProvider,
	unlinkProvider,
	type Connections,
	type SetFirstPasswordResult,
	type UnlinkProviderResult
} from './connections';
export { logIn, logOut, type LogInResult } from './log-in';
export {
	requestPasswordReset,
	resetPassword,
	resetPasswordLinkState,
	type RequestPasswordResetResult,
	type ResetLinkState,
	type ResetPasswordResult
} from './password-reset';
export {
	getContactDetails,
	getProfile,
	getPublicProfiles,
	LOCALES,
	timeZones,
	updateProfile,
	type ContactDetails,
	type Locale,
	type Profile,
	type PublicProfile,
	type UpdateProfileResult
} from './profile';
export type { RateLimitResult } from './rate-limit';
export type { RequestContext } from './request-context';
export { limitRequests, type RequestLimit } from './request-limits';
export { getSessionUser, requireUser, type CookieJar, type SessionUser } from './session';
export {
	completeWelcome,
	handleAuthRequest,
	socialProviders,
	startSocialSignIn,
	type CompleteWelcomeResult,
	type SocialProvider
} from './social';
export {
	signUp,
	type SignUpErrorCode,
	type SignUpErrors,
	type SignUpField,
	type SignUpResult
} from './sign-up';
export type { UserId } from './user-id';
export {
	changeUsername,
	checkUsernameAvailable,
	USERNAME_CHANGE_DAYS,
	usernameChangeAllowedAt,
	type ChangeUsernameResult,
	type UsernameAvailability,
	type UsernameProblem
} from './username';
export {
	resendVerificationEmail,
	verifyEmail,
	type ResendVerificationResult,
	type VerifyEmailResult
} from './verify-email';
