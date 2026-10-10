// Public interface of the Identity module: the only file other code may import.
export {
	exportAuditEvents,
	listAuditEvents,
	type AuditEntry,
	type AuditFilters,
	type AuditListResult
} from './admin-audit';
export {
	ADMIN_PAGE_SIZE,
	getUserForAdmin,
	reinstateUser,
	searchUsers,
	suspendUser,
	type AdminUserDetails,
	type AdminUserSummary,
	type ReinstateUserResult,
	type SuspendUserResult,
	type UserSearchResult
} from './admin';
export { listSecurityActivity, type SecurityActivity } from './activity';
export { recordAuditEvent, type AuditContext } from './audit';
export {
	AVATAR_MAX_BYTES,
	readAvatar,
	removeAvatar,
	setAvatar,
	type SetAvatarResult
} from './avatar';
export {
	canUndoEmailChange,
	EMAIL_CHANGE_UNDO_DAYS,
	requestEmailChange,
	undoEmailChange,
	type RequestEmailChangeResult,
	type UndoEmailChangeResult
} from './change-email';
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
export { recogniseDevice, type DeviceRecognition } from './device-recognition';
export {
	DELETION_GRACE_DAYS,
	onUserDeleted,
	requestAccountDeletion,
	runDailyJob,
	type DailyJobResult,
	type RequestDeletionResult
} from './deletion';
export {
	startImpersonation,
	stopImpersonation,
	type StartImpersonationResult
} from './impersonation';
export { logIn, logOut, type LogInResult } from './log-in';
export {
	listPasskeys,
	removePasskey,
	renamePasskey,
	type PasskeySummary,
	type RemovePasskeyResult
} from './passkeys';
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
export {
	getSessionUser,
	requireRole,
	requireUser,
	type CookieJar,
	type Role,
	type SessionUser
} from './session';
export {
	endSession,
	listActiveSessions,
	type ActiveSession,
	type EndSessionResult
} from './sessions';
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
export {
	completeTwoStepLogin,
	confirmTwoStepSetup,
	hasTwoStepChallenge,
	isTwoStepOn,
	regenerateBackupCodes,
	sendTwoStepEmailCode,
	startTwoStepSetup,
	turnOffTwoStep,
	type CompleteTwoStepLoginResult,
	type StartTwoStepSetupResult,
	type TwoStepMethod
} from './two-step';
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
