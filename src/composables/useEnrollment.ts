// src/composables/useEnrollment.ts
import { ref, watch, type Ref } from 'vue';
import {
  listMyEnrollments,
  getMyEnrollmentForCourse,
} from '@/services/enrollments';
import type { Enrollment } from '@/types/app';

export function useEnrollment() {
  const enrollments = ref<Enrollment[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      enrollments.value = await listMyEnrollments();
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load enrollments.';
    } finally {
      loading.value = false;
    }
  }

  return { enrollments, loading, error, load };
}

export function useEnrollmentForCourse(courseId: Ref<string | null>) {
  const enrollment = ref<Enrollment | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load() {
    if (!courseId.value) {
      enrollment.value = null;
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      enrollment.value = await getMyEnrollmentForCourse(courseId.value);
    } catch (e: unknown) {
      enrollment.value = null;
      error.value = e instanceof Error ? e.message : 'Failed to load enrollment.';
    } finally {
      loading.value = false;
    }
  }

  watch(courseId, load, { immediate: true });

  return { enrollment, loading, error, reload: load };
}