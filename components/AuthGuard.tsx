"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/services/auth";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * 客户端登录守卫:真实会话在服务端 httpOnly cookie,localStorage 存镜像
 * 供此处同步读取。镜像缺失时跳回 /login,由登录页从服务端同步后再进入。
 * 服务端快照恒为 null,水合后由 useSyncExternalStore 重新同步。
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSyncExternalStore(
    subscribe,
    () => authService.getSession(),
    () => null
  );

  useEffect(() => {
    // 直接读存储判断,避免水合期间 server 快照(null)误触发重定向
    if (!authService.getSession()) router.replace("/login");
  }, [session, router]);

  if (!session) return null;
  return <>{children}</>;
}
