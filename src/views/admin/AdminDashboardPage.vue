<!-- src/views/admin/AdminDashboardPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <PageHeader title="Admin Dashboard" subtitle="Platform overview and management" />

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />

        <template v-else>
          <section class="admin-dash__stats">
            <StatCard icon="peopleOutline" label="Total Users" :value="stats.users" tone="primary" />
            <StatCard icon="schoolOutline" label="Instructors" :value="stats.instructors" tone="info" />
            <StatCard icon="bookOutline" label="Total Courses" :value="stats.courses" tone="success" />
            <StatCard icon="documentTextOutline" label="Announcements" :value="stats.announcements" tone="warning" />
          </section>

          <div class="admin-dash__grid">
            <section class="admin-dash__panel">
              <div class="admin-dash__panel-head">
                <h2>Recent Users</h2>
                <ion-button size="small" fill="clear" @click="$router.push({ name: 'admin-users' })">View all</ion-button>
              </div>
              <ul v-if="recentUsers.length" class="admin-dash__list">
                <li v-for="u in recentUsers" :key="u.id" class="admin-dash__item"
                  @click="$router.push({ name: 'admin-user-detail', params: { id: u.id } })">
                  <span class="admin-dash__avatar">{{ u.first_name.charAt(0) }}</span>
                  <div class="admin-dash__item-body">
                    <p class="admin-dash__item-title">{{ u.first_name }} {{ u.last_name }}</p>
                    <p class="admin-dash__item-meta">{{ u.email }}</p>
                  </div>
                  <span class="admin-dash__role">{{ u.role_name }}</span>
                </li>
              </ul>
              <p v-else class="admin-dash__empty">No users yet.</p>
            </section>

            <section class="admin-dash__panel">
              <div class="admin-dash__panel-head">
                <h2>Recent Courses</h2>
                <ion-button size="small" fill="clear" @click="$router.push({ name: 'admin-courses' })">View all</ion-button>
              </div>
              <ul v-if="recentCourses.length" class="admin-dash__list">
                <li v-for="c in recentCourses" :key="c.id" class="admin-dash__item">
                  <span class="admin-dash__avatar admin-dash__avatar--course">{{ c.title.charAt(0) }}</span>
                  <div class="admin-dash__item-body">
                    <p class="admin-dash__item-title">{{ c.title }}</p>
                    <p class="admin-dash__item-meta">{{ c.code || 'Course' }} · {{ c.status }}</p>
                  </div>
                </li>
              </ul>
              <p v-else class="admin-dash__empty">No courses yet.</p>
            </section>
          </div>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent, IonButton,
} from '@ionic/vue';
import { peopleOutline, schoolOutline, bookOutline, documentTextOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import StatCard from '@/components/common/StatCard.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { supabase } from '@/lib/supabase';

interface UserRow { id: string; first_name: string; last_name: string; email: string; role_name: string; }
interface CourseRow { id: string; title: string; code: string | null; status: string; }

const loading = ref(true);
const error = ref<string | null>(null);
const recentUsers = ref<UserRow[]>([]);
const recentCourses = ref<CourseRow[]>([]);
const stats = ref({ users: 0, instructors: 0, courses: 0, announcements: 0 });

async function load() {
  error.value = null;
  try {
    const [usersRes, coursesRes, annsRes] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, email, created_at, roles(name)').is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
      supabase.from('courses').select('id, title, code, status, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
      supabase.from('announcements').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    ]);

    const users = (usersRes.data ?? []).map((u) => {
      const role = (u as { roles: { name: string } | { name: string }[] }).roles;
      const r = Array.isArray(role) ? role[0] : role;
      return { ...u, role_name: r?.name ?? 'STUDENT' } as UserRow;
    });
    recentUsers.value = users;
    recentCourses.value = (coursesRes.data ?? []) as CourseRow[];

    stats.value = {
      users: users.length,
      instructors: users.filter((u) => u.role_name === 'INSTRUCTOR').length,
      courses: coursesRes.data?.length ?? 0,
      announcements: annsRes.count ?? 0,
    };
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load dashboard.';
  } finally {
    loading.value = false;
  }
}

async function onRefresh(ev: CustomEvent) {
  await load();
  (ev.target as HTMLIonRefresherElement).complete();
}

onMounted(load);
</script>

<style scoped>
.admin-dash__stats { display: grid; gap: var(--size-3, 0.75rem); grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.admin-dash__grid { display: grid; gap: var(--size-4, 1rem); grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
.admin-dash__panel { padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.admin-dash__panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--size-3, 0.75rem); }
.admin-dash__panel-head h2 { margin: 0; font-size: var(--plumi-text-md); }
.admin-dash__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
.admin-dash__item { display: flex; align-items: center; gap: var(--size-3, 0.75rem); padding: var(--size-2, 0.5rem); border-radius: var(--plumi-radius-md); cursor: pointer; }
.admin-dash__item:hover { background: var(--plumi-surface-muted); }
.admin-dash__avatar { display: grid; place-items: center; width: 36px; height: 36px; border-radius: var(--radius-round); background: var(--plumi-primary-soft); color: var(--plumi-primary); font-weight: var(--plumi-weight-bold); }
.admin-dash__avatar--course { background: var(--plumi-success-soft); color: var(--plumi-success); }
.admin-dash__item-body { flex: 1; min-width: 0; }
.admin-dash__item-title { margin: 0; font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-dash__item-meta { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.admin-dash__role { font-size: var(--plumi-text-xs); padding: 2px 8px; border-radius: var(--radius-round); background: var(--plumi-primary-soft); color: var(--plumi-primary); }
.admin-dash__empty { color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); text-align: center; padding: var(--size-3, 0.75rem); }
</style>