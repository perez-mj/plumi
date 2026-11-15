<!-- src/views/instructor/meetings/MeetingSchedulerPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" />
          Back
        </ion-button>

        <h1 class="scheduler__title">Schedule Meeting</h1>

        <LoadingState v-if="loadingCourse" />

        <ErrorState
          v-else-if="loadError"
          :message="loadError"
          @retry="verifyAccess"
        />

        <form v-else class="scheduler__form" @submit.prevent="save">
          <!-- Title -->
          <ion-input
            v-model="form.title"
            label="Title *"
            label-placement="stacked"
            required
            :maxlength="200"
            :counter="true"
            placeholder="e.g. CS101 — Week 3 Review"
          />

          <!-- Description -->
          <ion-textarea
            v-model="form.description"
            label="Description"
            label-placement="stacked"
            :rows="3"
            :auto-grow="true"
            :maxlength="1000"
            :counter="true"
          />

          <!-- ============ SCHEDULED AT — custom picker ============ -->
          <div class="scheduler__field">
            <span class="scheduler__field-label">Scheduled at *</span>

            <!-- Quick picks -->
            <div class="quickpicks">
              <button
                v-for="qp in quickPicks"
                :key="qp.label"
                type="button"
                class="quickpick"
                :class="{ 'quickpick--active': isQuickPickActive(qp) }"
                @click="applyQuickPick(qp)"
              >
                {{ qp.label }}
              </button>
            </div>

            <!-- Date + time row -->
            <div class="dt-row">
              <!-- Date button opens inline calendar popover -->
              <div class="dt-date">
                <button
                  type="button"
                  class="dt-date__trigger"
                  @click="toggleCalendar"
                  :aria-expanded="calendarOpen"
                >
                  <ion-icon :icon="calendarOutline" class="dt-date__icon" />
                  <span class="dt-date__value">{{ formattedDate || 'Pick a date' }}</span>
                  <ion-icon
                    :icon="calendarOpen ? chevronUpOutline : chevronDownOutline"
                    class="dt-date__chevron"
                  />
                </button>

                <!-- Inline calendar popover -->
                <div v-if="calendarOpen" class="cal" @click.stop>
                  <div class="cal__header">
                    <button type="button" class="cal__nav" @click="calNavigate(-1)">
                      <ion-icon :icon="chevronBackOutline" />
                    </button>
                    <span class="cal__title">{{ calMonthLabel }}</span>
                    <button type="button" class="cal__nav" @click="calNavigate(1)">
                      <ion-icon :icon="chevronForwardOutline" />
                    </button>
                  </div>
                  <div class="cal__weekdays">
                    <span v-for="d in ['S','M','T','W','T','F','S']" :key="d">{{ d }}</span>
                  </div>
                  <div class="cal__grid">
                    <button
                      v-for="cell in calCells"
                      :key="cell.key"
                      type="button"
                      class="cal__cell"
                      :class="{
                        'cal__cell--outside': !cell.inMonth,
                        'cal__cell--today': cell.isToday,
                        'cal__cell--selected': cell.isSelected,
                        'cal__cell--disabled': cell.isDisabled,
                      }"
                      :disabled="cell.isDisabled"
                      @click="pickDate(cell.date)"
                    >
                      {{ cell.date.getDate() }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Time selects -->
              <div class="dt-time">
                <select v-model.number="hour12" class="dt-time__select" aria-label="Hour">
                  <option v-for="h in 12" :key="h" :value="h">{{ h }}</option>
                </select>
                <span class="dt-time__sep">:</span>
                <select v-model.number="minute" class="dt-time__select" aria-label="Minute">
                  <option v-for="m in minuteOptions" :key="m" :value="m">
                    {{ String(m).padStart(2, '0') }}
                  </option>
                </select>
                <select v-model="meridiem" class="dt-time__select dt-time__select--mer" aria-label="AM/PM">
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>

            <p v-if="validationHint" class="scheduler__hint">{{ validationHint }}</p>
          </div>
          <!-- ============ END SCHEDULED AT ============ -->

          <!-- Duration — single select, with "Custom…" revealing a number input -->
          <ion-select
            v-model="durationPreset"
            label="Duration"
            label-placement="stacked"
            interface="popover"
            @ionChange="onDurationPresetChange"
          >
            <ion-select-option :value="30">30 minutes</ion-select-option>
            <ion-select-option :value="45">45 minutes</ion-select-option>
            <ion-select-option :value="60">1 hour</ion-select-option>
            <ion-select-option :value="90">1.5 hours</ion-select-option>
            <ion-select-option :value="120">2 hours</ion-select-option>
            <ion-select-option value="custom">Custom…</ion-select-option>
          </ion-select>

          <ion-input
            v-if="durationPreset === 'custom'"
            v-model.number="customDuration"
            type="number"
            label="Custom duration (minutes)"
            label-placement="stacked"
            :min="5"
            :max="480"
            step="5"
            required
          />

          <!-- Actions -->
          <div class="scheduler__actions">
            <ion-button fill="clear" type="button" @click="$router.back()">
              Cancel
            </ion-button>
            <ion-button type="submit" :disabled="!canSave">
              {{ saving ? 'Scheduling…' : 'Schedule' }}
            </ion-button>
          </div>

          <p v-if="saveError" class="scheduler__error">
            {{ saveError }}
          </p>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { onIonViewWillEnter } from '@ionic/vue';
import {
  IonPage,
  IonContent,
  IonButton,
  IonIcon,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
} from '@ionic/vue';
import {
  arrowBackOutline,
  calendarOutline,
  chevronBackOutline,
  chevronDownOutline,
  chevronForwardOutline,
  chevronUpOutline,
} from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { getCourse } from '@/services/courses';
import { createMeeting } from '@/services/meetings';
import { useAuthStore } from '@/stores/authStore';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const courseId = route.params.id as string;

const loadingCourse = ref(true);
const loadError = ref<string | null>(null);
const saving = ref(false);
const saveError = ref<string | null>(null);

const PRESETS = [30, 45, 60, 90, 120] as const;

const form = ref({
  title: '',
  description: '',
  duration: 60,
});

// ---------- Date/time state ----------
// We keep the date (without time) and the time (hour/min/meridiem) separately,
// then combine them into form.scheduledAt (ISO string) via a computed setter.

const selectedDate = ref<Date>(defaultDate()); // date part only, time zeroed
const hour12 = ref(3);
const minute = ref(0);
const meridiem = ref<'AM' | 'PM'>('PM');

// Which minute values to offer (every 5 min feels natural)
const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

// ---------- Duration state ----------
const durationPreset = ref<number | 'custom'>(60);
const customDuration = ref<number | null>(null);

// ---------- Calendar state ----------
const calendarOpen = ref(false);
const calCursor = ref<Date>(startOfMonth(selectedDate.value));

// ---------- Quick pick state ----------
// We snapshot the resolved target at click time so relative picks
// ("In 30 min") don't drift on every re-render.
const activeQuickPickLabel = ref<string | null>(null);
const activeQuickPickTarget = ref<Date | null>(null);

// ---------- Defaults ----------
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function defaultDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function defaultTime(): { h: number; m: number; mer: 'AM' | 'PM' } {
  // Default to next 15-min slot, one hour from now
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  d.setHours(d.getHours() + 1);
  const h24 = d.getHours();
  const mer: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { h: h12, m: d.getMinutes(), mer };
}

function randomSuffix(): string {
  return Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0');
}

// ---------- Combine date + time into ISO ----------
const combinedDateTime = computed<Date>(() => {
  const d = new Date(selectedDate.value);
  let h24 = hour12.value % 12;
  if (meridiem.value === 'PM') h24 += 12;
  d.setHours(h24, minute.value, 0, 0);
  return d;
});

// ISO string used by createMeeting
const scheduledAtIso = computed<string>(() => combinedDateTime.value.toISOString());

// ---------- Validation ----------
const validationHint = computed<string | null>(() => {
  const dt = combinedDateTime.value;
  if (dt.getTime() <= Date.now()) {
    return 'Pick a time in the future.';
  }
  return null;
});

const canSave = computed(() => {
  if (saving.value) return false;
  if (!form.value.title.trim()) return false;
  if (!selectedDate.value) return false;
  if (validationHint.value) return false;
  if (form.value.duration < 5 || form.value.duration > 480) return false;
  return true;
});

// ---------- Formatting ----------
const formattedDate = computed(() => {
  if (!selectedDate.value) return '';
  return selectedDate.value.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
});

// ---------- Quick picks ----------
interface QuickPick {
  label: string;
  resolve: () => Date;
}

const quickPicks: QuickPick[] = [
  {
    label: 'In 30 min',
    resolve: () => roundUp(new Date(Date.now() + 30 * 60_000)),
  },
  {
    label: 'In 1 hour',
    resolve: () => roundUp(new Date(Date.now() + 60 * 60_000)),
  },
  {
    label: 'Tomorrow 9 AM',
    resolve: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

function roundUp(d: Date): Date {
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5);
  return d;
}

function isQuickPickActive(qp: QuickPick): boolean {
  // Compare against the snapshot taken when the pick was applied,
  // not against a freshly-resolved target.
  if (activeQuickPickLabel.value !== qp.label) return false;
  if (!activeQuickPickTarget.value) return false;
  const dt = combinedDateTime.value;
  return Math.abs(dt.getTime() - activeQuickPickTarget.value.getTime()) < 60_000;
}

function applyQuickPick(qp: QuickPick) {
  const target = qp.resolve();

  // Snapshot the target so the highlight doesn't drift for relative picks.
  activeQuickPickLabel.value = qp.label;
  activeQuickPickTarget.value = target;

  selectedDate.value = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const h24 = target.getHours();
  meridiem.value = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  hour12.value = h12;
  minute.value = target.getMinutes();
  calCursor.value = startOfMonth(selectedDate.value);
}

// Clear the quick-pick highlight when the user edits the date/time manually
// so it doesn't stay highlighted incorrectly.
watch([selectedDate, hour12, minute, meridiem], () => {
  if (!activeQuickPickTarget.value) return;
  const dt = combinedDateTime.value;
  if (Math.abs(dt.getTime() - activeQuickPickTarget.value.getTime()) >= 60_000) {
    activeQuickPickLabel.value = null;
    activeQuickPickTarget.value = null;
  }
});

// ---------- Calendar ----------
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toggleCalendar() {
  calendarOpen.value = !calendarOpen.value;
  if (calendarOpen.value) {
    calCursor.value = startOfMonth(selectedDate.value);
  }
}

function calNavigate(dir: number) {
  const d = new Date(calCursor.value);
  d.setMonth(d.getMonth() + dir);
  calCursor.value = d;
}

const calMonthLabel = computed(() =>
  calCursor.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
);

interface CalCell {
  key: string;
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
}

const calCells = computed<CalCell[]>(() => {
  const year = calCursor.value.getFullYear();
  const month = calCursor.value.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startWeekday);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sel = selectedDate.value;
  const selMidnight = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate());

  const cells: CalCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const inMonth = d.getMonth() === month;
    const isDisabled = d.getTime() < today.getTime();
    cells.push({
      key: d.toISOString(),
      date: d,
      inMonth,
      isToday: sameDay(d, today),
      isSelected: sameDay(d, selMidnight),
      isDisabled,
    });
  }
  return cells;
});

function pickDate(d: Date) {
  selectedDate.value = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  calendarOpen.value = false;
  // The watcher above will clear the quick-pick highlight if the
  // combined datetime no longer matches the snapshot.
}

// Close calendar on outside click
function onDocumentClick(ev: MouseEvent) {
  if (!calendarOpen.value) return;
  const target = ev.target as HTMLElement | null;
  if (target && target.closest('.dt-date')) return;
  calendarOpen.value = false;
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
});

// ---------- Duration sync ----------
function syncDuration() {
  if (durationPreset.value === 'custom') {
    const n = Number(customDuration.value);
    if (Number.isFinite(n) && n >= 5 && n <= 480) {
      form.value.duration = n;
    }
  } else {
    form.value.duration = durationPreset.value;
  }
}

function onDurationPresetChange(ev: CustomEvent) {
  durationPreset.value = ev.detail.value as number | 'custom';
  syncDuration();
}

function ensureCustomDuration(): void {
  if (durationPreset.value === 'custom') {
    syncDuration();
  }
}

// ---------- Access verification & auto-fill ----------
async function verifyAccess() {
  loadingCourse.value = true;
  loadError.value = null;

  try {
    const course = await getCourse(courseId);

    if (course.instructor_id !== auth.user?.id) {
      throw new Error(
        'You do not have permission to schedule meetings for this course.',
      );
    }

    if (!form.value.title.trim()) {
      const code =
        (course.code && course.code.trim()) ||
        course.title.trim().slice(0, 8).toUpperCase();
      form.value.title = `${code} — ${randomSuffix()}`;
    }

    // Seed date/time from defaults only if the user hasn't already
    // applied a quick pick (which would have set the snapshot).
    if (!activeQuickPickTarget.value) {
      const t = defaultTime();
      hour12.value = t.h;
      minute.value = t.m;
      meridiem.value = t.mer;
      selectedDate.value = defaultDate();
      calCursor.value = startOfMonth(selectedDate.value);
    }

    // Seed duration controls.
    durationPreset.value = (PRESETS as readonly number[]).includes(form.value.duration)
      ? form.value.duration
      : 'custom';
    if (durationPreset.value === 'custom') {
      customDuration.value = form.value.duration;
    }
  } catch (error: unknown) {
    loadError.value =
      error instanceof Error ? error.message : 'Failed to load course.';
  } finally {
    loadingCourse.value = false;
  }
}

// ---------- Save ----------
async function save() {
  ensureCustomDuration();
  if (!canSave.value) return;

  saving.value = true;
  saveError.value = null;

  try {
    await createMeeting({
      course_id: courseId,
      title: form.value.title.trim(),
      description: form.value.description.trim() || null,
      scheduled_at: scheduledAtIso.value,
      duration: form.value.duration,
    });

    router.push({ name: 'meetings' });
  } catch (error: unknown) {
    saveError.value =
      error instanceof Error ? error.message : 'Failed to schedule.';
  } finally {
    saving.value = false;
  }
}

// ---------- Lifecycle ----------
onMounted(verifyAccess);

onIonViewWillEnter(() => {
  if (loadError.value) {
    verifyAccess();
  }
});

// Keep minute valid if the user picks a value not in minuteOptions
watch(minute, (m) => {
  if (!minuteOptions.includes(m)) {
    minute.value = minuteOptions.reduce(
      (best, v) => (Math.abs(v - m) < Math.abs(best - m) ? v : best),
      minuteOptions[0],
    );
  }
});
</script>

<style scoped>
.page-shell--narrow {
  max-width: 560px;
}

.scheduler__title {
  margin: 0 0 var(--plumi-space-4, 1rem);
  font-size: var(--plumi-text-2xl);
  letter-spacing: -0.03em;
}

.scheduler__form {
  display: flex;
  flex-direction: column;
  gap: var(--plumi-space-4, 1rem);
  padding: var(--plumi-panel-padding, 1rem);
  border: 1px solid var(--plumi-border);
  border-radius: 20px;
  background: var(--plumi-surface);
  box-shadow: var(--plumi-shadow-card);
  min-width: 0;
}

.scheduler__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.scheduler__field-label {
  padding-inline: 16px;
  font-size: var(--plumi-text-sm);
  font-weight: 600;
  color: var(--plumi-text-muted);
}

.scheduler__hint {
  margin: 0;
  padding-inline: 16px;
  font-size: var(--plumi-text-xs);
  color: var(--plumi-danger);
}

/* ---------- Quick picks ---------- */
.quickpicks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-inline: 4px;
}

.quickpick {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border: 1px solid var(--plumi-border);
  border-radius: var(--plumi-radius-pill);
  background: var(--plumi-surface);
  color: var(--plumi-text-muted);
  font: inherit;
  font-size: var(--plumi-text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: border-color 120ms, background 120ms, color 120ms;
}
.quickpick:hover {
  border-color: var(--plumi-primary-soft);
  background: var(--plumi-primary-subtle);
  color: var(--plumi-primary);
}
.quickpick--active {
  border-color: var(--plumi-primary);
  background: var(--plumi-primary-soft);
  color: var(--plumi-primary);
}

/* ---------- Date + time row ---------- */
.dt-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.dt-date {
  position: relative;
  flex: 1 1 180px;
  min-width: 0;
}

.dt-date__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--plumi-surface-muted);
  color: var(--plumi-ink);
  font: inherit;
  font-size: 0.95rem;
  cursor: pointer;
  transition: border-color 160ms, box-shadow 160ms;
}
.dt-date__trigger:hover {
  border-color: var(--plumi-border-strong);
}
.dt-date__trigger:focus-visible {
  outline: none;
  border-color: var(--plumi-primary);
  box-shadow: var(--plumi-focus-ring);
}

.dt-date__icon {
  color: var(--plumi-text-muted);
  font-size: 18px;
  flex-shrink: 0;
}

.dt-date__value {
  flex: 1;
  text-align: left;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dt-date__chevron {
  color: var(--plumi-text-muted);
  font-size: 16px;
  flex-shrink: 0;
}

/* ---------- Inline calendar popover ---------- */
.cal {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  width: min(280px, calc(100vw - 40px));
  padding: 12px;
  border: 1px solid var(--plumi-border);
  border-radius: var(--plumi-radius-lg);
  background: var(--plumi-surface);
  box-shadow: var(--plumi-shadow-popover);
}

.cal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.cal__title {
  font-size: var(--plumi-text-sm);
  font-weight: 700;
  color: var(--plumi-ink);
}

.cal__nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--plumi-text-muted);
  cursor: pointer;
}
.cal__nav:hover {
  background: var(--plumi-surface-muted);
  color: var(--plumi-ink);
}

.cal__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 700;
  color: var(--plumi-text-muted);
  text-transform: uppercase;
}
.cal__weekdays span {
  text-align: center;
  padding: 4px 0;
}

.cal__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal__cell {
  aspect-ratio: 1;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--plumi-ink);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 120ms, color 120ms;
}
.cal__cell:hover:not(:disabled) {
  background: var(--plumi-surface-muted);
}
.cal__cell--outside {
  color: var(--plumi-text-subtle);
}
.cal__cell--today {
  font-weight: 800;
  color: var(--plumi-primary);
}
.cal__cell--selected,
.cal__cell--selected:hover {
  background: var(--plumi-primary);
  color: var(--plumi-primary-contrast);
  font-weight: 700;
}
.cal__cell--disabled {
  color: var(--plumi-text-subtle);
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---------- Time selects ---------- */
.dt-time {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 1 auto;
}

.dt-time__select {
  min-height: 48px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--plumi-surface-muted);
  color: var(--plumi-ink);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  text-align: center;
  cursor: pointer;
  transition: border-color 160ms, box-shadow 160ms;
}
.dt-time__select:hover {
  border-color: var(--plumi-border-strong);
}
.dt-time__select:focus {
  outline: none;
  border-color: var(--plumi-primary);
  box-shadow: var(--plumi-focus-ring);
}

.dt-time__sep {
  color: var(--plumi-text-muted);
  font-weight: 700;
}

.dt-time__select--mer {
  min-width: 60px;
}

/* ---------- Actions / errors ---------- */
.scheduler__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.scheduler__error {
  margin: 0;
  color: var(--plumi-danger);
  font-size: var(--plumi-text-sm);
}

@media (max-width: 600px) {
  .dt-row {
    flex-direction: column;
  }
  .dt-date {
    flex-basis: auto;
  }
  .dt-time {
    justify-content: space-between;
    width: 100%;
  }
  .dt-time__select {
    flex: 1;
  }
  .scheduler__actions > ion-button {
    flex: 1 1 auto;
    min-height: 44px;
  }
}
</style>