import i18n from "./i18n";
import { AppError, RateLimitError } from "./api-client";

export function getErrorMessage(error: unknown): string {
  if (error instanceof RateLimitError) {
    return i18n.t("errors.RATE_LIMITED", { seconds: error.retryAfter });
  }

  if (error instanceof AppError) {
    const key = `errors.${error.code}`;
    if (i18n.exists(key)) {
      return i18n.t(key);
    }
    return error.message || i18n.t("errors.GENERIC");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return i18n.t("errors.GENERIC");
}
