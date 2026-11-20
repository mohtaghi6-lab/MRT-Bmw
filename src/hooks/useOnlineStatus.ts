import { useEffect, useState } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isOfflineReady, setIsOfflineReady] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean((window as unknown as { __bmwOfflineReady?: boolean }).__bmwOfflineReady);
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleOfflineReady = () => setIsOfflineReady(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("bmw-sw-offline-ready", handleOfflineReady);

    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("bmw-sw-offline-ready", handleOfflineReady);
    };
  }, []);

  return { isOnline, isOfflineReady };
}
