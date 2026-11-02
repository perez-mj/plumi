// src/router/guards.ts
import type { Router } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

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
    if (isPublic && auth.isAuthenticated && (to.name === 'login' || to.name === 'landing')) {
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
}