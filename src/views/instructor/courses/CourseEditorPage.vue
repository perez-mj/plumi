<!-- src/views/instructor/courses/CourseEditorPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />

        <template v-else>
          <h1 class="course-editor__title">{{ isEdit ? 'Edit Course' : 'Create Course' }}</h1>

          <form class="course-editor__form" @submit.prevent="save">
            <label>Title * <input v-model="form.title" required maxlength="200" /></label>
            <label>Code <input v-model="form.code" placeholder="e.g., CS101" maxlength="20" /></label>
            <label>Description <textarea v-model="form.description" rows="4" maxlength="2000" /></label>
            <label>Category
              <select v-model="form.categoryId">
                <option :value="null">None</option>
                <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </label>
            <label>Status
              <select v-model="form.status">
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            <label>Enrollment key (optional) <input v-model="form.enrollmentKey" maxlength="40" placeholder="Leave blank for open enrollment" /></label>
            <div class="course-editor__row">
              <label>Start date <input v-model="form.startDate" type="date" /></label>
              <label>End date <input v-model="form.endDate" type="date" /></label>
            </div>
            <div class="course-editor__actions">
              <ion-button fill="clear" type="button" @click="$router.back()">Cancel</ion-button>
              <ion-button type="submit" :disabled="saving">{{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create course' }}</ion-button>
            </div>
            <p v-if="saveError" class="course-editor__error">{{ saveError }}</p>
          </form>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { arrowBackOutline } from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { createCourse, getCourse, updateCourse, listCategories } from '@/services/courses';
import type { Category } from '@/types/app';

const route = useRoute();
const router = useRouter();
const courseId = computed(() => (route.params.id as string) || null);
const isEdit = computed(() => !!courseId.value);

const categories = ref<Category[]>([]);
const loading = ref(isEdit.value);
const error = ref<string | null>(null);
const saving = ref(false);
const saveError = ref<string | null>(null);

const form = ref({
  title: '', code: '', description: '',
  categoryId: null as string | null,
  status: 'DRAFT' as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  enrollmentKey: '', startDate: '', endDate: '',
});

async function load() {
  if (!courseId.value) {
    categories.value = await listCategories();
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const [course, cats] = await Promise.all([getCourse(courseId.value), listCategories()]);
    categories.value = cats;
    form.value = {
      title: course.title,
      code: course.code ?? '',
      description: course.description ?? '',
      categoryId: course.category_id,
      status: course.status,
      enrollmentKey: course.enrollment_key ?? '',
      startDate: course.start_date ?? '',
      endDate: course.end_date ?? '',
    };
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load course.';
  } finally { loading.value = false; }
}

async function save() {
  saving.value = true;
  saveError.value = null;
  try {
    const payload = {
      title: form.value.title.trim(),
      code: form.value.code.trim() || null,
      description: form.value.description.trim() || null,
      category_id: form.value.categoryId,
      status: form.value.status,
      enrollment_key: form.value.enrollmentKey.trim() || null,
      start_date: form.value.startDate || null,
      end_date: form.value.endDate || null,
    };
    if (courseId.value) {
      await updateCourse(courseId.value, payload);
      router.push({ name: 'instructor-course-content', params: { id: courseId.value } });
    } else {
      const created = await createCourse(payload);
      router.push({ name: 'instructor-course-content', params: { id: created.id } });
    }
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save.';
  } finally { saving.value = false; }
}

onMounted(load);
</script>

<style scoped>
.page-shell--narrow { max-width: 720px; }
.course-editor__title { margin: 0; font-size: var(--plumi-text-2xl); letter-spacing: -0.03em; }
.course-editor__form { display: flex; flex-direction: column; gap: var(--size-3, 0.75rem); padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.course-editor__form label { display: flex; flex-direction: column; gap: var(--size-1, 0.25rem); font-size: var(--plumi-text-sm); color: var(--plumi-text-muted); }
.course-editor__form input, .course-editor__form textarea, .course-editor__form select { padding: var(--size-2, 0.5rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
.course-editor__row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--size-3, 0.75rem); }
.course-editor__actions { display: flex; justify-content: flex-end; gap: var(--size-2, 0.5rem); margin-top: var(--size-2, 0.5rem); }
.course-editor__error { color: var(--plumi-danger); font-size: var(--plumi-text-sm); margin: 0; }

.course-editor__form { min-width:0; padding:var(--plumi-panel-padding); border-radius:20px; box-shadow:var(--plumi-shadow-card); }
.course-editor__actions { gap:10px; flex-wrap:wrap; }
@media(max-width:640px) { .course-editor__row { grid-template-columns:minmax(0,1fr); } }
@media(max-width:600px) { .course-editor__actions > ion-button { flex:1 1 auto; min-height:44px; } }
</style>