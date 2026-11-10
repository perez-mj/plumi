// src/router/guards.ts
import type { Router } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const APP_NAME = 'Plumi';

function setTitle(title?: string) {
  const fullTitle = title ? `${title} · ${APP_NAME}` : APP_NAME;
  document.title = fullTitle;
  // keep iOS PWA name in sync (optional)
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.setAttribute('content', fullTitle);
}

const ROLE_HOME: Record<string, string> = {
  admin: 'admin-dashboard',
  instructor: 'instructor-dashboard',
  student: 'student-dashboard',
};

export function installGuards(router: Router) {
  router.beforeEach(async (to) => {
    const auth = useAuthStore();
    if (!auth.ready) await auth.init();

    const needsAuth = to.matched.some((r) => r.meta.requiresAuth);
    const isPublic = to.matched.some((r) => r.meta.public);
    const requiredRole = to.matched.find((r) => r.meta.requiresRole)?.meta.requiresRole as string | undefined;

    // 1. Redirect unauthenticated users away from protected routes
    if (needsAuth && !auth.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }

    // 2. Redirect logged-in users away from login/landing
    //    (NOT from reset-password or auth-callback — recovery sessions are
    //    technically "authenticated" but must stay on those pages.)
    const noRedirect = to.name === 'reset-password' || to.name === 'auth-callback';
    if (isPublic && auth.isAuthenticated && !noRedirect && (to.name === 'login' || to.name === 'landing')) {
      const home = ROLE_HOME[auth.role ?? 'student'] ?? 'student-dashboard';
      return { name: home };
    }

    // 3. Bare /app → role-specific dashboard (this replaces the role-home virtual route)
    if (auth.isAuthenticated && (to.path === '/app' || to.path === '/app/')) {
      const home = ROLE_HOME[auth.role ?? 'student'] ?? 'student-dashboard';
      return { name: home, replace: true };
    }

    // 4. Role mismatch → send to own dashboard
    if (requiredRole && auth.role !== requiredRole) {
      const home = ROLE_HOME[auth.role ?? 'student'] ?? 'student-dashboard';
      return { name: home, replace: true };
    }

    return true;
  });

  router.afterEach((to) => {
    // `to.meta` is the merged meta of the deepest matched route,
    // so this "just works" for nested children too.
    setTitle(to.meta.title as string | undefined);
  });
}