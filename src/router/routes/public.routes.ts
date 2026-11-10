// src/router/routes/public.routes.ts
import type { RouteRecordRaw } from 'vue-router';

export const publicRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/public/LandingPage.vue'),
    meta: { public: true, title: 'Welcome' },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/public/LoginPage.vue'),
    meta: { public: true, title: 'Sign In' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/public/RegisterPage.vue'),
    meta: { public: true, title: 'Create Account' },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/public/ForgotPasswordPage.vue'),
    meta: { public: true, title: 'Reset Password' },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/views/public/ResetPasswordPage.vue'),
    meta: { public: true, title: 'Set New Password' },
  },
  {
    // Supabase appends #access_token=... or ?code=... to this route
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('@/views/public/AuthCallbackPage.vue'),
    meta: { public: true, title: 'Verifying' },
  },
];