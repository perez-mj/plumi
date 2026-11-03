<!-- src/layouts/DefaultLayout.vue -->
<template>
  <ion-page class="plumi-page">
    <div class="layout" :class="{ 'layout--drawer-open': mobileNavOpen }">
      <button v-if="mobileNavOpen" class="drawer-backdrop" type="button" aria-label="Close navigation menu"
        @click="closeMobileNav" />

      <aside id="plumi-sidebar" class="sidebar" :class="{
        'sidebar--collapsed': collapsed,
        'sidebar--mobile-open': mobileNavOpen,
      }" :aria-hidden="isMobile ? !mobileNavOpen : undefined">
        <div class="sidebar__brand">
          <div class="sidebar__brand-mark">
            <img src="/assets/plumi-bg-transparent-object-512.png" alt="Plumi logo" class="sidebar__logo" />
          </div>
          <span v-if="!collapsed" class="sidebar__name">Plumi</span>
          <button v-if="isMobile" class="icon-button sidebar__mobile-close" type="button"
            aria-label="Close navigation menu" @click="closeMobileNav">
            <ion-icon :icon="closeOutline" />
          </button>
        </div>

        <div v-if="!collapsed" class="sidebar__section-label">WORKSPACE</div>

        <nav class="sidebar__nav" aria-label="Main navigation">
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="sidebar__link"
            :class="{ 'sidebar__link--active': isActive(item.to) }"
            :aria-current="isActive(item.to) ? 'page' : undefined" :title="collapsed ? item.label : undefined"
            @click="closeMobileNav">
            <ion-icon :icon="item.icon" class="sidebar__icon" />
            <span v-if="!collapsed" class="sidebar__link-label">{{ item.label }}</span>
          </RouterLink>
        </nav>

        <div class="sidebar__footer">
          <div v-if="!collapsed" class="user-card">
            <div class="user-card__avatar">{{ userInitials }}</div>
            <div class="user-card__meta">
              <span class="user-card__name">{{ displayName }}</span>
              <span class="user-card__role">{{ displayRole }}</span>
            </div>
          </div>

          <button v-if="!isMobile" class="sidebar__action" type="button"
            :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'" @click="collapsed = !collapsed">
            <ion-icon :icon="collapsed ? arrowForwardOutline : arrowBackOutline" />
            <span v-if="!collapsed">Collapse sidebar</span>
          </button>

          <button class="sidebar__action sidebar__action--logout" type="button"
            :title="collapsed ? 'Log out' : undefined" :disabled="loggingOut" @click="openLogoutModal">
            <ion-icon :icon="logOutOutline" />
            <span v-if="!collapsed">{{ loggingOut ? 'Signing out…' : 'Log out' }}</span>
          </button>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div class="topbar__left">
            <button v-if="isMobile" class="icon-button topbar__menu" type="button" aria-label="Open navigation menu"
              aria-controls="plumi-sidebar" :aria-expanded="mobileNavOpen" @click="openMobileNav">
              <ion-icon :icon="menuOutline" />
            </button>
            <div class="topbar__heading">
              <h1 class="topbar__title">{{ pageTitle }}</h1>
            </div>
          </div>

          <div class="topbar__actions">
            <RealtimeStatusBadge :status="realtimeStatus" :show-label="!isMobile" />
            <NotificationBell />
            <button class="icon-button theme-toggle" type="button"
              :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
              :title="isDark ? 'Light mode' : 'Dark mode'" @click="toggle">
              <ion-icon :icon="isDark ? sunnyOutline : moonOutline" />
            </button>
            <button v-if="isMobile" class="user-avatar-button" type="button"
              aria-label="Open navigation and account menu" @click="openMobileNav">
              {{ userInitials }}
            </button>
          </div>
        </header>

        <!--
          The outlet is the ONLY child here. Each routed page owns its own
          <ion-content> scroll surface AND its own padding, via the
          .page-shell class documented below.
        -->
        <div class="content-wrapper">
          <ion-router-outlet class="content-outlet" />
        </div>
      </main>
    </div>

    <ion-alert :is-open="logoutModalOpen" header="Log out?"
      message="You'll need to sign in again to access your courses." :buttons="logoutButtons" :backdrop-dismiss="false"
      @didDismiss="logoutModalOpen = false" />
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { IonPage, IonIcon, IonRouterOutlet, IonAlert } from '@ionic/vue';

import {
  homeOutline, bookOutline, chatbubblesOutline, videocamOutline, personOutline,
  arrowForwardOutline, arrowBackOutline, sunnyOutline, moonOutline, logOutOutline,
  peopleOutline, documentTextOutline, menuOutline, closeOutline, searchOutline,
  listOutline, trophyOutline,
} from 'ionicons/icons';

import { useTheme } from '@/composables/useTheme';
import { useAuthStore } from '@/stores/authStore';
import NotificationBell from '@/components/layout/NotificationBell.vue';
import RealtimeStatusBadge from '@/components/realtime/RealtimeStatusBadge.vue';
import { useNotifications } from '@/composables/useNotifications';

const { isDark, toggle } = useTheme();
const { status: realtimeStatus } = useNotifications();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const collapsed = ref(false);
const mobileNavOpen = ref(false);
const isMobile = ref(false);
const loggingOut = ref(false);
const logoutModalOpen = ref(false);

let mediaQuery: MediaQueryList | undefined;

function syncViewport(event?: MediaQueryListEvent) {
  isMobile.value = event ? event.matches : window.matchMedia('(max-width: 767px)').matches;
  if (!isMobile.value) mobileNavOpen.value = false;
}

onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 767px)');
  syncViewport();
  mediaQuery.addEventListener('change', syncViewport);
});
onBeforeUnmount(() => mediaQuery?.removeEventListener('change', syncViewport));

function openMobileNav() { if (isMobile.value) mobileNavOpen.value = true; }
function closeMobileNav() { mobileNavOpen.value = false; }

const displayName = computed(() => {
  const user = auth.user;
  if (!user) return 'Guest';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
});

const displayRole = computed(() => {
  const role = auth.user?.role ?? 'student';
  return role.charAt(0).toUpperCase() + role.slice(1);
});

const userInitials = computed(() => {
  const user = auth.user;
  if (!user) return 'G';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (name) {
    return name.split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase();
  }
  return user.email?.charAt(0).toUpperCase() ?? 'U';
});

const navItems = computed(() => {
  const role = auth.user?.role ?? 'student';
  const shared = [
    { to: '/app/messages', label: 'Messages', icon: chatbubblesOutline },
    { to: '/app/meetings', label: 'Meetings', icon: videocamOutline },
    { to: '/app/profile', label: 'Profile', icon: personOutline },
  ];
  if (role === 'admin') {
    return [
      { to: '/app/admin/dashboard', label: 'Dashboard', icon: homeOutline },
      { to: '/app/admin/users', label: 'Users', icon: peopleOutline },
      { to: '/app/admin/courses', label: 'All Courses', icon: bookOutline },
      { to: '/app/admin/announcements', label: 'Announcements', icon: documentTextOutline },
      { to: '/app/admin/activity', label: 'Activity Logs', icon: listOutline },
      ...shared,
    ];
  }
  if (role === 'instructor') {
    return [
      { to: '/app/instructor/dashboard', label: 'Dashboard', icon: homeOutline },
      { to: '/app/instructor/courses', label: 'My Courses', icon: bookOutline },
      { to: '/app/instructor/assignments', label: 'Assignments', icon: documentTextOutline },
      ...shared,
    ];
  }
  return [
    { to: '/app/student/dashboard', label: 'Dashboard', icon: homeOutline },
    { to: '/app/student/courses', label: 'My Courses', icon: bookOutline },
    { to: '/app/student/assignments', label: 'Assignments', icon: documentTextOutline },
    { to: '/app/student/grades', label: 'Grades', icon: trophyOutline },
    ...shared,
  ];
});

function isActive(path: string) {
  if (path === '/app') return route.path === '/app' || route.path === '/app/';
  return route.path === path || route.path.startsWith(`${path}/`);
}

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    'admin-dashboard': 'Admin Dashboard',
    'admin-users': 'User Management',
    'admin-user-detail': 'User Details',
    'admin-announcements': 'Announcements',
    'admin-courses': 'All Courses',
    'admin-activity': 'Activity Logs',
    'instructor-dashboard': 'Instructor Dashboard',
    'instructor-courses': 'My Courses',
    'instructor-course-new': 'New Course',
    'instructor-course-edit': 'Edit Course',
    'instructor-course-content': 'Course Content',
    'instructor-course-roster': 'Course Roster',
    'instructor-course-announcements': 'Course Announcements',
    'instructor-assignments': 'Assignments',
    'instructor-assignment-new': 'New Assignment',
    'instructor-assignment-edit': 'Edit Assignment',
    'instructor-submissions': 'Submissions',
    'instructor-meeting-new': 'Schedule Meeting',
    'student-dashboard': 'Dashboard',
    'student-courses': 'My Courses',
    'student-courses-browse': 'Browse Courses',
    'student-course-home': 'Course',
    'student-lesson-view': 'Lesson',
    'student-assignments': 'Assignments',
    'student-assignment-submit': 'Submit Assignment',
    'student-grades': 'Grades',
    messages: 'Messages',
    meetings: 'Meetings',
    'meeting-room': 'Meeting Room',
    profile: 'Profile',
  };
  return titles[String(route.name)] ?? 'Plumi';
});

const logoutButtons = computed(() => [
  { text: 'Cancel', role: 'cancel', handler: () => { logoutModalOpen.value = false; } },
  {
    text: loggingOut.value ? 'Signing out…' : 'Log out',
    role: 'destructive',
    handler: () => { void confirmLogout(); },
  },
]);

function openLogoutModal() {
  if (loggingOut.value) return;
  closeMobileNav();
  logoutModalOpen.value = true;
}

async function confirmLogout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  try {
    await auth.logout();
  } finally {
    loggingOut.value = false;
    logoutModalOpen.value = false;
    closeMobileNav();
    await router.replace({ name: 'login' });
  }
}
</script>

<style scoped>
.plumi-page,
.layout {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.layout {
  display: flex;
  overflow: hidden;
  background: var(--plumi-bg);
  color: var(--plumi-ink);
}

.sidebar {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 0 0 var(--plumi-sidebar-width);
  flex-direction: column;
  width: var(--plumi-sidebar-width);
  min-width: 0;
  height: 100%;
  padding: var(--size-4) var(--size-3);
  overflow: hidden;
  background: var(--plumi-sidebar-bg);
  border-right: 1px solid var(--plumi-sidebar-border);
  transition:
    width var(--plumi-duration-normal) var(--plumi-easing),
    flex-basis var(--plumi-duration-normal) var(--plumi-easing);
}

.sidebar--collapsed {
  flex-basis: var(--plumi-sidebar-collapsed-width);
  width: var(--plumi-sidebar-collapsed-width);
  padding-inline: var(--size-2);
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: var(--size-3);
  min-height: 52px;
  padding-inline: var(--size-2);
  margin-bottom: var(--size-6);
}

.sidebar__brand-mark {
  display: grid;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  place-items: center;
  overflow: hidden;
  border-radius: var(--plumi-radius-md);
  background: transparent;
}

.sidebar__logo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.sidebar__name {
  overflow: hidden;
  color: var(--plumi-ink);
  font-family: var(--plumi-font-heading);
  font-size: var(--plumi-text-xl);
  font-weight: var(--plumi-weight-bold);
  letter-spacing: -0.04em;
}

.sidebar__section-label {
  padding: 0 var(--size-3);
  margin-bottom: var(--size-2);
  color: var(--plumi-sidebar-muted);
  font-size: var(--plumi-text-xs);
  font-weight: var(--plumi-weight-semibold);
  letter-spacing: 0.1em;
}

.sidebar__nav {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--size-1);
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--plumi-border-strong) transparent;
}

.sidebar__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--size-3);
  min-height: 46px;
  padding: 0 var(--size-3);
  overflow: hidden;
  border-radius: var(--plumi-radius-md);
  color: var(--plumi-sidebar-ink);
  font-size: var(--plumi-text-sm);
  font-weight: var(--plumi-weight-medium);
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--plumi-duration-fast) ease, background var(--plumi-duration-fast) ease;
}

.sidebar__link:hover {
  background: var(--plumi-sidebar-hover);
  color: var(--plumi-ink);
}

.sidebar__link--active {
  background: var(--plumi-sidebar-active-bg);
  color: var(--plumi-sidebar-active-ink);
  font-weight: var(--plumi-weight-semibold);
}

.sidebar__link--active::before {
  position: absolute;
  inset-block: 10px;
  inset-inline-start: 0;
  width: 3px;
  border-radius: var(--radius-round);
  background: var(--plumi-primary);
  content: "";
}

.sidebar__icon {
  flex: 0 0 22px;
  width: 22px;
  font-size: 21px;
}

.sidebar__link-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__footer {
  display: flex;
  flex-direction: column;
  gap: var(--size-2);
  padding-top: var(--size-3);
  margin-top: var(--size-3);
  border-top: 1px solid var(--plumi-sidebar-border);
}

.user-card {
  display: flex;
  align-items: center;
  gap: var(--size-2);
  min-width: 0;
  padding: var(--size-2);
  margin-bottom: var(--size-1);
  border-radius: var(--plumi-radius-md);
  background: var(--plumi-surface-muted);
}

.user-card__avatar,
.user-avatar-button {
  display: grid;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  place-items: center;
  border: none;
  border-radius: var(--radius-round);
  background: var(--plumi-primary-soft);
  color: var(--plumi-primary);
  font-size: var(--plumi-text-sm);
  font-weight: var(--plumi-weight-bold);
}

.user-card__meta {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.user-card__name {
  overflow: hidden;
  color: var(--plumi-ink);
  font-size: var(--plumi-text-sm);
  font-weight: var(--plumi-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-card__role {
  color: var(--plumi-text-muted);
  font-size: var(--plumi-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.sidebar__action {
  display: flex;
  align-items: center;
  gap: var(--size-3);
  min-height: 42px;
  padding: 0 var(--size-3);
  border: 1px solid transparent;
  border-radius: var(--plumi-radius-md);
  background: transparent;
  color: var(--plumi-sidebar-ink);
  cursor: pointer;
  font-size: var(--plumi-text-sm);
  font-weight: var(--plumi-weight-medium);
  text-align: start;
  transition: background var(--plumi-duration-fast) ease, color var(--plumi-duration-fast) ease;
}

.sidebar__action ion-icon {
  flex: 0 0 22px;
  font-size: 20px;
}

.sidebar__action:hover {
  background: var(--plumi-sidebar-hover);
  color: var(--plumi-ink);
}

.sidebar__action--logout {
  color: var(--plumi-danger);
}

.sidebar__action--logout:hover {
  background: var(--plumi-danger-soft);
  color: var(--plumi-danger);
}

.sidebar__action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.sidebar--collapsed .sidebar__brand {
  justify-content: center;
  padding-inline: 0;
}

.sidebar--collapsed .sidebar__link,
.sidebar--collapsed .sidebar__action {
  justify-content: center;
  padding-inline: 0;
}

.main {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 0;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.topbar {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 0 0 var(--plumi-topbar-height);
  align-items: center;
  justify-content: space-between;
  gap: var(--size-4);
  min-width: 0;
  padding-inline: var(--size-6);
  border-bottom: 1px solid var(--plumi-border);
  background: var(--plumi-surface);
}

.topbar__left,
.topbar__heading,
.topbar__actions {
  display: flex;
  align-items: center;
  min-width: 0;
}

.topbar__left {
  gap: var(--size-3);
}

.topbar__heading {
  gap: var(--size-3);
}

.topbar__title {
  margin: 0;
  overflow: hidden;
  color: var(--plumi-ink);
  font-family: var(--plumi-font-heading);
  font-size: var(--plumi-text-xl);
  font-weight: var(--plumi-weight-bold);
  letter-spacing: -0.035em;
  line-height: var(--plumi-line-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar__actions {
  gap: var(--size-3);
}

.topbar__greeting {
  color: var(--plumi-text-muted);
  font-size: var(--plumi-text-sm);
}

.icon-button {
  display: inline-grid;
  flex: 0 0 var(--plumi-control-height);
  width: var(--plumi-control-height);
  height: var(--plumi-control-height);
  place-items: center;
  padding: 0;
  border: 1px solid var(--plumi-border);
  border-radius: var(--plumi-radius-md);
  background: var(--plumi-surface);
  color: var(--plumi-ink);
  cursor: pointer;
  font-size: 21px;
  transition: background var(--plumi-duration-fast) ease, border-color var(--plumi-duration-fast) ease, color var(--plumi-duration-fast) ease;
}

.icon-button:hover {
  border-color: var(--plumi-primary);
  background: var(--plumi-primary-soft);
  color: var(--plumi-primary);
}

.icon-button:focus-visible,
.sidebar__action:focus-visible,
.sidebar__link:focus-visible {
  outline: 2px solid var(--plumi-primary);
  outline-offset: 2px;
}

.user-avatar-button {
  cursor: pointer;
}

/* ============================================================
   CONTENT AREA — the fix
   ============================================================
   - .content-wrapper is now a *positioning host* only (no padding,
     no scroll). It fills the space between topbar and viewport.
   - ion-router-outlet fills it 100%.
   - Each routed page's <ion-content> is the scroll surface and
     owns its padding via the .page-shell inner div.
   ============================================================ */

.content-wrapper {
  position: relative;
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--plumi-bg);
}

.content-outlet {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Ionic's outlet mounts pages absolutely — make sure our page
   shells get padding from the page itself, not from this file. */

.drawer-backdrop {
  position: fixed;
  z-index: var(--plumi-layer-backdrop);
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: rgb(13 16 34 / 52%);
  cursor: pointer;
  animation: plumi-backdrop-in var(--plumi-duration-normal) ease;
}

.sidebar__mobile-close {
  display: none;
}

@media (max-width: 767px) {
  .topbar {
    flex-basis: 60px;
    height: 60px;
    padding-inline: var(--size-3);
    gap: var(--size-2);
  }

  .topbar__left {
    gap: var(--size-2);
    flex: 1;
  }

  .topbar__heading {
    gap: var(--size-2);
  }

  .topbar__title {
    font-size: var(--plumi-text-lg);
  }

  .topbar__actions {
    gap: var(--size-2);
  }

  .topbar__menu {
    flex-basis: 40px;
    width: 40px;
    height: 40px;
    border-color: transparent;
    background: transparent;
  }

  .theme-toggle {
    flex-basis: 40px;
    width: 40px;
    height: 40px;
  }

  .sidebar {
    position: fixed;
    z-index: var(--plumi-layer-drawer);
    inset-block: 0;
    inset-inline-start: 0;
    width: var(--plumi-mobile-drawer-width);
    max-width: 300px;
    height: 100%;
    height: 100dvh;
    padding:
      max(var(--size-4), env(safe-area-inset-top)) var(--size-3) max(var(--size-3), env(safe-area-inset-bottom));
    box-shadow: var(--plumi-shadow-drawer);
    transform: translateX(-105%);
    visibility: hidden;
    pointer-events: none;
    transition: transform var(--plumi-duration-normal) var(--plumi-easing), visibility var(--plumi-duration-normal);
  }

  .sidebar--collapsed {
    flex-basis: auto;
    width: var(--plumi-mobile-drawer-width);
    max-width: 300px;
    padding-inline: var(--size-3);
  }

  .sidebar--mobile-open {
    transform: translateX(0);
    visibility: visible;
    pointer-events: auto;
    transition: transform var(--plumi-duration-normal) var(--plumi-easing), visibility 0s;
  }

  .sidebar__brand,
  .sidebar--collapsed .sidebar__brand {
    justify-content: flex-start;
    padding-inline: var(--size-2);
    margin-bottom: var(--size-5);
  }

  .sidebar--collapsed .sidebar__link,
  .sidebar--collapsed .sidebar__action {
    justify-content: flex-start;
    padding-inline: var(--size-3);
  }

  .sidebar--collapsed .sidebar__link-label {
    display: inline;
  }

  .sidebar__mobile-close {
    display: inline-grid;
    flex: 0 0 36px;
    width: 36px;
    height: 36px;
    margin-inline-start: auto;
    border-color: transparent;
    background: transparent;
  }

  .user-avatar-button {
    flex-basis: 36px;
    width: 36px;
    height: 36px;
  }
}

@media (prefers-reduced-motion: reduce) {

  .sidebar,
  .sidebar--mobile-open,
  .icon-button,
  .sidebar__link,
  .sidebar__action {
    transition: none;
  }
}

@keyframes plumi-backdrop-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}
</style>