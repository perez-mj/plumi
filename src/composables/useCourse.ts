// src/composables/useCourse.ts
import { ref, watch, type Ref } from 'vue';
import { getCourse, type CourseWithMeta } from '@/services/courses';
import { listModulesWithLessons, listMaterialsForCourse } from '@/services/content';
import { listAssignmentsForCourse } from '@/services/assignments';
import { getCourseProgress } from '@/services/progress';
import { listAnnouncements } from '@/services/announcements';
import type { Assignment, Material, ModuleWithLessons, Announcement } from '@/types/app';

export function useCourse(courseId: Ref<string | null>) {
  const course = ref<CourseWithMeta | null>(null);
  const modules = ref<ModuleWithLessons[]>([]);
  const materials = ref<Material[]>([]);
  const assignments = ref<Assignment[]>([]);
  const announcements = ref<Announcement[]>([]);
  const progress = ref({ completed: 0, total: 0, percent: 0 });

  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load() {
    if (!courseId.value) return;
    loading.value = true;
    error.value = null;
    try {
      const id = courseId.value;
      const [c, m, mat, a, ann, prog] = await Promise.all([
        getCourse(id),
        listModulesWithLessons(id),
        listMaterialsForCourse(id),
        listAssignmentsForCourse(id),
        listAnnouncements(id),
        getCourseProgress(id),
      ]);
      course.value = c;
      modules.value = m;
      materials.value = mat;
      assignments.value = a;
      announcements.value = ann;
      progress.value = { completed: prog.completed, total: prog.total, percent: prog.percent };
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load course.';
    } finally {
      loading.value = false;
    }
  }

  watch(courseId, load, { immediate: true });

  return { course, modules, materials, assignments, announcements, progress, loading, error, reload: load };
}