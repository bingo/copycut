"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/services/auth";

/**
 * 客户端登录守卫：session 存在 localStorage（mock），服务端无法读取，
 * 因此不用 proxy.ts 而在客户端校验。
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (authService.getSession()) {
      setReady(true);
    } else {
      router.replace("/login");
    }
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
