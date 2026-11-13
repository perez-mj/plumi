// src/composables/useCourse.ts
import { ref, watch, type Ref } from 'vue';
import { getCourse, type CourseWithMeta } from '@/services/courses';
import { listModulesWithLessons, listMaterialsForCourse } from '@/services/content';
import { listAssignmentsForCourse } from '@/services/assignments';
import { getCourseProgress } from '@/services/progress';
import { listAnnouncements } from '@/services/announcements';
import { getMyEnrollmentForCourse } from '@/services/enrollments';
import type {
  Assignment,
  Material,
  ModuleWithLessons,
  Announcement,
  Enrollment,
} from '@/types/app';

export function useCourse(courseId: Ref<string | null>) {
  const course = ref<CourseWithMeta | null>(null);
  const modules = ref<ModuleWithLessons[]>([]);
  const materials = ref<Material[]>([]);
  const assignments = ref<Assignment[]>([]);
  const announcements = ref<Announcement[]>([]);
  const enrollment = ref<Enrollment | null>(null);
  const progress = ref({ completed: 0, total: 0, percent: 0 });

  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load() {
    if (!courseId.value) return;
    loading.value = true;
    error.value = null;
    try {
      const id = courseId.value;

      // Enrollment first: some downstream queries (progress) depend on it.
      const enr = await getMyEnrollmentForCourse(id);
      enrollment.value = enr;

      const [c, m, mat, a, ann] = await Promise.all([
        getCourse(id),
        listModulesWithLessons(id),
        listMaterialsForCourse(id),
        listAssignmentsForCourse(id),
        listAnnouncements(id),
      ]);

      let prog = { completed: 0, total: 0, percent: 0 };
      if (enr && enr.status === 'ACTIVE') {
        const p = await getCourseProgress(id);
        prog = { completed: p.completed, total: p.total, percent: p.percent };
      }

      course.value = c;
      modules.value = m;
      materials.value = mat;
      assignments.value = a;
      announcements.value = ann;
      progress.value = prog;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load course.';
    } finally {
      loading.value = false;
    }
  }

  watch(courseId, load, { immediate: true });

  return {
    course,
    modules,
    materials,
    assignments,
    announcements,
    enrollment,
    progress,
    loading,
    error,
    reload: load,
  };
}