<template>
  <ion-page class="plumi-page">
    <div class="layout" :class="{ 'layout--drawer-open': mobileNavOpen }">
      <button
        v-if="mobileNavOpen"
        class="drawer-backdrop"
        type="button"
        aria-label="Close navigation menu"
        @click="closeMobileNav"
      />

      <aside
        id="plumi-sidebar"
        class="sidebar"
        :class="{
          'sidebar--collapsed': collapsed,
          'sidebar--mobile-open': mobileNavOpen,
        }"
        :aria-hidden="isMobile ? !mobileNavOpen : undefined"
        :inert="isMobile && !mobileNavOpen"
        @keydown.esc="closeMobileNav"
        @keydown.tab="trapDrawerFocus"
      >
        <div class="sidebar__brand">
          <div class="sidebar__brand-mark">
            <img
              src="/assets/plumi-brand.jpg"
              alt="Plumi logo"
              class="sidebar__logo"
            />
          </div>

          <span v-if="!collapsed || isMobile" class="sidebar__name">
            Plumi
          </span>

          <button
            v-if="isMobile"
            class="icon-button sidebar__mobile-close"
            type="button"
            aria-label="Close navigation menu"
            @click="closeMobileNav"
          >
            <ion-icon :icon="closeOutline" />
          </button>
        </div>

        <div v-if="!collapsed || isMobile" class="sidebar__section-label">
          WORKSPACE
        </div>

        <nav class="sidebar__nav" aria-label="Main navigation">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="sidebar__link"
            :class="{ 'sidebar__link--active': isActive(item.to) }"
            :aria-current="isActive(item.to) ? 'page' : undefined"
            :title="collapsed ? item.label : undefined"
            @click="closeMobileNav"
          >
            <ion-icon :icon="item.icon" class="sidebar__icon" />

            <span v-if="!collapsed || isMobile" class="sidebar__link-label">
              {{ item.label }}
            </span>
          </RouterLink>
        </nav>

        <div class="sidebar__footer">
          <RouterLink
            v-if="!collapsed || isMobile"
            to="/app/profile"
            class="user-card"
            :class="{ 'user-card--active': isActive('/app/profile') }"
            :aria-current="isActive('/app/profile') ? 'page' : undefined"
            title="View profile"
            @click="closeMobileNav"
          >
            <div class="user-card__avatar">{{ userInitials }}</div>

            <div class="user-card__meta">
              <span class="user-card__name">{{ displayName }}</span>
              <span class="user-card__role">{{ displayRole }}</span>
            </div>
          </RouterLink>

          <button
            v-if="!isMobile"
            class="sidebar__action"
            type="button"
            :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="collapsed = !collapsed"
          >
            <ion-icon
              :icon="collapsed ? arrowForwardOutline : arrowBackOutline"
            />
            <span v-if="!collapsed || isMobile">Collapse sidebar</span>
          </button>

          <button
            class="sidebar__action sidebar__action--logout"
            type="button"
            :title="collapsed ? 'Log out' : undefined"
            :disabled="loggingOut"
            @click="openLogoutModal"
          >
            <ion-icon :icon="logOutOutline" />
            <span v-if="!collapsed || isMobile">
              {{ loggingOut ? 'Signing out…' : 'Log out' }}
            </span>
          </button>
        </div>
      </aside>

      <main class="main" :inert="isMobile && mobileNavOpen">
        <header class="topbar">
          <div class="topbar__left">
            <button
              v-if="isMobile"
              class="icon-button topbar__menu"
              type="button"
              aria-label="Open navigation menu"
              aria-controls="plumi-sidebar"
              :aria-expanded="mobileNavOpen"
              @click="openMobileNav"
            >
              <ion-icon :icon="menuOutline" />
            </button>

            <div class="topbar__heading">
              <span class="topbar__eyebrow">
                {{ displayRole }} workspace
              </span>
              <p class="topbar__title">{{ pageTitle }}</p>
            </div>
          </div>

          <div class="topbar__actions">
            <RealtimeStatusBadge
              :status="realtimeStatus"
              :show-label="!isMobile"
            />

            <NotificationBell />

            <button
              class="icon-button theme-toggle"
              type="button"
              :aria-label="
                isDark ? 'Switch to light mode' : 'Switch to dark mode'
              "
              :title="isDark ? 'Light mode' : 'Dark mode'"
              @click="toggle"
            >
              <ion-icon :icon="isDark ? sunnyOutline : moonOutline" />
            </button>

            <button
              v-if="isMobile"
              class="user-avatar-button"
              type="button"
              aria-label="Open navigation and account menu"
              @click="openMobileNav"
            >
              {{ userInitials }}
            </button>
          </div>
        </header>

        <div class="content-wrapper">
          <ion-router-outlet class="content-outlet" />
        </div>

        <nav
          v-if="
            isMobile &&
            route.name !== 'messages' &&
            route.name !== 'meeting-room'
          "
          class="mobile-tabs"
          aria-label="Quick navigation"
        >
          <RouterLink
            v-for="item in mobileNavItems"
            :key="item.to"
            :to="item.to"
            :class="{ 'mobile-tabs__active': isActive(item.to) }"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            <ion-icon :icon="item.icon" />
            <span>
              {{
                item.label === 'My Courses' || item.label === 'All Courses'
                  ? 'Courses'
                  : item.label
              }}
            </span>
          </RouterLink>
        </nav>
      </main>
    </div>

    <ion-alert
      :is-open="logoutModalOpen"
      header="Log out?"
      message="You'll need to sign in again to access your courses."
      :buttons="logoutButtons"
      :backdrop-dismiss="false"
      @didDismiss="logoutModalOpen = false"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { IonPage, IonIcon, IonRouterOutlet, IonAlert } from '@ionic/vue';

import {
  homeOutline,
  bookOutline,
  chatbubblesOutline,
  videocamOutline,
  personOutline,
  arrowForwardOutline,
  arrowBackOutline,
  sunnyOutline,
  moonOutline,
  logOutOutline,
  peopleOutline,
  documentTextOutline,
  menuOutline,
  closeOutline,
  listOutline,
  trophyOutline,
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
  isMobile.value = event
    ? event.matches
    : window.matchMedia('(max-width: 960px)').matches;

  if (!isMobile.value) {
    mobileNavOpen.value = false;
  }
}

onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 960px)');
  syncViewport();
  mediaQuery.addEventListener('change', syncViewport);
});

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener('change', syncViewport);
});

async function openMobileNav() {
  if (!isMobile.value) return;

  mobileNavOpen.value = true;
  await nextTick();

  document
    .querySelector<HTMLButtonElement>('.sidebar__mobile-close')
    ?.focus();
}

function trapDrawerFocus(event: KeyboardEvent) {
  if (!isMobile.value || !mobileNavOpen.value) return;

  const container = event.currentTarget as HTMLElement;

  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled])',
    ),
  );

  const first = elements[0];
  const last = elements[elements.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function closeMobileNav() {
  const wasOpen = mobileNavOpen.value;
  mobileNavOpen.value = false;

  if (wasOpen) {
    void nextTick(() => {
      document
        .querySelector<HTMLButtonElement>('.topbar__menu')
        ?.focus();
    });
  }
}

const displayName = computed(() => {
  const user = auth.user;

  if (!user) return 'Guest';

  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.email
  );
});

const displayRole = computed(() => {
  const role = auth.user?.role ?? 'student';
  return role.charAt(0).toUpperCase() + role.slice(1);
});

const userInitials = computed(() => {
  const user = auth.user;

  if (!user) return 'G';

  const name = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase();
  }

  return user.email?.charAt(0).toUpperCase() ?? 'U';
});

const navItems = computed(() => {
  const role = auth.user?.role ?? 'student';

  if (role === 'admin') {
    return [
      {
        to: '/app/admin/dashboard',
        label: 'Dashboard',
        icon: homeOutline,
      },
      {
        to: '/app/admin/users',
        label: 'Users',
        icon: peopleOutline,
      },
      {
        to: '/app/admin/courses',
        label: 'All Courses',
        icon: bookOutline,
      },
      {
        to: '/app/admin/announcements',
        label: 'Announcements',
        icon: documentTextOutline,
      },
      {
        to: '/app/admin/activity',
        label: 'Activity Logs',
        icon: listOutline,
      },
    ];
  }

  if (role === 'instructor') {
    return [
      {
        to: '/app/instructor/dashboard',
        label: 'Dashboard',
        icon: homeOutline,
      },
      {
        to: '/app/instructor/courses',
        label: 'My Courses',
        icon: bookOutline,
      },
      {
        to: '/app/messages',
        label: 'Messages',
        icon: chatbubblesOutline,
      },
      {
        to: '/app/meetings',
        label: 'Meetings',
        icon: videocamOutline,
      },
    ];
  }

  return [
    {
      to: '/app/student/dashboard',
      label: 'Dashboard',
      icon: homeOutline,
    },
    {
      to: '/app/student/courses',
      label: 'My Courses',
      icon: bookOutline,
    },
    {
      to: '/app/student/assignments',
      label: 'Assignments',
      icon: documentTextOutline,
    },
    {
      to: '/app/student/grades',
      label: 'Grades',
      icon: trophyOutline,
    },
    {
      to: '/app/messages',
      label: 'Messages',
      icon: chatbubblesOutline,
    },
    {
      to: '/app/meetings',
      label: 'Meetings',
      icon: videocamOutline,
    },
  ];
});

const mobileNavItems = computed(() =>
  navItems.value.filter(
    (item, index) =>
      index === 0 ||
      item.icon === bookOutline ||
      item.to === '/app/messages',
  ),
);

function isActive(path: string) {
  if (path === '/app') {
    return route.path === '/app' || route.path === '/app/';
  }

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
  {
    text: 'Cancel',
    role: 'cancel',
    handler: () => {
      logoutModalOpen.value = false;
    },
  },
  {
    text: loggingOut.value ? 'Signing out…' : 'Log out',
    role: 'destructive',
    handler: () => {
      void confirmLogout();
    },
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
  display: flex;
  flex: 0 0 var(--plumi-sidebar-width);
  flex-direction: column;
  width: var(--plumi-sidebar-width);
  min-width: 0;
  height: 100%;
  padding: 26px 16px 18px;
  border-right: 1px solid var(--plumi-sidebar-border);
  background: var(--plumi-sidebar-bg);
  transition: width 200ms, flex-basis 200ms;
}

.sidebar--collapsed {
  flex-basis: 84px;
  width: 84px;
  padding-inline: 12px;
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 0 10px;
  margin-bottom: 34px;
}

.sidebar__brand-mark {
  display: grid;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  place-items: center;
  overflow: hidden;
  border-radius: 14px;
  background: var(--plumi-brand);
}

.sidebar__logo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sidebar__name {
  font-size: 25px;
  font-weight: 750;
  letter-spacing: -0.05em;
  color: var(--plumi-ink);
}

.sidebar__section-label {
  padding: 0 14px;
  margin: 0 0 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--plumi-sidebar-muted);
}

.sidebar__nav {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  overflow-y: auto;
  padding: 3px;
}

.sidebar__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 12px 14px;
  border-radius: 12px;
  color: var(--plumi-sidebar-ink);
  text-decoration: none;
  font-size: 13px;
  font-weight: 550;
  transition: background 160ms, color 160ms;
}

.sidebar__link:hover {
  background: var(--plumi-sidebar-hover);
}

.sidebar__link--active {
  background: var(--plumi-sidebar-active-bg);
  color: var(--plumi-sidebar-active-ink);
  font-weight: 700;
}

.sidebar__link--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 16px;
  bottom: 16px;
  width: 3px;
  border-radius: 4px;
  background: var(--plumi-primary);
}

.sidebar__icon {
  flex: 0 0 20px;
  font-size: 20px;
}

.sidebar__footer {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 6px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--plumi-sidebar-border);
}

.user-card {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid var(--plumi-border);
  border-radius: 14px;
  background: var(--plumi-primary-subtle);
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  transition: background 160ms, border-color 160ms;
}

.user-card:hover {
  background: var(--plumi-sidebar-hover);
}

.user-card--active {
  border-color: var(--plumi-primary);
  background: var(--plumi-primary-soft);
}

.user-card__avatar,
.user-avatar-button {
  display: grid;
  flex: 0 0 36px;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 12px;
  background: var(--plumi-primary-soft);
  color: var(--plumi-primary);
  font-weight: 700;
  font-size: 12px;
}

.user-card__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.user-card__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 650;
}

.user-card__role {
  color: var(--plumi-text-muted);
  font-size: 10px;
}

.sidebar__action {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 42px;
  width: 100%;
  padding: 10px 14px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--plumi-sidebar-ink);
  text-align: left;
  font-size: 12px;
  cursor: pointer;
}

.sidebar__action ion-icon {
  flex: 0 0 18px;
  font-size: 18px;
}

.sidebar__action:hover {
  background: var(--plumi-sidebar-hover);
}

.sidebar__action--logout {
  color: var(--plumi-danger);
}

.sidebar--collapsed .sidebar__brand {
  justify-content: center;
  padding: 0;
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
  display: flex;
  flex: 0 0 var(--plumi-topbar-height);
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 36px;
  border-bottom: 1px solid var(--plumi-border);
  background: var(--plumi-surface);
}

.topbar__left,
.topbar__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.topbar__heading {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.topbar__eyebrow {
  color: var(--plumi-text-muted);
  font-size: 10px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.topbar__title {
  overflow: hidden;
  margin: 0;
  font-size: 15px;
  line-height: 1.3;
  font-weight: 650;
  letter-spacing: -0.025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-button {
  display: inline-grid;
  flex: 0 0 40px;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--plumi-border);
  border-radius: 12px;
  background: var(--plumi-surface);
  color: var(--plumi-ink);
  cursor: pointer;
}

.icon-button ion-icon {
  font-size: 19px;
}

.icon-button:hover {
  background: var(--plumi-primary-soft);
  color: var(--plumi-primary);
}

.content-wrapper {
  position: relative;
  flex: 1;
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

.drawer-backdrop {
  position: fixed;
  z-index: 90;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: rgb(23 10 27 / 48%);
}

.sidebar__mobile-close,
.mobile-tabs {
  display: none;
}

@media (max-width: 960px) {
  .topbar {
    flex-basis: auto;
    min-height: 68px;
    padding: max(10px, env(safe-area-inset-top)) 16px 10px;
    gap: 8px;
  }

  .topbar__eyebrow {
    display: none;
  }

  .topbar__title {
    font-size: 15px;
  }

  .topbar__left {
    flex: 1;
    gap: 10px;
  }

  .topbar__actions {
    gap: 8px;
  }

  .sidebar,
  .sidebar--collapsed {
    position: fixed;
    z-index: 100;
    inset: 0 auto 0 0;
    flex-basis: auto;
    width: min(310px, 87vw);
    height: 100%;
    height: 100dvh;
    padding:
      max(24px, env(safe-area-inset-top))
      16px
      max(18px, env(safe-area-inset-bottom));
    box-shadow: var(--plumi-shadow-drawer);
    visibility: hidden;
    transform: translateX(-105%);
    transition: transform 220ms, visibility 220ms;
  }

  .sidebar--mobile-open {
    visibility: visible;
    transform: translateX(0);
  }

  .sidebar--collapsed .sidebar__brand {
    justify-content: flex-start;
    padding: 0 10px;
  }

  .sidebar--collapsed .sidebar__link,
  .sidebar--collapsed .sidebar__action {
    justify-content: flex-start;
    padding-inline: 14px;
  }

  .sidebar__mobile-close {
    display: inline-grid;
    margin-left: auto;
  }

  .sidebar__brand {
    margin-bottom: 24px;
  }

  .mobile-tabs {
    display: grid;
    flex-shrink: 0;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
    padding: 8px 10px max(8px, env(safe-area-inset-bottom));
    border-top: 1px solid var(--plumi-border);
    background: var(--plumi-surface);
  }

  .mobile-tabs a {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 48px;
    border-radius: 12px;
    color: var(--plumi-text-muted);
    text-decoration: none;
    font-size: 10px;
    font-weight: 550;
  }

  .mobile-tabs ion-icon {
    font-size: 21px;
  }

  .mobile-tabs a.mobile-tabs__active {
    color: var(--plumi-primary);
    background: var(--plumi-primary-soft);
    font-weight: 700;
  }
}

@media (max-width: 380px) {
  .topbar {
    padding-inline: 10px;
  }

  .topbar__actions {
    gap: 5px;
  }

  .user-avatar-button {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar {
    transition: none;
  }
}
</style>