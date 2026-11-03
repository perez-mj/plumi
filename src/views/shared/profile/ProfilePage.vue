<!-- src/views/shared/profile/ProfilePage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <PageHeader title="Profile" subtitle="Manage your account information" />

        <section class="profile__card">
          <div class="profile__avatar">
            <img v-if="form.avatarUrl" :src="form.avatarUrl" :alt="auth.displayName" />
            <span v-else>{{ initials }}</span>
          </div>
          <div class="profile__meta">
            <p class="profile__name">{{ auth.displayName }}</p>
            <p class="profile__email">{{ auth.user?.email }}</p>
            <p class="profile__role">{{ auth.role }}</p>
          </div>
        </section>

        <section class="profile__form-card">
          <h2 class="profile__section-title">Edit Profile</h2>
          <form @submit.prevent="save" class="profile__form">
            <label>First name <input v-model="form.firstName" required /></label>
            <label>Last name <input v-model="form.lastName" required /></label>
            <label>Avatar URL <input v-model="form.avatarUrl" placeholder="https://…" /></label>
            <label>Bio <textarea v-model="form.bio" rows="3" maxlength="500" /></label>
            <div class="profile__actions">
              <ion-button type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save changes' }}</ion-button>
              <span v-if="savedMessage" class="profile__success">{{ savedMessage }}</span>
            </div>
            <p v-if="errorMessage" class="profile__error">{{ errorMessage }}</p>
          </form>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { IonPage, IonContent, IonButton } from '@ionic/vue';
import PageHeader from '@/components/common/PageHeader.vue';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

const auth = useAuthStore();
const form = ref({ firstName: '', lastName: '', bio: '', avatarUrl: '' });
const saving = ref(false);
const savedMessage = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

const initials = computed(() =>
  [form.value.firstName, form.value.lastName]
    .filter(Boolean)
    .map((s) => s!.charAt(0))
    .join('')
    .toUpperCase() || 'U',
);

onMounted(() => {
  form.value.firstName = auth.user?.firstName ?? '';
  form.value.lastName = auth.user?.lastName ?? '';
  form.value.bio = auth.user?.bio ?? '';
  form.value.avatarUrl = auth.user?.avatarUrl ?? '';
});

async function save() {
  if (!auth.user) return;
  saving.value = true;
  savedMessage.value = null;
  errorMessage.value = null;
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: form.value.firstName.trim(),
        last_name: form.value.lastName.trim(),
        bio: form.value.bio.trim() || null,
        avatar_url: form.value.avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.user.id);
    if (error) throw error;
    await auth.refresh();
    savedMessage.value = 'Profile updated.';
  } catch (e: unknown) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to save.';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.page-shell--narrow { max-width: 720px; }
.profile__card { display: flex; align-items: center; gap: var(--size-4, 1rem); padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.profile__avatar { display: grid; place-items: center; width: 72px; height: 72px; border-radius: var(--radius-round); background: var(--plumi-primary-soft); color: var(--plumi-primary); font-size: 24px; font-weight: var(--plumi-weight-bold); overflow: hidden; flex: 0 0 auto; }
.profile__avatar img { width: 100%; height: 100%; object-fit: cover; }
.profile__name { margin: 0; font-size: var(--plumi-text-lg); font-weight: var(--plumi-weight-semibold); }
.profile__email { margin: 2px 0; font-size: var(--plumi-text-sm); color: var(--plumi-text-muted); }
.profile__role { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-primary); text-transform: uppercase; letter-spacing: 0.06em; }
.profile__form-card { padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.profile__section-title { margin: 0 0 var(--size-3, 0.75rem); font-size: var(--plumi-text-md); }
.profile__form { display: flex; flex-direction: column; gap: var(--size-3, 0.75rem); }
.profile__form label { display: flex; flex-direction: column; gap: var(--size-1, 0.25rem); font-size: var(--plumi-text-sm); color: var(--plumi-text-muted); }
.profile__form input, .profile__form textarea { padding: var(--size-2, 0.5rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
.profile__actions { display: flex; align-items: center; gap: var(--size-2, 0.5rem); }
.profile__success { color: var(--plumi-success); font-size: var(--plumi-text-sm); }
.profile__error { color: var(--plumi-danger); font-size: var(--plumi-text-sm); margin: 0; }
</style>