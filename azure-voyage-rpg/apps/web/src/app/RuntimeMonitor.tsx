"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/telemetry";

export function RuntimeMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportError("runtime.window.error", event.error ?? event.message, {
        filename: event.filename ?? "",
        line: event.lineno,
        column: event.colno,
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportError("runtime.window.unhandled_rejection", event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
