<!-- src/views/instructor/courses/CourseRosterPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>
        <PageHeader title="Course Roster" subtitle="Students enrolled in this course" />

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState v-else-if="!roster.length" title="No students enrolled"
          message="Students who enroll will appear here." :icon="peopleOutline" />

        <ul v-else class="roster-list">
          <li v-for="r in roster" :key="r.id" class="roster-item">
            <span class="roster-item__avatar">{{ r.student.first_name.charAt(0) }}</span>
            <div class="roster-item__body">
              <p class="roster-item__name">{{ r.student.first_name }} {{ r.student.last_name }}</p>
              <p class="roster-item__email">{{ r.student.email }}</p>
            </div>
            <span class="roster-item__status">{{ r.status }}</span>
            <ion-button size="small" fill="outline" :disabled="messagingId === r.student.id"
              @click="messageStudent(r.student.id)">
              <ion-icon slot="start" :icon="chatbubbleOutline" />
              {{ messagingId === r.student.id ? 'Opening…' : 'Message' }}
            </ion-button>
          </li>
        </ul>
        <p v-if="actionError" class="roster-error">{{ actionError }}</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent, IonButton, IonIcon,
} from '@ionic/vue';
import { arrowBackOutline, peopleOutline, chatbubbleOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { listCourseRoster } from '@/services/enrollments';
import { openDirectConversation } from '@/services/messaging';

const route = useRoute();
const router = useRouter();
const courseId = route.params.id as string;

const roster = ref<Awaited<ReturnType<typeof listCourseRoster>>>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const actionError = ref<string | null>(null);
const messagingId = ref<string | null>(null);

async function load() {
  error.value = null;
  try { roster.value = await listCourseRoster(courseId); }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Failed to load roster.'; }
  finally { loading.value = false; }
}

async function onRefresh(ev: CustomEvent) {
  await load();
  (ev.target as HTMLIonRefresherElement).complete();
}

async function messageStudent(studentId: string) {
  messagingId.value = studentId;
  actionError.value = null;
  try {
    const convId = await openDirectConversation(studentId);
    router.push({ name: 'messages', query: { c: convId } });
  } catch (e: unknown) {
    actionError.value = e instanceof Error ? e.message : 'Could not open conversation.';
  } finally {
    messagingId.value = null;
  }
}

onMounted(load);
</script>

<style scoped>
.roster-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
.roster-item { display: flex; align-items: center; gap: var(--size-3, 0.75rem); padding: var(--size-3, 0.75rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); }
.roster-item__avatar { display: grid; place-items: center; width: 40px; height: 40px; border-radius: var(--radius-round); background: var(--plumi-primary-soft); color: var(--plumi-primary); font-weight: var(--plumi-weight-bold); flex: 0 0 auto; }
.roster-item__body { flex: 1; min-width: 0; }
.roster-item__name { margin: 0; font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); }
.roster-item__email { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.roster-item__status { padding: 2px 8px; border-radius: var(--radius-round); background: var(--plumi-success-soft); color: var(--plumi-success); font-size: var(--plumi-text-xs); }
.roster-error { margin: var(--size-2) 0 0; color: var(--plumi-danger); font-size: var(--plumi-text-sm); }
</style>