// src/router/index.ts
import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { publicRoutes } from './routes/public.routes';
import { adminRoutes } from './routes/admin.routes';
import { instructorRoutes } from './routes/instructor.routes';
import { studentRoutes } from './routes/student.routes';
import { sharedRoutes } from './routes/shared.routes';
import { installGuards } from './guards';

const routes: RouteRecordRaw[] = [
  ...publicRoutes,
  {
    path: '/app',
    component: () => import('@/layouts/DefaultLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      ...adminRoutes,
      ...instructorRoutes,
      ...studentRoutes,
      ...sharedRoutes,
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

installGuards(router);

export default router;