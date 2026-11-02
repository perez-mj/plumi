<!-- src/views/admin/ActivityLogsPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <PageHeader title="Activity Logs" subtitle="Recent actions across the platform" />

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState v-else-if="!logs.length" title="No activity" message="No activity logged yet." :icon="listOutline" />

        <div v-else class="logs__table">
          <table>
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th></tr></thead>
            <tbody>
              <tr v-for="l in logs" :key="l.id">
                <td>{{ new Date(l.created_at).toLocaleString() }}</td>
                <td>{{ l.user_name || '—' }}</td>
                <td><span class="logs__action">{{ l.action }}</span></td>
                <td class="logs__entity">{{ l.entity_type || '—' }}</td>
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
  IonPage, IonContent, IonRefresher, IonRefresherContent,
} from '@ionic/vue';
import { listOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { supabase } from '@/lib/supabase';

interface LogRow {
  id: string; created_at: string; action: string;
  entity_type: string | null; user_name: string | null;
}

const logs = ref<LogRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  error.value = null;
  try {
    const { data, error: err } = await supabase
      .from('activity_logs')
      .select('id, created_at, action, entity_type, user:profiles!activity_logs_user_id_fkey ( first_name, last_name )')
      .order('created_at', { ascending: false })
      .limit(200);
    if (err) throw err;
    logs.value = (data ?? []).map((row) => {
      const user = (row as { user: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] }).user;
      const u = Array.isArray(user) ? user[0] : user;
      return {
        id: row.id,
        created_at: row.created_at,
        action: row.action,
        entity_type: row.entity_type,
        user_name: u ? `${u.first_name} ${u.last_name}` : null,
      };
    });
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load logs.';
  } finally { loading.value = false; }
}

async function onRefresh(ev: CustomEvent) {
  await load();
  (ev.target as HTMLIonRefresherElement).complete();
}

onMounted(load);
</script>

<style scoped>
.logs__table { overflow-x: auto; border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
table { width: 100%; border-collapse: collapse; font-size: var(--plumi-text-sm); }
th, td { padding: var(--size-3, 0.75rem); text-align: left; border-bottom: 1px solid var(--plumi-border); }
th { background: var(--plumi-surface-muted); font-weight: var(--plumi-weight-semibold); color: var(--plumi-text-muted); font-size: var(--plumi-text-xs); text-transform: uppercase; letter-spacing: 0.06em; }
.logs__action { padding: 2px 8px; border-radius: var(--radius-round); background: var(--plumi-info-soft); color: var(--plumi-info); font-size: var(--plumi-text-xs); font-weight: var(--plumi-weight-semibold); }
.logs__entity { color: var(--plumi-text-muted); }
</style>