// src/common/exceptions/error-codes.ts

/**
 * Danh mục toàn bộ error code nghiệp vụ dùng xuyên app. FE dùng đúng các giá trị string này
 * làm key trong bảng i18n của họ — đổi giá trị ở đây là breaking change với FE, cân nhắc kỹ.
 */
export const ErrorCode = {
  // ---- Generic (khớp nhóm HTTP status, dùng khi không có mã cụ thể hơn) ----
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // ---- Auth ----
  AUTH_EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TENANT_MISMATCH: 'AUTH_TENANT_MISMATCH',
  AUTH_NO_TENANT_MEMBERSHIP: 'AUTH_NO_TENANT_MEMBERSHIP',
  AUTH_NO_ACTIVE_MEMBERSHIP: 'AUTH_NO_ACTIVE_MEMBERSHIP',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',
  AUTH_REFRESH_TOKEN_REUSED: 'AUTH_REFRESH_TOKEN_REUSED',
  AUTH_REFRESH_TOKEN_EXPIRED: 'AUTH_REFRESH_TOKEN_EXPIRED',
  AUTH_GOOGLE_TOKEN_INVALID: 'AUTH_GOOGLE_TOKEN_INVALID',
  AUTH_GOOGLE_TOKEN_MISSING_CLAIMS: 'AUTH_GOOGLE_TOKEN_MISSING_CLAIMS',

  // ---- Invitation ----
  INVITATION_NOT_FOUND: 'INVITATION_NOT_FOUND',
  INVITATION_ALREADY_ACCEPTED: 'INVITATION_ALREADY_ACCEPTED',
  INVITATION_REVOKED: 'INVITATION_REVOKED',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_PASSWORD_REQUIRED: 'INVITATION_PASSWORD_REQUIRED',
  INVITATION_ALREADY_MEMBER: 'INVITATION_ALREADY_MEMBER',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Mapping ErrorCode sang default message tiếng Anh cho backend log/developer.
 */
export const ErrorMessage: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Validation error',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not found',
  CONFLICT: 'Conflict',
  UNPROCESSABLE_ENTITY: 'Unprocessable entity',
  INTERNAL_ERROR: 'Internal error',

  AUTH_EMAIL_TAKEN: 'Email is already in use',
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password',
  AUTH_TENANT_MISMATCH: 'Not a member of this organization',
  AUTH_NO_TENANT_MEMBERSHIP: 'Account is not a member of any organization',
  AUTH_NO_ACTIVE_MEMBERSHIP: 'No active membership found',
  AUTH_REFRESH_TOKEN_INVALID: 'Invalid refresh token',
  AUTH_REFRESH_TOKEN_REUSED: 'Refresh token has already been used',
  AUTH_REFRESH_TOKEN_EXPIRED: 'Refresh token has expired',
  AUTH_GOOGLE_TOKEN_INVALID: 'Invalid or expired Google ID token',
  AUTH_GOOGLE_TOKEN_MISSING_CLAIMS: 'Google ID token is missing required claims',

  INVITATION_NOT_FOUND: 'Invitation not found',
  INVITATION_ALREADY_ACCEPTED: 'Invitation has already been accepted',
  INVITATION_REVOKED: 'Invitation has been revoked',
  INVITATION_EXPIRED: 'Invitation has expired',
  INVITATION_PASSWORD_REQUIRED: 'Password is required to create a new account',
  INVITATION_ALREADY_MEMBER: 'You are already a member of this organization',
};
