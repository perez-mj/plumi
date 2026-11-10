// src/router/routes/shared.routes.ts
import type { RouteRecordRaw } from 'vue-router';

export const sharedRoutes: RouteRecordRaw[] = [
  {
    path: 'messages',
    name: 'messages',
    component: () => import('@/views/shared/messaging/MessagesPage.vue'),
  },
  {
    path: 'meetings',
    name: 'meetings',
    component: () => import('@/views/shared/meetings/MeetingsCalendarPage.vue'),
  },
  {
    path: 'meetings/:id/room',
    name: 'meeting-room',
    component: () => import('@/views/shared/meetings/MeetingRoomPage.vue'),
  },
  {
    path: 'profile',
    name: 'profile',
    component: () => import('@/views/shared/profile/ProfilePage.vue'),
  },
];