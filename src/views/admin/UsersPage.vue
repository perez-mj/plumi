<!-- src/views/admin/UsersPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <PageHeader title="User Management" subtitle="Manage platform accounts">
          <template #actions>
            <ion-button size="small" @click="$router.push({ name: 'admin-user-detail', params: { id: 'new' } })">
              <ion-icon slot="start" :icon="addOutline" /> Invite User
            </ion-button>
          </template>
        </PageHeader>

        <ion-searchbar v-model="search" placeholder="Search by name or email…" :debounce="300" @ionInput="load" />

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState v-else-if="!users.length" title="No users" message="No user accounts found." :icon="peopleOutline" />
        <div v-else class="users__table">
          <table class="responsive-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td data-label="Name">
                  <button class="users__name-btn" @click="$router.push({ name: 'admin-user-detail', params: { id: u.id } })">
                    {{ u.first_name }} {{ u.last_name }}
                  </button>
                </td>
                <td data-label="Email" class="users__email">{{ u.email }}</td>
                <td data-label="Role"><span class="users__role">{{ u.role_name }}</span></td>
                <td data-label="Status">
                  <span :class="u.is_active ? 'users__status--active' : 'users__status--disabled'">
                    {{ u.is_active ? 'Active' : 'Disabled' }}
                  </span>
                </td>
                <td data-label="Actions">
                  <ion-button size="small" fill="clear" @click="toggleActive(u)">
                    {{ u.is_active ? 'Disable' : 'Enable' }}
                  </ion-button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent, IonButton, IonIcon, IonSearchbar,
} from '@ionic/vue';
import { addOutline, peopleOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { supabase } from '@/lib/supabase';

interface UserRow {
  id: string; first_name: string; last_name: string; email: string;
  is_active: boolean; role_name: string;
}

const users = ref<UserRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const search = ref('');

async function load() {
  error.value = null;
  try {
    let q = supabase
      .from('profiles')
      .select('id, first_name, last_name, email, is_active, roles(name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (search.value.trim()) {
      const term = `%${search.value.trim()}%`;
      q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`);
    }

    const { data, error: err } = await q;
    if (err) throw err;
    users.value = (data ?? []).map((u) => {
      const role = (u as { roles: { name: string } | { name: string }[] }).roles;
      const r = Array.isArray(role) ? role[0] : role;
      return { ...u, role_name: r?.name ?? 'STUDENT' } as UserRow;
    });
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load users.';
  } finally {
    loading.value = false;
  }
}

async function onRefresh(ev: CustomEvent) {
  await load();
  (ev.target as HTMLIonRefresherElement).complete();
}

async function toggleActive(u: UserRow) {
  await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id);
  await load();
}

onMounted(load);
</script>

<style scoped>
.users__table { overflow-x: auto; border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
table { width: 100%; border-collapse: collapse; font-size: var(--plumi-text-sm); }
th, td { padding: var(--size-3, 0.75rem); text-align: left; border-bottom: 1px solid var(--plumi-border); }
th { background: var(--plumi-surface-muted); font-weight: var(--plumi-weight-semibold); color: var(--plumi-text-muted); font-size: var(--plumi-text-xs); text-transform: uppercase; letter-spacing: 0.06em; }
.users__name-btn { background: none; border: none; color: var(--plumi-primary); font: inherit; cursor: pointer; padding: 0; text-align: start; }
.users__name-btn:hover { text-decoration: underline; }
.users__email { color: var(--plumi-text-muted); }
.users__role { padding: 2px 8px; border-radius: var(--radius-round); background: var(--plumi-primary-soft); color: var(--plumi-primary); font-size: var(--plumi-text-xs); font-weight: var(--plumi-weight-semibold); }
.users__status--active { color: var(--plumi-success); font-weight: var(--plumi-weight-semibold); font-size: var(--plumi-text-xs); }
.users__status--disabled { color: var(--plumi-danger); font-weight: var(--plumi-weight-semibold); font-size: var(--plumi-text-xs); }

.users__email { min-width:0; overflow-wrap:anywhere; line-height:1.65; }

.responsive-table th, .responsive-table td { padding:18px 22px; }
.responsive-table tbody tr:last-child td { border-bottom:0; }
.responsive-table tbody tr:hover { background:var(--plumi-primary-subtle); }
@media(max-width:640px) {
 .responsive-table, .responsive-table tbody { display:block; width:100%; }
 .responsive-table thead { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
 .responsive-table tbody { padding:12px; }
 .responsive-table tr { display:block; padding:12px; margin-bottom:12px; border:1px solid var(--plumi-border); border-radius:16px; background:var(--plumi-surface); }
 .responsive-table tr:last-child { margin-bottom:0; }
 .responsive-table td { display:grid; grid-template-columns:70px minmax(0,1fr); align-items:center; gap:12px; padding:9px 2px; border:0; overflow-wrap:anywhere; font-size:.8125rem; }
 .responsive-table td::before { content:attr(data-label); color:var(--plumi-text-muted); font-size:.7rem; font-weight:600; }
 .responsive-table td > ion-button { justify-self:start; margin:0; }
}
</style>