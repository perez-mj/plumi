<!-- src/views/instructor/meetings/MeetingSchedulerPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>
        <h1 class="scheduler__title">Schedule Meeting</h1>

        <form class="scheduler__form" @submit.prevent="save">
          <label>Title * <input v-model="form.title" required maxlength="200" /></label>
          <label>Description <textarea v-model="form.description" rows="3" maxlength="1000" /></label>
          <label>Scheduled at * <input v-model="form.scheduledAt" type="datetime-local" required /></label>
          <label>Duration (minutes) <input v-model.number="form.duration" type="number" min="15" step="15" required /></label>
          <div class="scheduler__actions">
            <ion-button fill="clear" type="button" @click="$router.back()">Cancel</ion-button>
            <ion-button type="submit" :disabled="saving">{{ saving ? 'Scheduling…' : 'Schedule' }}</ion-button>
          </div>
          <p v-if="saveError" class="scheduler__error">{{ saveError }}</p>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { arrowBackOutline } from 'ionicons/icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const courseId = route.params.id as string;

const form = ref({ title: '', description: '', scheduledAt: '', duration: 60 });
const saving = ref(false);
const saveError = ref<string | null>(null);

async function save() {
  if (!form.value.title.trim() || !form.value.scheduledAt) return;
  saving.value = true;
  saveError.value = null;
  try {
    const roomName = `plumi-${courseId.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`;
    const { error: err } = await supabase.from('meetings').insert({
      course_id: courseId,
      title: form.value.title.trim(),
      description: form.value.description.trim() || null,
      scheduled_at: new Date(form.value.scheduledAt).toISOString(),
      duration: form.value.duration,
      room_name: roomName,
      host_id: auth.user!.id,
      status: 'SCHEDULED',
    });
    if (err) throw err;
    router.push({ name: 'meetings' });
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Failed to schedule.';
  } finally { saving.value = false; }
}
</script>

<style scoped>
.page-shell--narrow { max-width: 560px; }
.scheduler__title { margin: 0; font-size: var(--plumi-text-2xl); letter-spacing: -0.03em; }
.scheduler__form { display: flex; flex-direction: column; gap: var(--size-3, 0.75rem); padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.scheduler__form label { display: flex; flex-direction: column; gap: var(--size-1, 0.25rem); font-size: var(--plumi-text-sm); color: var(--plumi-text-muted); }
.scheduler__form input, .scheduler__form textarea { padding: var(--size-2, 0.5rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
.scheduler__actions { display: flex; justify-content: flex-end; gap: var(--size-2, 0.5rem); }
.scheduler__error { color: var(--plumi-danger); font-size: var(--plumi-text-sm); margin: 0; }
</style>