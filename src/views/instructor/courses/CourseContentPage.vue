<!-- src/views/instructor/courses/CourseContentPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <ion-button fill="clear" size="small" @click="$router.push({ name: 'instructor-courses' })">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back to courses
        </ion-button>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="reload" />

        <template v-else-if="course">
          <header class="course-content__header">
            <div>
              <p v-if="course.code" class="course-content__code">{{ course.code }}</p>
              <h1 class="course-content__title">{{ course.title }}</h1>
              <p class="course-content__meta">{{ course.status }} · {{ modules.length }} modules · {{ totalLessons }} lessons</p>
            </div>
            <div class="course-content__actions">
              <ion-button size="small" fill="outline" @click="$router.push({ name: 'instructor-course-edit', params: { id: course.id } })">
                Edit Course
              </ion-button>
              <ion-button size="small" fill="outline" @click="$router.push({ name: 'instructor-course-roster', params: { id: course.id } })">
                Roster
              </ion-button>
              <ion-button size="small" fill="outline" @click="$router.push({ name: 'instructor-course-announcements', params: { id: course.id } })">
                Announcements
              </ion-button>
              <ion-button size="small" fill="outline" @click="$router.push({ name: 'instructor-meeting-new', params: { id: course.id } })">
                Schedule Meeting
              </ion-button>
              <ion-button size="small" fill="outline" :disabled="openingChat" @click="openCourseChat">
                <ion-icon slot="start" :icon="chatbubblesOutline" />
                {{ openingChat ? 'Opening…' : 'Course Chat' }}
              </ion-button>
            </div>
            <p v-if="chatError" class="course-content__error">{{ chatError }}</p>
          </header>

          <section class="course-content__panel">
            <div class="course-content__panel-head">
              <h2>Content</h2>
              <ion-button size="small" @click="showModuleModal = true">
                <ion-icon slot="start" :icon="addOutline" /> Module
              </ion-button>
            </div>

            <EmptyState v-if="!modules.length" title="No content" message="Add a module to start building your course." :icon="albumsOutline" />

            <div v-else class="modules">
              <article v-for="m in modules" :key="m.id" class="module">
                <header class="module__header">
                  <div>
                    <h3 class="module__title">{{ m.title }}</h3>
                    <p v-if="m.description" class="module__desc">{{ m.description }}</p>
                  </div>
                  <div class="module__actions">
                    <ion-button size="small" fill="clear" @click="openLessonModal(m.id)">
                      <ion-icon :icon="addOutline" />
                    </ion-button>
                    <ion-button size="small" fill="clear" color="danger" @click="removeModule(m.id)">
                      <ion-icon :icon="trashOutline" />
                    </ion-button>
                  </div>
                </header>
                <ul v-if="m.lessons.length" class="lessons">
                  <li v-for="l in m.lessons" :key="l.id" class="lesson">
                    <ion-icon :icon="playCircleOutline" class="lesson__icon" />
                    <div class="lesson__body">
                      <p class="lesson__title">{{ l.title }}</p>
                      <p v-if="l.video_url" class="lesson__meta">Video lesson</p>
                    </div>
                    <ion-button size="small" fill="clear" color="danger" @click="removeLesson(l.id)">
                      <ion-icon :icon="trashOutline" />
                    </ion-button>
                  </li>
                </ul>
                <p v-else class="module__empty">No lessons yet.</p>
              </article>
            </div>
          </section>

          <section class="course-content__panel">
            <div class="course-content__panel-head">
              <h2>Assignments</h2>
              <ion-button size="small" @click="$router.push({ name: 'instructor-assignment-new', params: { courseId: course.id } })">
                <ion-icon slot="start" :icon="addOutline" /> Assignment
              </ion-button>
            </div>
            <EmptyState v-if="!assignments.length" title="No assignments" message="Create assignments for this course." :icon="documentTextOutline" />
            <ul v-else class="assignments">
              <li v-for="a in assignments" :key="a.id" class="assignment">
                <div class="assignment__body">
                  <p class="assignment__title">{{ a.title }}</p>
                  <p class="assignment__meta">{{ formatDate(a.due_at) }} · {{ a.max_score }} pts · {{ a.is_published ? 'Published' : 'Draft' }}</p>
                </div>
                <ion-button size="small" fill="outline" @click="$router.push({ name: 'instructor-assignment-edit', params: { courseId: course.id, id: a.id } })">
                  Edit
                </ion-button>
                <ion-button size="small" @click="$router.push({ name: 'instructor-submissions', params: { id: a.id } })">
                  Submissions
                </ion-button>
              </li>
            </ul>
          </section>

          <section class="course-content__panel">
            <div class="course-content__panel-head">
              <h2>Materials</h2>
              <ion-button size="small" @click="showUploadModal = true">
                <ion-icon slot="start" :icon="cloudUploadOutline" /> Upload
              </ion-button>
            </div>
            <EmptyState v-if="!materials.length" title="No materials" message="Upload PDFs, documents, or links." :icon="documentOutline" />
            <ul v-else class="materials">
              <li v-for="mat in materials" :key="mat.id" class="material">
                <ion-icon :icon="documentOutline" />
                <div class="material__body">
                  <p class="material__title">{{ mat.title }}</p>
                  <p class="material__meta">{{ mat.type }} · {{ formatSize(mat.size) }}</p>
                </div>
                <ion-button size="small" fill="clear" color="danger" @click="deleteMat(mat.id)">
                  <ion-icon :icon="trashOutline" />
                </ion-button>
              </li>
            </ul>
          </section>
        </template>
      </div>

      <!-- Add Module Modal -->
      <ion-modal :is-open="showModuleModal" @didDismiss="showModuleModal = false">
        <ion-content class="modal-content"><div class="modal-inner">
          <h2>Add Module</h2>
          <input v-model="newModuleTitle" placeholder="Module title" class="modal-input" />
          <textarea v-model="newModuleDesc" placeholder="Description (optional)" rows="3" class="modal-input" />
          <div class="modal-actions">
            <ion-button fill="clear" @click="showModuleModal = false">Cancel</ion-button>
            <ion-button :disabled="addingModule" @click="addModule">Add</ion-button>
          </div>
        </div></ion-content>
      </ion-modal>

      <!-- Add Lesson Modal -->
      <ion-modal :is-open="showLessonModal" @didDismiss="showLessonModal = false">
        <ion-content class="modal-content"><div class="modal-inner">
          <h2>Add Lesson</h2>
          <input v-model="newLessonTitle" placeholder="Lesson title" class="modal-input" />
          <textarea v-model="newLessonContent" placeholder="Lesson content" rows="4" class="modal-input" />
          <input v-model="newLessonVideo" placeholder="Video URL (optional)" class="modal-input" />
          <div class="modal-actions">
            <ion-button fill="clear" @click="showLessonModal = false">Cancel</ion-button>
            <ion-button :disabled="addingLesson" @click="addLesson">Add</ion-button>
          </div>
        </div></ion-content>
      </ion-modal>

      <!-- Upload Material Modal -->
      <ion-modal :is-open="showUploadModal" @didDismiss="showUploadModal = false">
        <ion-content class="modal-content"><div class="modal-inner">
          <h2>Upload Material</h2>
          <input v-model="uploadTitle" placeholder="Material title" class="modal-input" />
          <input type="file" @change="onFileChange" class="modal-input" />
          <div class="modal-actions">
            <ion-button fill="clear" @click="showUploadModal = false">Cancel</ion-button>
            <ion-button :disabled="uploading" @click="doUpload">{{ uploading ? 'Uploading…' : 'Upload' }}</ion-button>
          </div>
        </div></ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent, IonButton, IonIcon, IonModal,
} from '@ionic/vue';
import {
  arrowBackOutline, addOutline, playCircleOutline, documentOutline,
  documentTextOutline, trashOutline, cloudUploadOutline, albumsOutline, chatbubblesOutline,
} from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { useCourse } from '@/composables/useCourse';
import {
  createModule, deleteModule, createLesson, deleteLesson,
  uploadMaterial, deleteMaterial,
} from '@/services/content';
import { openCourseConversation } from '@/services/messaging';
import type { MaterialType } from '@/types/app';

const route = useRoute();
const router = useRouter();
const courseId = computed(() => (route.params.id as string) || null);
const {
  course, modules, materials, assignments,
  loading, error, reload,
} = useCourse(courseId);

const totalLessons = computed(() => modules.value.reduce((n, m) => n + m.lessons.length, 0));

/* ------------------ Course chat ------------------ */
const openingChat = ref(false);
const chatError = ref<string | null>(null);

async function openCourseChat() {
  if (!course.value) return;
  openingChat.value = true;
  chatError.value = null;
  try {
    const convId = await openCourseConversation(course.value.id);
    router.push({ name: 'messages', query: { c: convId } });
  } catch (e: unknown) {
    chatError.value = e instanceof Error ? e.message : 'Could not open course chat.';
  } finally {
    openingChat.value = false;
  }
}

/* ------------------ Modules ------------------ */
const showModuleModal = ref(false);
const newModuleTitle = ref('');
const newModuleDesc = ref('');
const addingModule = ref(false);

async function onRefresh(ev: CustomEvent) {
  await reload();
  (ev.target as HTMLIonRefresherElement).complete();
}

async function addModule() {
  if (!courseId.value || !newModuleTitle.value.trim()) return;
  addingModule.value = true;
  try {
    await createModule({
      course_id: courseId.value,
      title: newModuleTitle.value.trim(),
      description: newModuleDesc.value.trim() || null,
      position: modules.value.length,
    });
    showModuleModal.value = false;
    newModuleTitle.value = ''; newModuleDesc.value = '';
    await reload();
  } finally { addingModule.value = false; }
}

async function removeModule(id: string) {
  if (!confirm('Delete this module and all its lessons?')) return;
  await deleteModule(id);
  await reload();
}

/* ------------------ Lessons ------------------ */
const showLessonModal = ref(false);
const lessonModuleId = ref<string | null>(null);
const newLessonTitle = ref('');
const newLessonContent = ref('');
const newLessonVideo = ref('');
const addingLesson = ref(false);

function openLessonModal(moduleId: string) {
  lessonModuleId.value = moduleId;
  newLessonTitle.value = ''; newLessonContent.value = ''; newLessonVideo.value = '';
  showLessonModal.value = true;
}

async function addLesson() {
  if (!courseId.value || !lessonModuleId.value || !newLessonTitle.value.trim()) return;
  addingLesson.value = true;
  try {
    const mod = modules.value.find((m) => m.id === lessonModuleId.value);
    await createLesson({
      course_id: courseId.value,
      module_id: lessonModuleId.value,
      title: newLessonTitle.value.trim(),
      content: newLessonContent.value || null,
      video_url: newLessonVideo.value || null,
      position: mod ? mod.lessons.length : 0,
    });
    showLessonModal.value = false;
    await reload();
  } finally { addingLesson.value = false; }
}

async function removeLesson(id: string) {
  if (!confirm('Delete this lesson?')) return;
  await deleteLesson(id);
  await reload();
}

/* ------------------ Materials ------------------ */
const showUploadModal = ref(false);
const uploadTitle = ref('');
const uploadFile = ref<File | null>(null);
const uploading = ref(false);

function onFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) uploadFile.value = f;
}

function inferMaterialType(file: File): MaterialType {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'PDF';
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) return 'DOCX';
  if (
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    name.endsWith('.pptx')
  ) return 'PPTX';
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('text/')) return 'TEXT';
  return 'TEXT';
}

async function doUpload() {
  if (!courseId.value || !uploadFile.value || !uploadTitle.value.trim()) return;
  uploading.value = true;
  try {
    await uploadMaterial({
      courseId: courseId.value,
      title: uploadTitle.value.trim(),
      file: uploadFile.value,
      type: inferMaterialType(uploadFile.value),
    });
    showUploadModal.value = false;
    uploadTitle.value = ''; uploadFile.value = null;
    await reload();
  } finally { uploading.value = false; }
}

async function deleteMat(id: string) {
  if (!confirm('Delete this material?')) return;
  await deleteMaterial(id);
  await reload();
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string | null) {
  if (!iso) return 'No deadline';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}
</script>

<style scoped>
.course-content__header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: var(--size-3, 0.75rem); padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.course-content__code { margin: 0; font-family: var(--plumi-font-mono); font-size: var(--plumi-text-xs); color: var(--plumi-text-subtle); }
.course-content__title { margin: 4px 0; font-size: var(--plumi-text-2xl); letter-spacing: -0.03em; }
.course-content__meta { margin: 0; font-size: var(--plumi-text-sm); color: var(--plumi-text-muted); }
.course-content__actions { display: flex; gap: var(--size-2, 0.5rem); flex-wrap: wrap; }
.course-content__error { flex-basis: 100%; margin: var(--size-2) 0 0; font-size: var(--plumi-text-sm); color: var(--plumi-danger); }
.course-content__panel { padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.course-content__panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--size-3, 0.75rem); }
.course-content__panel-head h2 { margin: 0; font-size: var(--plumi-text-md); }
.modules { display: flex; flex-direction: column; gap: var(--size-3, 0.75rem); }
.module { border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); overflow: hidden; }
.module__header { display: flex; align-items: flex-start; justify-content: space-between; padding: var(--size-3, 0.75rem); background: var(--plumi-surface-muted); }
.module__title { margin: 0; font-size: var(--plumi-text-md); }
.module__desc { margin: 2px 0 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.module__actions { display: flex; gap: 2px; }
.module__empty { margin: 0; padding: var(--size-3, 0.75rem); font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.lessons { list-style: none; padding: 0; margin: 0; }
.lesson { display: flex; align-items: center; gap: var(--size-3, 0.75rem); padding: var(--size-3, 0.75rem); border-top: 1px solid var(--plumi-border); }
.lesson__icon { font-size: 20px; color: var(--plumi-primary); }
.lesson__body { flex: 1; }
.lesson__title { margin: 0; font-size: var(--plumi-text-sm); }
.lesson__meta { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.materials, .assignments { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
.material, .assignment { display: flex; align-items: center; gap: var(--size-2, 0.5rem); padding: var(--size-2, 0.5rem); border-radius: var(--plumi-radius-sm); }
.material__body, .assignment__body { flex: 1; }
.material__title, .assignment__title { margin: 0; font-size: var(--plumi-text-sm); }
.material__meta, .assignment__meta { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.modal-content { --background: var(--plumi-surface); }
.modal-inner { padding: var(--size-5, 1.25rem); max-width: 520px; margin-inline: auto; display: flex; flex-direction: column; gap: var(--size-3, 0.75rem); }
.modal-inner h2 { margin: 0; }
.modal-input { width: 100%; padding: var(--size-2, 0.5rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--size-2, 0.5rem); }
</style>