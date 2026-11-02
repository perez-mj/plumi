import type { RouteRecordRaw } from 'vue-router';

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: 'admin',
    redirect: { name: 'admin-dashboard' },
    meta: { requiresRole: 'admin' },
  },
  {
    path: 'admin/dashboard',
    name: 'admin-dashboard',
    component: () => import('@/views/admin/AdminDashboardPage.vue'),
    meta: { requiresRole: 'admin' },
  },
  {
    path: 'admin/users',
    name: 'admin-users',
    component: () => import('@/views/admin/UsersPage.vue'),
    meta: { requiresRole: 'admin' },
  },
  {
    path: 'admin/users/:id',
    name: 'admin-user-detail',
    component: () => import('@/views/admin/UserDetailPage.vue'),
    meta: { requiresRole: 'admin' },
  },
  {
    path: 'admin/announcements',
    name: 'admin-announcements',
    component: () => import('@/views/admin/AnnouncementsPage.vue'),
    meta: { requiresRole: 'admin' },
  },
  {
    path: 'admin/courses',
    name: 'admin-courses',
    component: () => import('@/views/admin/CoursesOverviewPage.vue'),
    meta: { requiresRole: 'admin' },
  },
  {
    path: 'admin/activity',
    name: 'admin-activity',
    component: () => import('@/views/admin/ActivityLogsPage.vue'),
    meta: { requiresRole: 'admin' },
  },
];