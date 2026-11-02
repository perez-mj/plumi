<!-- src/views/admin/UserDetailPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />

        <template v-else-if="user">
          <header class="user-detail__header">
            <div class="user-detail__avatar">{{ user.first_name.charAt(0) }}{{ user.last_name.charAt(0) }}</div>
            <div>
              <h1 class="user-detail__name">{{ user.first_name }} {{ user.last_name }}</h1>
              <p class="user-detail__email">{{ user.email }}</p>
            </div>
          </header>

          <section class="user-detail__panel">
            <h2 class="user-detail__panel-title">Account Information</h2>
            <div class="user-detail__form">
              <label>First name <input v-model="form.firstName" :disabled="!editing" /></label>
              <label>Last name <input v-model="form.lastName" :disabled="!editing" /></label>
              <label>Email <input v-model="user.email" disabled /></label>
              <label>Role
                <select v-model="form.roleId" :disabled="!editing">
                  <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
                </select>
              </label>
              <label>Status
                <select v-model="form.isActive" :disabled="!editing">
                  <option :value="true">Active</option>
                  <option :value="false">Disabled</option>
                </select>
              </label>
            </div>
            <div class="user-detail__actions">
              <ion-button v-if="!editing" @click="editing = true">Edit</ion-button>
              <template v-else>
                <ion-button fill="clear" @click="cancel">Cancel</ion-button>
                <ion-button :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save' }}</ion-button>
              </template>
            </div>
            <p v-if="saveError" class="user-detail__error">{{ saveError }}</p>
          </section>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { arrowBackOutline } from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string; first_name: string; last_name: string; email: string;
  role_id: string; is_active: boolean;
}
interface Role { id: string; name: string; }

const route = useRoute();
const userId = route.params.id as string;

const user = ref<UserProfile | null>(null);
const roles = ref<Role[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const editing = ref(false);
const saving = ref(false);
const saveError = ref<string | null>(null);
const form = ref({ firstName: '', lastName: '', roleId: '', isActive: true });

async function load() {
  error.value = null;
  try {
    const [userRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, email, role_id, is_active').eq('id', userId).single(),
      supabase.from('roles').select('id, name').order('name'),
    ]);
    if (userRes.error) throw userRes.error;
    user.value = userRes.data;
    roles.value = rolesRes.data ?? [];
    resetForm();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load user.';
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  if (!user.value) return;
  form.value = {
    firstName: user.value.first_name,
    lastName: user.value.last_name,
    roleId: user.value.role_id,
    isActive: user.value.is_active,
  };
}

function cancel() {
  editing.value = false;
  saveError.value = null;
  resetForm();
}

async function save() {
  saving.value = true;
  saveError.value = null;
  try {
    const { error: err } = await supabase
      .from('profiles')
      .update({
        first_name: form.value.firstName.trim(),
        last_name: form.value.lastName.trim(),
        role_id: form.value.roleId,
        is_active: form.value.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (err) throw err;
    editing.value = false;
    await load();
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save.';
  } finally {
    saving.value = false;
  }
}

watch(() => route.params.id, load);
onMounted(load);
</script>

<style scoped>
.page-shell--narrow { max-width: 720px; }
.user-detail__header { display: flex; align-items: center; gap: var(--size-4, 1rem); padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.user-detail__avatar { display: grid; place-items: center; width: 64px; height: 64px; border-radius: var(--radius-round); background: var(--plumi-primary-soft); color: var(--plumi-primary); font-size: 20px; font-weight: var(--plumi-weight-bold); }
.user-detail__name { margin: 0; font-size: var(--plumi-text-xl); }
.user-detail__email { margin: 4px 0 0; color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); }
.user-detail__panel { padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.user-detail__panel-title { margin: 0 0 var(--size-3, 0.75rem); font-size: var(--plumi-text-md); }
.user-detail__form { display: grid; grid-template-columns: 1fr 1fr; gap: var(--size-3, 0.75rem); }
@media (max-width: 600px) { .user-detail__form { grid-template-columns: 1fr; } }
.user-detail__form label { display: flex; flex-direction: column; gap: var(--size-1, 0.25rem); font-size: var(--plumi-text-sm); color: var(--plumi-text-muted); }
.user-detail__form input, .user-detail__form select { padding: var(--size-2, 0.5rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
.user-detail__form input:disabled, .user-detail__form select:disabled { opacity: 0.65; }
.user-detail__actions { display: flex; justify-content: flex-end; gap: var(--size-2, 0.5rem); margin-top: var(--size-3, 0.75rem); }
.user-detail__error { color: var(--plumi-danger); font-size: var(--plumi-text-sm); margin: var(--size-2, 0.5rem) 0 0; }
</style>