import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface SocialAuthButtonsProps {
  onGoogleSuccess: (credential: string) => Promise<void>;
  onError?: (error: unknown) => void;
  disabled?: boolean;
}

export function SocialAuthButtons({
  onGoogleSuccess,
  onError,
  disabled = false,
}: SocialAuthButtonsProps) {
  const { t } = useTranslation();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    if (!clientId) return;

    let isMounted = true;

    function setupGoogle() {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (response.credential) {
              try {
                await onGoogleSuccess(response.credential);
              } catch (err) {
                onError?.(err);
              }
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        // Xóa nội dung cũ trước khi render lại
        if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "continue_with",
            shape: "rectangular",
            logo_alignment: "left",
            width: 320,
          });
        }

        if (isMounted) {
          setIsGsiLoaded(true);
        }
      } catch (err) {
        console.warn("Google Identity Services setup warning:", err);
      }
    }

    if (window.google?.accounts?.id) {
      setupGoogle();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          setupGoogle();
        }
      }, 150);

      const timeout = setTimeout(() => {
        clearInterval(timer);
      }, 4000);

      return () => {
        isMounted = false;
        clearInterval(timer);
        clearTimeout(timeout);
      };
    }

    return () => {
      isMounted = false;
    };
  }, [clientId, onGoogleSuccess, onError]);

  function handleCustomButtonClick() {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          onError?.(
            new Error(
              `Google One Tap không hiển thị: ${notification.getNotDisplayedReason()}`
            )
          );
        }
      });
    } else {
      onError?.(
        new Error(
          "Không thể tải Google Identity Services. Vui lòng kiểm tra kết nối mạng hoặc thử lại."
        )
      );
    }
  }

  return (
    <div className="space-y-3">
      {/* Container nút Google Identity Services */}
      <div className="flex justify-center w-full">
        <div
          ref={googleBtnRef}
          className={isGsiLoaded ? "w-full flex justify-center" : "hidden"}
        />

        {/* Nút fallback hiển thị khi GIS chưa load xong */}
        {!isGsiLoaded && (
          <Button
            type="button"
            variant="outline"
            className="w-full h-9 font-medium text-xs sm:text-sm text-fg bg-surface hover:bg-surface-muted border-border-strong transition-colors justify-center gap-2.5"
            onClick={handleCustomButtonClick}
            disabled={disabled}
          >
            <svg
              className="size-4 shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{t("auth.continueWithGoogle")}</span>
          </Button>
        )}
      </div>

      {/* Đường phân cách */}
      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-border" />
        <span className="absolute bg-surface px-2.5 text-2xs text-fg-muted uppercase tracking-wider font-medium">
          {t("auth.orDivider")}
        </span>
      </div>
    </div>
  );
}
