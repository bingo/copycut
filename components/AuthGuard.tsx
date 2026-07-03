"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/services/auth";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * 客户端登录守卫:session 存在 localStorage(mock),服务端无法读取,
 * 因此不用 proxy.ts 而在客户端校验。服务端快照恒为 null,
 * 水合后由 useSyncExternalStore 重新同步真实 session。
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSyncExternalStore(
    subscribe,
    () => authService.getSession(),
    () => null
  );

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  if (!session) return null;
  return <>{children}</>;
}
