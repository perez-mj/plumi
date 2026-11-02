// src/router/routes/instructor.routes.ts
import type { RouteRecordRaw } from 'vue-router';

export const instructorRoutes: RouteRecordRaw[] = [
  {
    path: 'instructor',
    redirect: { name: 'instructor-dashboard' },
    meta: { requiresRole: 'instructor' },
  },
  {
    path: 'instructor/dashboard',
    name: 'instructor-dashboard',
    component: () => import('@/views/instructor/InstructorDashboardPage.vue'),
    meta: { requiresRole: 'instructor' },
  },
  {
    path: 'instructor/courses',
    name: 'instructor-courses',
    component: () => import('@/views/instructor/courses/MyCoursesPage.vue'),
    meta: { requiresRole: 'instructor' },
  },
  {
    path: 'instructor/courses/new',
    name: 'instructor-course-new',
    component: () => import('@/views/instructor/courses/CourseEditorPage.vue'),
    meta: { requiresRole: 'instructor' },
  },
  {
    path: 'instructor/courses/:id/edit',
    name: 'instructor-course-edit',
    component: () => import('@/views/instructor/courses/CourseEditorPage.vue'),
    meta: { requiresRole: 'instructor' },
  },
  {
    path: 'instructor/courses/:id/content',
    name: 'instructor-course-content',
    component: () => import('@/views/instructor/courses/CourseContentPage.vue'),
    meta: { requiresRole: 'instructor' },
  },
  {
    path: 'instructor/courses/:id/roster',
    name: 'instructor-course-roster',
    component: () => import('@/views/instructor/courses/CourseRosterPage.vue'),
    meta: { requiresRole: 'instructor' },
  },
  {
    path: 'instructor/courses/:id/announcements',
    name: 'instructor-course-announcements',
    component: () => import('@/views/instructor/courses/CourseAnnouncementsPage.vue'),
    meta: { requiresRole: 'instructor' },
  },
  {
    path: 'instructor/courses/:id/assignments',
    name: 'instructor-assignments',
    component: () => import('@/views/instructor/assignments/AssignmentListPage.vue'),
    meta: { requiresRole: 'instructor' },
  },
  {
    path: 'instructor/courses/:courseId/assignments/new',
    name: 'instructor-assignment-new',
    component: () => import('@/views/instructor/assignments/AssignmentEditorPage.vue'),
    meta: { requiresRole: 'instructor' },
  },
  {
    path: 'instructor/courses/:courseId/assignments/:id/edit',
    name: 'instructor-assignment-edit',
    component: () => import('@/views/instructor/assignments/AssignmentEditorPage.vue'),
    meta: { requiresRole: 'instructor' },
  },
  {
    path: 'instructor/assignments/:id/submissions',
    name: 'instructor-submissions',
    component: () => import('@/views/instructor/assignments/SubmissionReviewPage.vue'),
    meta: { requiresRole: 'instructor' },
  },
  {
    path: 'instructor/courses/:id/meetings/new',
    name: 'instructor-meeting-new',
    component: () => import('@/views/instructor/meetings/MeetingSchedulerPage.vue'),
    meta: { requiresRole: 'instructor' },
  },
];