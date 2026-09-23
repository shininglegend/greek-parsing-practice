import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileField({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!siteKey || !host.current) return;
    let widgetId: string | undefined;
    let cancelled = false;

    const render = () => {
      if (cancelled || !host.current || !window.turnstile) return;
      widgetId = window.turnstile.render(host.current, {
        sitekey: siteKey,
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => onTokenRef.current(""),
      });
    };

    if (window.turnstile) {
      render();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(
        "script[data-turnstile]"
      );
      if (existing) {
        existing.addEventListener("load", render);
      } else {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.dataset.turnstile = "true";
        script.onload = render;
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
      onTokenRef.current("");
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={host} className="min-h-16 shrink-0" />;
}
