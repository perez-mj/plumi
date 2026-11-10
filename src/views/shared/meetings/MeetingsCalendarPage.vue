<!-- src/views/shared/meetings/MeetingsCalendarPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <!-- Toolbar -->
        <div class="calendar-toolbar">
          <div class="calendar-toolbar__nav">
            <ion-button fill="clear" size="small" @click="navigate(-1)">
              <ion-icon slot="icon-only" :icon="chevronBackOutline" />
            </ion-button>
            <h2 class="calendar-toolbar__title">{{ currentViewTitle }}</h2>
            <ion-button fill="clear" size="small" @click="navigate(1)">
              <ion-icon slot="icon-only" :icon="chevronForwardOutline" />
            </ion-button>
          </div>
          
          <div class="calendar-toolbar__actions">
            <!-- View Switcher -->
            <ion-segment v-model="currentView" class="view-segment" @ionChange="onViewChange">
              <ion-segment-button value="month">Month</ion-segment-button>
              <ion-segment-button value="week">Week</ion-segment-button>
              <ion-segment-button value="day">Day</ion-segment-button>
            </ion-segment>

            <ion-button fill="outline" size="small" @click="goToToday">Today</ion-button>
            <ion-button
              v-if="auth.role === 'instructor' && instructorCourses.length"
              size="small"
              @click="openScheduler"
            >
              <ion-icon slot="start" :icon="addOutline" /> Schedule
            </ion-button>
          </div>
        </div>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        
        <!-- Views -->
        <div v-else class="calendar">
          
          <!-- MONTH VIEW -->
          <div v-if="currentView === 'month'" class="calendar-month">
            <div class="calendar__weekdays">
              <div v-for="day in weekDays" :key="day" class="calendar__weekday">{{ day }}</div>
            </div>
            <div class="calendar__grid">
              <div
                v-for="(cell, index) in monthCells"
                :key="index"
                class="calendar__cell"
                :class="{
                  'is-outside': !cell.isCurrentMonth,
                  'is-today': cell.isToday,
                }"
              >
                <div class="calendar__date">{{ cell.date.getDate() }}</div>
                <div class="calendar__events">
                  <div
                    v-for="m in cell.meetings"
                    :key="m.id"
                    class="event-pill"
                    :class="getStatusClass(m)"
                    @click="join(m)"
                  >
                    <span class="event-pill__time">{{ formatTime(m.scheduled_at) }}</span>
                    <span class="event-pill__title">{{ m.title }}</span>
                    <span v-if="m.status === 'LIVE' && m.participantCount" class="participant-badge">
                      {{ m.participantCount }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- WEEK VIEW -->
          <div v-else-if="currentView === 'week'" class="calendar-week">
            <div class="calendar__weekdays">
              <div v-for="day in weekCells" :key="day.date.toISOString()" class="calendar__weekday" :class="{ 'is-today': day.isToday }">
                <div class="week-day-name">{{ day.dayName }}</div>
                <div class="week-day-num">{{ day.date.getDate() }}</div>
              </div>
            </div>
            <div class="week-grid">
              <div v-for="day in weekCells" :key="day.date.toISOString()" class="week-column">
                <div 
                  v-for="m in day.meetings" 
                  :key="m.id" 
                  class="event-card"
                  :class="getStatusClass(m)"
                  @click="join(m)"
                >
                  <div class="event-card__time">{{ formatTime(m.scheduled_at) }}</div>
                  <div class="event-card__title">{{ m.title }}</div>
                  <div v-if="m.status === 'LIVE'" class="event-card__live">
                    <span class="live-dot"></span> Live
                    <span v-if="m.participantCount">· {{ m.participantCount }}</span>
                  </div>
                </div>
                <div v-if="!day.meetings.length" class="week-column__empty"></div>
              </div>
            </div>
          </div>

          <!-- DAY (TODAY) VIEW -->
          <div v-else-if="currentView === 'day'" class="calendar-day">
            <div v-if="!dayMeetings.length" class="empty-day">
              <EmptyState title="No meetings today" message="You have a free schedule." :icon="videocamOutline" />
            </div>
            <div v-else class="day-list">
              <div 
                v-for="m in dayMeetings" 
                :key="m.id" 
                class="event-card event-card--large"
                :class="getStatusClass(m)"
                @click="join(m)"
              >
                <div class="event-card__header">
                  <div class="event-card__time">{{ formatTime(m.scheduled_at) }} · {{ m.duration }} min</div>
                  <span class="event-card__status">{{ m.status }}</span>
                </div>
                <div class="event-card__title">{{ m.title }}</div>
                <p v-if="m.description" class="event-card__desc">{{ m.description }}</p>
                <div v-if="m.status === 'LIVE'" class="event-card__live">
                  <span class="live-dot"></span> In Progress
                  <span v-if="m.participantCount" class="participant-count">
                    {{ m.participantCount }} participant{{ m.participantCount === 1 ? '' : 's' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Custom Scheduler Modal / Bottom Sheet -->
      <ion-modal
        :is-open="showScheduler"
        @didDismiss="closeScheduler"
        :initial-breakpoint="1"
        :breakpoints="[0, 1]"
        class="scheduler-modal"
      >
        <ng-template>
          <div class="scheduler-sheet">
            <div class="scheduler-sheet__handle"></div>
            
            <div class="scheduler-sheet__header">
              <h2>Schedule a meeting</h2>
              <p>Select a course to start scheduling.</p>
            </div>

            <!-- Search for mobile/desktop convenience -->
            <div v-if="instructorCourses.length > 4" class="scheduler-search">
              <ion-searchbar 
                v-model="courseSearch" 
                placeholder="Search courses..." 
                :debounce="200" 
              />
            </div>

            <div class="scheduler-sheet__list">
              <div 
                v-for="course in filteredCourses" 
                :key="course.id" 
                class="course-option"
                @click="scheduleForCourse(course.id)"
              >
                <div class="course-option__icon">
                  <ion-icon :icon="bookOutline" />
                </div>
                <div class="course-option__info">
                  <div class="course-option__title">{{ course.title }}</div>
                  <div class="course-option__meta">{{ course.status }}</div>
                </div>
                <ion-icon :icon="chevronForwardOutline" class="course-option__arrow" />
              </div>
              
              <div v-if="filteredCourses.length === 0" class="scheduler-sheet__empty">
                No courses found.
              </div>
            </div>

            <div class="scheduler-sheet__footer">
              <ion-button expand="block" fill="outline" color="medium" @click="closeScheduler">
                Cancel
              </ion-button>
            </div>
          </div>
        </ng-template>
      </ion-modal>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent,
  IonButton, IonIcon, IonSegment, IonSegmentButton,
  IonModal, IonSearchbar
} from '@ionic/vue';
import { 
  addOutline, chevronBackOutline, chevronForwardOutline, 
  videocamOutline, bookOutline 
} from 'ionicons/icons';
import EmptyState from '@/components/common/EmptyState.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { useAuthStore } from '@/stores/authStore';
import { listCourses, type CourseWithMeta } from '@/services/courses';
import { listMyMeetings, joinMeeting, type MeetingRow } from '@/services/meetings';

const router = useRouter();
const auth = useAuthStore();

// State
const meetings = ref<(MeetingRow & { participantCount?: number })[]>([]);
const instructorCourses = ref<CourseWithMeta[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const joiningId = ref<string | null>(null);

// Scheduler state
const showScheduler = ref(false);
const courseSearch = ref('');

// Calendar State
const currentView = ref<'month' | 'week' | 'day'>('month');
const currentDate = ref(new Date());
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ---------- Scheduler Logic ---------- */

const filteredCourses = computed(() => {
  if (!courseSearch.value) return instructorCourses.value;
  const query = courseSearch.value.toLowerCase();
  return instructorCourses.value.filter(c => c.title.toLowerCase().includes(query));
});

function openScheduler() {
  courseSearch.value = '';
  showScheduler.value = true;
}

function closeScheduler() {
  showScheduler.value = false;
}

function scheduleForCourse(courseId: string) {
  closeScheduler();
  // Slight delay to allow the modal to close smoothly before routing
  setTimeout(() => {
    router.push({ name: 'instructor-meeting-new', params: { id: courseId } });
  }, 150);
}

/* ---------- Navigation & Titles ---------- */

const currentViewTitle = computed(() => {
  const d = currentDate.value;
  if (currentView.value === 'month') {
    return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }
  if (currentView.value === 'week') {
    const start = getStartOfWeek(d);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
});

function navigate(direction: number) {
  const d = new Date(currentDate.value);
  if (currentView.value === 'month') {
    d.setMonth(d.getMonth() + direction);
  } else if (currentView.value === 'week') {
    d.setDate(d.getDate() + (direction * 7));
  } else {
    d.setDate(d.getDate() + direction);
  }
  currentDate.value = d;
}

function goToToday() {
  currentDate.value = new Date();
}

function onViewChange() {
  if (currentView.value === 'day') {
    currentDate.value = new Date();
  }
}

/* ---------- Date Helpers ---------- */

function getStartOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getDate() === d2.getDate() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getFullYear() === d2.getFullYear();
}

/* ---------- Views Logic ---------- */

const monthCells = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const startDay = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;
  const startDate = new Date(year, month, 1 - startDay);
  const today = new Date();
  const cells = [];

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(startDate);
    cellDate.setDate(startDate.getDate() + i);

    const isCurrentMonth = cellDate.getMonth() === month;
    const isToday = isSameDay(cellDate, today);

    const dayMeetings = meetings.value.filter(m => isSameDay(new Date(m.scheduled_at), cellDate))
      .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));

    cells.push({ date: cellDate, isCurrentMonth, isToday, meetings: dayMeetings });
  }
  return cells;
});

const weekCells = computed(() => {
  const start = getStartOfWeek(currentDate.value);
  const today = new Date();
  const cells = [];
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    
    const dayMeetings = meetings.value.filter(m => isSameDay(new Date(m.scheduled_at), d))
      .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));

    cells.push({
      date: d,
      dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
      isToday: isSameDay(d, today),
      meetings: dayMeetings,
    });
  }
  return cells;
});

const dayMeetings = computed(() => {
  return meetings.value
    .filter(m => isSameDay(new Date(m.scheduled_at), currentDate.value))
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
});

/* ---------- Data Loading ---------- */

async function load() {
  error.value = null;
  try {
    const data = await listMyMeetings();
    meetings.value = data; 

    if (auth.role === 'instructor' && auth.user?.id) {
      const mine = await listCourses({ instructorId: auth.user.id });
      instructorCourses.value = mine.filter((c) => c.status !== 'ARCHIVED');
    } else {
      instructorCourses.value = [];
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally {
    loading.value = false;
  }
}

async function onRefresh(ev: CustomEvent) {
  await load();
  (ev.target as HTMLIonRefresherElement).complete();
}

async function join(m: MeetingRow) {
  if (m.status === 'ENDED' || m.status === 'CANCELLED') return;
  
  joiningId.value = m.id;
  try {
    const { room_name } = await joinMeeting(m.id);
    router.push({ name: 'meeting-room', params: { id: m.id }, query: { room: room_name } });
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Could not join meeting.';
  } finally {
    joiningId.value = null;
  }
}

/* ---------- Formatting & Helpers ---------- */

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function getStatusClass(m: MeetingRow) {
  if (m.status === 'LIVE') return 'is-live';
  if (m.status === 'ENDED' || m.status === 'CANCELLED') return 'is-muted';
  return 'is-scheduled';
}

onMounted(load);
</script>

<style scoped>
/* Toolbar */
.calendar-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--plumi-space-4) 0; margin-bottom: var(--plumi-space-2);
  flex-wrap: wrap; gap: var(--plumi-space-3);
}
.calendar-toolbar__nav { display: flex; align-items: center; gap: var(--plumi-space-2); }
.calendar-toolbar__title { margin: 0; font-size: var(--plumi-text-lg); font-weight: var(--plumi-weight-semibold); min-width: 200px; text-align: center; }
.calendar-toolbar__actions { display: flex; gap: var(--plumi-space-3); align-items: center; flex-wrap: wrap; }
.view-segment { max-width: 300px; }

/* Base Calendar Container */
.calendar {
  background: var(--plumi-surface);
  border: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border);
  border-radius: var(--plumi-radius-lg);
  overflow: hidden;
  box-shadow: var(--plumi-shadow-card);
  display: flex; flex-direction: column;
}

/* Month & Week Header Grid */
.calendar__weekdays {
  display: grid; grid-template-columns: repeat(7, 1fr);
  background: var(--plumi-surface-muted);
  border-bottom: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border);
}
.calendar__weekday {
  padding: var(--plumi-space-3); text-align: center;
  font-size: var(--plumi-text-xs); font-weight: var(--plumi-weight-semibold);
  color: var(--plumi-text-muted); text-transform: uppercase;
}

/* MONTH VIEW */
.calendar__grid { display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(6, minmax(100px, 1fr)); }
.calendar__cell {
  border-right: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border);
  border-bottom: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border);
  padding: var(--plumi-space-1); display: flex; flex-direction: column; gap: var(--plumi-space-1);
  background: var(--plumi-surface); min-width: 0;
}
.calendar__cell:nth-child(7n) { border-right: none; }
.calendar__cell:nth-last-child(-n+7) { border-bottom: none; }
.calendar__cell.is-outside { background: var(--plumi-surface-muted); opacity: 0.6; }
.calendar__cell.is-today { background: var(--plumi-primary-subtle); }
.calendar__date { font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-medium); color: var(--plumi-text-muted); text-align: right; padding-right: var(--plumi-space-1); }
.is-today .calendar__date { color: var(--plumi-primary); font-weight: var(--plumi-weight-bold); }
.calendar__events { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; flex: 1; scrollbar-width: none; }
.calendar__events::-webkit-scrollbar { display: none; }

/* EVENT PILLS */
.event-pill {
  font-size: var(--plumi-text-xs); padding: 2px var(--plumi-space-1);
  border-radius: var(--plumi-radius-sm); cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: flex; gap: var(--plumi-space-1); align-items: center;
  border-left: 3px solid transparent;
  transition: opacity var(--plumi-duration-fast) var(--plumi-easing);
}
.event-pill:hover { opacity: 0.8; }
.event-pill.is-live { background: var(--plumi-success-soft); color: var(--plumi-success); border-left-color: var(--plumi-success); }
.event-pill.is-scheduled { background: var(--plumi-info-soft); color: var(--plumi-info); border-left-color: var(--plumi-info); }
.event-pill.is-muted { background: var(--plumi-surface-muted); color: var(--plumi-text-muted); border-left-color: var(--plumi-text-muted); text-decoration: line-through; opacity: 0.7; cursor: not-allowed; }
.event-pill__time { font-weight: var(--plumi-weight-semibold); }
.participant-badge { background: var(--plumi-success); color: var(--plumi-surface); font-size: 10px; font-weight: var(--plumi-weight-bold); padding: 0 4px; border-radius: var(--plumi-radius-pill); margin-left: auto; }

/* WEEK VIEW */
.week-grid { display: grid; grid-template-columns: repeat(7, 1fr); min-height: 400px; }
.week-column { border-right: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border); padding: var(--plumi-space-2); display: flex; flex-direction: column; gap: var(--plumi-space-2); min-width: 0; }
.week-column:nth-child(7n) { border-right: none; }
.week-column__empty { flex: 1; border-top: 1px dashed var(--plumi-border); margin-top: var(--plumi-space-2); }
.week-day-name { font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); text-transform: uppercase; }
.week-day-num { font-size: var(--plumi-text-lg); font-weight: var(--plumi-weight-bold); color: var(--plumi-ink); }
.calendar__weekday.is-today .week-day-num { color: var(--plumi-primary); background: var(--plumi-primary-soft); border-radius: var(--plumi-radius-pill); width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; margin-top: 4px; }

/* EVENT CARDS */
.event-card { padding: var(--plumi-space-2); border-radius: var(--plumi-radius-md); cursor: pointer; display: flex; flex-direction: column; gap: 4px; border-left: 4px solid transparent; transition: transform var(--plumi-duration-fast) var(--plumi-easing); }
.event-card:hover { transform: translateY(-1px); }
.event-card.is-live { background: var(--plumi-success-soft); border-left-color: var(--plumi-success); color: var(--plumi-ink); }
.event-card.is-scheduled { background: var(--plumi-info-soft); border-left-color: var(--plumi-info); color: var(--plumi-ink); }
.event-card.is-muted { background: var(--plumi-surface-muted); border-left-color: var(--plumi-text-muted); opacity: 0.7; cursor: not-allowed; }
.event-card__time { font-size: var(--plumi-text-xs); font-weight: var(--plumi-weight-semibold); color: var(--plumi-text-muted); }
.event-card.is-live .event-card__time { color: var(--plumi-success); }
.event-card.is-scheduled .event-card__time { color: var(--plumi-info); }
.event-card__title { font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); line-height: var(--plumi-line-tight); }
.event-card__desc { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); overflow-wrap: anywhere; }
.event-card__live { display: flex; align-items: center; gap: 6px; font-size: var(--plumi-text-xs); font-weight: var(--plumi-weight-bold); color: var(--plumi-success); margin-top: 4px; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--plumi-success); animation: pulse 2s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 var(--plumi-success); } 70% { box-shadow: 0 0 0 6px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }

/* DAY VIEW */
.day-list { display: flex; flex-direction: column; gap: var(--plumi-space-3); padding: var(--plumi-space-4); }
.event-card--large { padding: var(--plumi-space-4); border-left-width: 6px; }
.event-card--large .event-card__title { font-size: var(--plumi-text-lg); margin: var(--plumi-space-1) 0; }
.event-card__header { display: flex; justify-content: space-between; align-items: center; }
.event-card__status { font-size: var(--plumi-text-xs); font-weight: var(--plumi-weight-semibold); padding: 2px 8px; border-radius: var(--plumi-radius-pill); background: var(--plumi-surface); text-transform: uppercase; }
.participant-count { margin-left: auto; background: var(--plumi-surface); padding: 2px 8px; border-radius: var(--plumi-radius-pill); font-weight: var(--plumi-weight-semibold); }
.empty-day { padding: var(--plumi-space-6); }

/* ---------- CUSTOM SCHEDULER MODAL / BOTTOM SHEET ---------- */
ion-modal.scheduler-modal {
  --width: 500px;
  --height: auto;
  --max-height: 90vh;
  --border-radius: var(--plumi-radius-lg);
  --box-shadow: var(--plumi-shadow-popover);
  align-items: center;
  justify-content: center;
}
ion-modal.scheduler-modal::part(content) {
  border: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.scheduler-sheet {
  display: flex; flex-direction: column;
  background: var(--plumi-surface);
  width: 100%; height: 100%;
}
.scheduler-sheet__handle { display: none; }
.scheduler-sheet__header { padding: var(--plumi-space-4) var(--plumi-space-4) var(--plumi-space-2); text-align: center; }
.scheduler-sheet__header h2 { margin: 0; font-size: var(--plumi-text-lg); font-weight: var(--plumi-weight-semibold); color: var(--plumi-ink); }
.scheduler-sheet__header p { margin: 4px 0 0; font-size: var(--plumi-text-sm); color: var(--plumi-text-muted); }

.scheduler-search { padding: 0 var(--plumi-space-4); }
.scheduler-search ion-searchbar { --box-shadow: none; padding: 0; }

.scheduler-sheet__list { padding: var(--plumi-space-3) var(--plumi-space-4); display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex: 1; max-height: 50vh; }
.course-option {
  display: flex; align-items: center; gap: var(--plumi-space-3);
  padding: var(--plumi-space-3);
  background: var(--plumi-surface-muted);
  border: var(--plumi-border-width) var(--plumi-border-style) transparent;
  border-radius: var(--plumi-radius-md);
  cursor: pointer; transition: all var(--plumi-duration-fast) var(--plumi-easing);
}
.course-option:hover { background: var(--plumi-primary-subtle); border-color: var(--plumi-primary-soft); }
.course-option__icon {
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: var(--plumi-radius-sm);
  background: var(--plumi-surface); color: var(--plumi-primary);
  box-shadow: var(--plumi-shadow-card); flex-shrink: 0;
}
.course-option__info { flex: 1; min-width: 0; }
.course-option__title { font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); color: var(--plumi-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.course-option__meta { font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); text-transform: capitalize; }
.course-option__arrow { color: var(--plumi-text-muted); flex-shrink: 0; }
.scheduler-sheet__empty { text-align: center; padding: var(--plumi-space-4); color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); }
.scheduler-sheet__footer { padding: var(--plumi-space-3) var(--plumi-space-4) var(--plumi-space-5); border-top: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border); background: var(--plumi-surface); }

/* Mobile Bottom Sheet behavior */
@media (max-width: 768px) {
  ion-modal.scheduler-modal {
    --width: 100%;
    --height: auto;
    --border-radius: var(--plumi-radius-xl) var(--plumi-radius-xl) 0 0;
    align-items: flex-end;
  }
  .scheduler-sheet__handle {
    display: block; width: 36px; height: 5px;
    background: var(--plumi-border-strong);
    border-radius: 10px; margin: 12px auto 0;
  }
  .scheduler-sheet__header { padding-top: var(--plumi-space-3); }
  .scheduler-sheet__footer { padding-bottom: max(var(--plumi-space-5), env(safe-area-inset-bottom)); }
  .scheduler-sheet__list { max-height: 60vh; }
}

/* Responsive Calendar Adjustments */
@media (max-width: 768px) {
  .calendar-toolbar { flex-direction: column; align-items: flex-start; }
  .calendar-toolbar__actions { width: 100%; justify-content: space-between; }
  .calendar-toolbar__title { flex: 1; text-align: center; }
  .calendar__grid { grid-template-rows: repeat(6, minmax(80px, 1fr)); }
  .week-grid { display: flex; flex-direction: column; }
  .week-column { border-right: none; border-bottom: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border); flex-direction: row; align-items: flex-start; gap: var(--plumi-space-3); }
  .week-column__empty { display: none; }
  .event-card { flex: 1; }
}
</style>