<template>
  <ion-page class="plumi-page">
    <div class="layout">
      <button
        v-if="mobileNavOpen"
        class="drawer-backdrop"
        type="button"
        aria-label="Close navigation menu"
        tabindex="-1"
        @click="closeMobileNav"
      />

      <aside
        id="plumi-sidebar"
        class="sidebar"
        :class="{
          'sidebar--collapsed': collapsed && !isMobile,
          'sidebar--mobile-open': mobileNavOpen,
        }"
        :aria-hidden="isMobile ? !mobileNavOpen : undefined"
        :inert="isMobile && !mobileNavOpen"
        @keydown.esc="closeMobileNav"
        @keydown.tab="trapDrawerFocus"
      >
        <div class="sidebar__brand">
          <img src="/assets/plumi-brand.jpg" alt="" class="sidebar__logo" />
          <span v-if="showSidebarLabels" class="sidebar__name">Plumi</span>

          <button
            v-if="isMobile"
            ref="closeButton"
            class="icon-button sidebar__close"
            type="button"
            aria-label="Close navigation menu"
            @click="closeMobileNav"
          >
            <ion-icon :icon="closeOutline" />
          </button>
        </div>

        <div v-if="showSidebarLabels" class="sidebar__section-label">
          Workspace
        </div>

        <nav class="sidebar__nav" aria-label="Main navigation">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="sidebar__link"
            :class="{ 'sidebar__link--active': isActive(item.to) }"
            :aria-current="isActive(item.to) ? 'page' : undefined"
            :aria-label="item.label"
            :title="showSidebarLabels ? undefined : item.label"
            @click="closeMobileNav"
          >
            <ion-icon :icon="item.icon" aria-hidden="true" />
            <span v-if="showSidebarLabels">{{ item.label }}</span>
          </RouterLink>
        </nav>

        <div class="sidebar__footer">
          <RouterLink
            to="/app/profile"
            class="user-card"
            :class="{ 'user-card--active': isActive('/app/profile') }"
            :aria-current="isActive('/app/profile') ? 'page' : undefined"
            aria-label="View profile"
            title="View profile"
            @click="closeMobileNav"
          >
            <span class="user-card__avatar">{{ userInitials }}</span>
            <span v-if="showSidebarLabels" class="user-card__meta">
              <strong>{{ displayName }}</strong>
              <small>{{ displayRole }}</small>
            </span>
          </RouterLink>

          <button
            v-if="!isMobile"
            class="sidebar__action"
            type="button"
            :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="collapsed = !collapsed"
          >
            <ion-icon :icon="collapsed ? arrowForwardOutline : arrowBackOutline" />
            <span v-if="showSidebarLabels">Collapse sidebar</span>
          </button>

          <button
            class="sidebar__action sidebar__action--logout"
            type="button"
            aria-label="Log out"
            :disabled="loggingOut"
            @click="openLogoutModal"
          >
            <ion-icon :icon="logOutOutline" />
            <span v-if="showSidebarLabels">
              {{ loggingOut ? 'Signing out…' : 'Log out' }}
            </span>
          </button>
        </div>
      </aside>

      <main class="main" :inert="isMobile && mobileNavOpen">
        <header class="topbar">
          <div class="topbar__heading">
            <span class="topbar__eyebrow">{{ displayRole }} workspace</span>
            <p class="topbar__title">{{ pageTitle }}</p>
          </div>

          <div class="topbar__actions">
            <NotificationBell />

            <button
              class="icon-button"
              type="button"
              :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
              @click="toggle"
            >
              <ion-icon :icon="isDark ? sunnyOutline : moonOutline" />
            </button>

            <button
              v-if="isMobile"
              class="user-card__avatar topbar__avatar"
              type="button"
              aria-label="Open account menu"
              @click="openMobileNav"
            >
              {{ userInitials }}
            </button>
          </div>
        </header>

        <div class="content-wrapper">
          <ion-router-outlet class="content-outlet" />
        </div>

        <nav v-if="isMobile" class="mobile-tabs" aria-label="Quick navigation">
          <RouterLink
            v-for="item in mobileNavItems"
            :key="item.to"
            :to="item.to"
            :class="{ 'mobile-tabs__active': isActive(item.to) }"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            <ion-icon :icon="item.icon" aria-hidden="true" />
            <span>{{ item.icon === bookOutline ? 'Courses' : item.label }}</span>
          </RouterLink>

          <button
            ref="moreButton"
            type="button"
            aria-controls="plumi-sidebar"
            :aria-expanded="mobileNavOpen"
            :class="{ 'mobile-tabs__active': isMoreActive }"
            @click="openMobileNav"
          >
            <ion-icon :icon="ellipsisHorizontalOutline" aria-hidden="true" />
            <span>More</span>
          </button>
        </nav>
      </main>
    </div>

    <ion-alert
      css-class="plumi-logout-alert"
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { IonAlert, IonIcon, IonPage, IonRouterOutlet } from '@ionic/vue';
import {
  arrowBackOutline,
  arrowForwardOutline,
  bookOutline,
  chatbubblesOutline,
  closeOutline,
  documentTextOutline,
  ellipsisHorizontalOutline,
  homeOutline,
  listOutline,
  logOutOutline,
  moonOutline,
  peopleOutline,
  sunnyOutline,
  trophyOutline,
  videocamOutline,
} from 'ionicons/icons';
import { useTheme } from '@/composables/useTheme';
import { useAuthStore } from '@/stores/authStore';
import NotificationBell from '@/components/layout/NotificationBell.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { isDark, toggle } = useTheme();

const viewport = window.matchMedia('(max-width: 960px)');
const isMobile = ref(viewport.matches);
const collapsed = ref(false);
const mobileNavOpen = ref(false);
const loggingOut = ref(false);
const logoutModalOpen = ref(false);
const closeButton = ref<HTMLButtonElement | null>(null);
const moreButton = ref<HTMLButtonElement | null>(null);

let drawerTrigger: HTMLElement | null = null;

const showSidebarLabels = computed(() => isMobile.value || !collapsed.value);
const role = computed(() => auth.user?.role ?? 'student');

const displayRole = computed(
  () => role.value.charAt(0).toUpperCase() + role.value.slice(1),
);

const displayName = computed(() => {
  const user = auth.user;
  if (!user) return 'Guest';

  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
});

const userInitials = computed(() =>
  displayName.value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase(),
);

const sharedLinks = [
  { to: '/app/messages', label: 'Messages', icon: chatbubblesOutline },
  { to: '/app/meetings', label: 'Meetings', icon: videocamOutline },
];

const navItems = computed(() => {
  if (role.value === 'admin') {
    return [
      { to: '/app/admin/dashboard', label: 'Dashboard', icon: homeOutline },
      { to: '/app/admin/users', label: 'Users', icon: peopleOutline },
      { to: '/app/admin/courses', label: 'All Courses', icon: bookOutline },
      { to: '/app/admin/announcements', label: 'Announcements', icon: documentTextOutline },
      { to: '/app/admin/activity', label: 'Activity Logs', icon: listOutline },
    ];
  }

  if (role.value === 'instructor') {
    return [
      { to: '/app/instructor/dashboard', label: 'Dashboard', icon: homeOutline },
      { to: '/app/instructor/courses', label: 'My Courses', icon: bookOutline },
      ...sharedLinks,
    ];
  }

  return [
    { to: '/app/student/dashboard', label: 'Dashboard', icon: homeOutline },
    { to: '/app/student/courses', label: 'My Courses', icon: bookOutline },
    { to: '/app/student/assignments', label: 'Assignments', icon: documentTextOutline },
    { to: '/app/student/grades', label: 'Grades', icon: trophyOutline },
    ...sharedLinks,
  ];
});

const mobileNavItems = computed(() =>
  navItems.value.filter((item) =>
    item.icon === homeOutline ||
    item.icon === bookOutline ||
    sharedLinks.some((link) => link.to === item.to),
  ),
);

const isMoreActive = computed(() =>
  mobileNavOpen.value || mobileNavItems.value.every((item) => !isActive(item.to)),
);

function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`);
}

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

const pageTitle = computed(() => titles[String(route.name)] ?? 'Plumi');

function syncViewport(event: MediaQueryListEvent) {
  isMobile.value = event.matches;

  if (!isMobile.value) {
    mobileNavOpen.value = false;
    drawerTrigger = null;
  }
}

onMounted(() => viewport.addEventListener('change', syncViewport));
onBeforeUnmount(() => viewport.removeEventListener('change', syncViewport));

async function openMobileNav(event: MouseEvent) {
  if (!isMobile.value || mobileNavOpen.value) return;

  drawerTrigger = event.currentTarget instanceof HTMLElement
    ? event.currentTarget
    : null;

  mobileNavOpen.value = true;
  await nextTick();
  closeButton.value?.focus();
}

function closeMobileNav() {
  if (!mobileNavOpen.value) return;

  const trigger = drawerTrigger;
  drawerTrigger = null;
  mobileNavOpen.value = false;

  void nextTick(() => {
    if (!mobileNavOpen.value && !logoutModalOpen.value) {
      (trigger?.isConnected ? trigger : moreButton.value)?.focus();
    }
  });
}

function trapDrawerFocus(event: KeyboardEvent) {
  if (!isMobile.value || !mobileNavOpen.value) return;

  const container = event.currentTarget as HTMLElement;
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
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

  logoutModalOpen.value = true;
  closeMobileNav();
}

async function confirmLogout() {
  if (loggingOut.value) return;

  loggingOut.value = true;

  try {
    await auth.logout();
  } finally {
    loggingOut.value = false;
    logoutModalOpen.value = false;
    await router.replace({ name: 'login' });
  }
}
</script>

<style scoped>
.plumi-page,
.layout {
  width: 100%;
  height: 100%;
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
  flex: 0 0 var(--plumi-sidebar-width, 248px);
  flex-direction: column;
  min-height: 0;
  padding: 24px 16px 16px;
  border-right: 1px solid var(--plumi-sidebar-border);
  background: var(--plumi-sidebar-bg);
}

.sidebar--collapsed {
  flex-basis: var(--plumi-sidebar-collapsed-width, 84px);
  padding-inline: 12px;
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  margin-bottom: 24px;
  padding-inline: 10px;
}

.sidebar__logo {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  object-fit: cover;
}

.sidebar__name {
  font-size: 25px;
  font-weight: 750;
  letter-spacing: -0.05em;
}

.sidebar__section-label {
  padding: 0 14px 10px;
  color: var(--plumi-sidebar-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.sidebar__nav {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  overflow: auto;
}

.sidebar__link,
.sidebar__action {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 10px 14px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--plumi-sidebar-ink);
  font: inherit;
  font-size: 13px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.sidebar__link ion-icon,
.sidebar__action ion-icon {
  flex: 0 0 20px;
  font-size: 20px;
}

.sidebar__link:hover,
.sidebar__action:hover {
  background: var(--plumi-sidebar-hover);
}

.sidebar__link--active {
  background: var(--plumi-sidebar-active-bg);
  color: var(--plumi-sidebar-active-ink);
  font-weight: 700;
  box-shadow: inset 3px 0 var(--plumi-primary);
}

.sidebar__footer {
  display: grid;
  flex-shrink: 0;
  gap: 6px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--plumi-sidebar-border);
}

.sidebar__action--logout {
  color: var(--plumi-danger);
}

.user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--plumi-border);
  border-radius: 14px;
  background: var(--plumi-primary-subtle);
  color: inherit;
  text-decoration: none;
}

.user-card:hover,
.user-card--active {
  background: var(--plumi-primary-soft);
}

.user-card__avatar {
  display: grid;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: var(--plumi-primary-soft);
  color: var(--plumi-primary);
  font-size: 12px;
  font-weight: 700;
}

.user-card__meta {
  display: grid;
  gap: 3px;
  min-width: 0;
  font-size: 12px;
}

.user-card__meta strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-card__meta small {
  color: var(--plumi-text-muted);
}

.sidebar--collapsed .sidebar__brand,
.sidebar--collapsed .sidebar__link,
.sidebar--collapsed .sidebar__action,
.sidebar--collapsed .user-card {
  justify-content: center;
  padding-inline: 0;
}

.main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.topbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: var(--plumi-topbar-height, 76px);
  padding: 10px 32px;
  border-bottom: 1px solid var(--plumi-border);
  background: var(--plumi-surface);
}

.topbar__heading {
  display: grid;
  gap: 4px;
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
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

.icon-button {
  display: inline-grid;
  width: 40px;
  height: 40px;
  place-items: center;
  padding: 0;
  border: 1px solid var(--plumi-border);
  border-radius: 12px;
  background: var(--plumi-surface);
  color: var(--plumi-ink);
  cursor: pointer;
}

.icon-button ion-icon {
  font-size: 20px;
}

.icon-button:hover {
  background: var(--plumi-primary-soft);
  color: var(--plumi-primary);
}

.content-wrapper {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.content-outlet {
  position: absolute;
  inset: 0;
}

.drawer-backdrop,
.mobile-tabs {
  display: none;
}

@media (max-width: 960px) {
  .topbar {
    min-height: 60px;
    padding: max(8px, env(safe-area-inset-top)) 12px 8px;
  }

  .topbar__eyebrow {
    display: none;
  }

  .topbar__avatar {
    cursor: pointer;
  }

  .drawer-backdrop {
    position: fixed;
    z-index: 90;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: rgb(23 10 27 / 48%);
  }

  .sidebar {
    position: fixed;
    z-index: 100;
    inset: auto 0 0;
    width: 100%;
    max-height: 85vh;
    max-height: 85dvh;
    padding: 16px 16px max(16px, env(safe-area-inset-bottom));
    border-right: 0;
    border-radius: 22px 22px 0 0;
    box-shadow: var(--plumi-shadow-drawer);
    visibility: hidden;
    transform: translateY(100%);
    transition: transform 220ms, visibility 220ms;
  }

  .sidebar--mobile-open {
    visibility: visible;
    transform: translateY(0);
  }

  .sidebar__brand {
    margin-bottom: 12px;
  }

  .sidebar__close {
    margin-inline-start: auto;
  }

  .mobile-tabs {
    display: grid;
    flex-shrink: 0;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 4px;
    padding: 6px 8px max(6px, env(safe-area-inset-bottom));
    border-top: 1px solid var(--plumi-border);
    background: var(--plumi-surface);
  }

  .mobile-tabs :is(a, button) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 0;
    min-height: 48px;
    padding: 4px 0;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--plumi-text-muted);
    font: inherit;
    font-size: 10px;
    text-decoration: none;
    cursor: pointer;
  }

  .mobile-tabs ion-icon {
    font-size: 22px;
  }

  .mobile-tabs .mobile-tabs__active {
    background: var(--plumi-primary-soft);
    color: var(--plumi-primary);
    font-weight: 700;
  }
}

@media (max-width: 380px) {
  .topbar__avatar {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar {
    transition: none;
  }
}
</style>