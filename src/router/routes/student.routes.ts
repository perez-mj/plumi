// src/router/routes/student.routes.ts
import type { RouteRecordRaw } from 'vue-router';

export const studentRoutes: RouteRecordRaw[] = [
  {
    path: 'student',
    redirect: { name: 'student-dashboard' },
    meta: { requiresRole: 'student' },
  },
  {
    path: 'student/dashboard',
    name: 'student-dashboard',
    component: () => import('@/views/student/StudentDashboardPage.vue'),
    meta: { requiresRole: 'student' },
  },
  {
    path: 'student/courses',
    name: 'student-courses',
    component: () => import('@/views/student/courses/MyEnrolledCoursesPage.vue'),
    meta: { requiresRole: 'student' },
  },
  {
    path: 'student/courses/browse',
    name: 'student-courses-browse',
    component: () => import('@/views/student/courses/BrowseCoursesPage.vue'),
    meta: { requiresRole: 'student' },
  },
  {
    path: 'student/courses/:id',
    name: 'student-course-home',
    component: () => import('@/views/student/courses/CourseHomePage.vue'),
    meta: { requiresRole: 'student' },
  },
  {
    path: 'student/courses/:courseId/lessons/:lessonId',
    name: 'student-lesson-view',
    component: () => import('@/views/student/courses/LessonViewPage.vue'),
    meta: { requiresRole: 'student' },
  },
  {
    path: 'student/assignments',
    name: 'student-assignments',
    component: () => import('@/views/student/assignments/MyAssignmentsPage.vue'),
    meta: { requiresRole: 'student' },
  },
  {
    path: 'student/assignments/:id',
    name: 'student-assignment-submit',
    component: () => import('@/views/student/assignments/SubmitAssignmentPage.vue'),
    meta: { requiresRole: 'student' },
  },
  {
    path: 'student/grades',
    name: 'student-grades',
    component: () => import('@/views/student/grades/MyGradesPage.vue'),
    meta: { requiresRole: 'student' },
  },
];