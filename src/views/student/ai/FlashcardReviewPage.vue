<!-- src/views/student/ai/FlashcardReviewPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />

        <template v-else-if="cards.length">
          <!-- Meta strip: course + material + detail level -->
          <header class="fr__meta">
            <p v-if="courseCode || courseTitle" class="fr__course">
              <span v-if="courseCode" class="fr__code">{{ courseCode }}</span>
              <span v-if="courseTitle" class="fr__course-title">{{ courseTitle }}</span>
            </p>
            <p v-if="materialTitle" class="fr__material">{{ materialTitle }}</p>
            <p class="fr__detail">
              <span class="fr__detail-badge" :class="`is-${detailLevel.toLowerCase()}`">
                {{ detailLabel }}
              </span>
              <span class="fr__count">{{ cards.length }} cards</span>
            </p>
          </header>

          <!-- Progress HUD -->
          <div class="fr__hud">
            <span>{{ index + 1 }} / {{ cards.length }}</span>
            <span class="fr__known">{{ knownCount }} known</span>
          </div>

          <div class="fr__bar">
            <div :style="{ width: progress + '%' }" />
          </div>

          <!-- Card. Click handler is on the wrapper — the flip transform on the
     inner card never fights the click area or the pointer-events. -->
          <div :key="current?.id ?? 'empty'" class="fr__stage" :class="{ 'is-leaving': leaving, 'is-flipped': flipped }"
            role="button" tabindex="0"
            :aria-label="flipped ? 'Answer side. Tap to show prompt.' : 'Prompt side. Tap to show answer.'"
            @click="flip" @keydown.enter.prevent="flip" @keydown.space.prevent="flip">
            <div class="fr__card">
              <div class="fr__face fr__face--front">
                <p class="fr__side">Prompt</p>
                <p class="fr__text">{{ current?.question }}</p>
                <p class="fr__hint">Tap to flip</p>
              </div>
              <div class="fr__face fr__face--back">
                <p class="fr__side">Answer</p>
                <p class="fr__text">{{ current?.answer }}</p>
                <p class="fr__hint">Tap to flip back</p>
              </div>
            </div>
          </div>

          <!-- Action row: review OR end-of-set -->
          <div v-if="!finished" class="fr__actions">
            <ion-button color="danger" fill="outline" :disabled="saving" @click="mark(false)">
              Don't know
            </ion-button>
            <ion-button color="success" :disabled="saving" @click="mark(true)">
              Known
            </ion-button>
          </div>

          <div v-else class="fr__done">
            <p class="fr__done-title">Set complete 🎉</p>
            <p class="fr__done-text">
              You marked <strong>{{ knownCount }}</strong> of
              <strong>{{ cards.length }}</strong> cards as known.
            </p>
            <div class="fr__done-actions">
              <ion-button fill="outline" :disabled="saving" @click="retake">
                <ion-icon slot="start" :icon="refreshOutline" />
                Retake (shuffled)
              </ion-button>
              <ion-button @click="$router.back()">
                Back to AI Tools
              </ion-button>
            </div>
          </div>
        </template>

        <EmptyState v-else title="No flashcards" message="This set has no cards." :icon="albumsOutline" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { arrowBackOutline, albumsOutline, refreshOutline } from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import {
  listGenerationFlashcards, reviewFlashcard, getGeneration,
  type Flashcard,
} from '@/services/ai';
import { supabase } from '@/lib/supabase';

const route = useRoute();
const generationId = route.params.generationId as string;

/* ---------- State ---------- */
const loading = ref(true);
const error = ref<string | null>(null);
const cards = ref<Flashcard[]>([]);
const index = ref(0);
const flipped = ref(false);
const saving = ref(false);
const knownCount = ref(0);
const leaving = ref(false);

/* Meta loaded from material_generations -> materials -> courses */
const detailLevel = ref<'SHORT' | 'STANDARD' | 'COMPREHENSIVE'>('STANDARD');
const materialTitle = ref<string | null>(null);
const courseTitle = ref<string | null>(null);
const courseCode = ref<string | null>(null);

const current = computed(() => cards.value[index.value] ?? null);
const finished = computed(() => index.value >= cards.value.length);
const progress = computed(() => {
  if (!cards.value.length) return 0;
  return Math.round((index.value / cards.value.length) * 100);
});
const detailLabel = computed(() => {
  const map = { SHORT: 'Short', STANDARD: 'Standard', COMPREHENSIVE: 'Comprehensive' } as const;
  return map[detailLevel.value];
});

/* ---------- Load ---------- */
async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [flashcards, generation] = await Promise.all([
      listGenerationFlashcards(generationId),
      getGeneration(generationId),
    ]);

    cards.value = shuffle(flashcards);
    detailLevel.value = generation.detail_level;

    // Resolve material title + course (title and code).
    // Two lightweight lookups; both tables are RLS-scoped to the caller,
    // so an unauthorized read just returns null and the strip hides itself.
    if (generation.material_id) {
      const { data: material } = await supabase
        .from('materials')
        .select('title, course_id')
        .eq('id', generation.material_id)
        .maybeSingle();
      materialTitle.value = material?.title ?? null;

      if (material?.course_id) {
        const { data: course } = await supabase
          .from('courses')
          .select('title, code')
          .eq('id', material.course_id)
          .maybeSingle();
        courseTitle.value = course?.title ?? null;
        courseCode.value = course?.code ?? null;
      }
    }

    index.value = 0;
    flipped.value = false;
    knownCount.value = 0;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load flashcards.';
  } finally {
    loading.value = false;
  }
}

/* ---------- Shuffle (Fisher–Yates, no AI) ---------- */
function shuffle<T>(input: T[]): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- Flip ---------- */
function flip() {
  if (saving.value) return;
  flipped.value = !flipped.value;
}

/* ---------- Answer / advance ---------- */
async function mark(known: boolean) {
  if (!current.value || saving.value) return;
  saving.value = true;
  try {
    await reviewFlashcard(current.value.id, known);
    if (known) knownCount.value += 1;

    if (index.value < cards.value.length - 1) {
      // Slide-out, then advance + slide-in.
      leaving.value = true;
      await wait(160);
      index.value += 1;
      flipped.value = false;
      leaving.value = false;
    } else {
      // Last card — move to end state.
      index.value = cards.value.length;
      flipped.value = false;
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to save review.';
  } finally {
    saving.value = false;
  }
}

function retake() {
  cards.value = shuffle(cards.value);
  index.value = 0;
  flipped.value = false;
  knownCount.value = 0;
}

/* ---------- Helpers ---------- */
function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

onMounted(load);
</script>

<style scoped>
.page-shell--narrow {
  max-width: 720px;
}

/* ---------- Meta strip ---------- */
.fr__meta {
  padding: var(--size-3, 0.75rem) 0;
  border-bottom: 1px solid var(--plumi-border);
  margin-bottom: var(--size-3, 0.75rem);
}

.fr__course {
  margin: 0;
  display: flex;
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
}

.fr__code {
  font-family: var(--plumi-font-mono);
  font-size: var(--plumi-text-xs);
  color: var(--plumi-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.fr__course-title {
  font-size: var(--plumi-text-sm);
  color: var(--plumi-text-muted);
}

.fr__material {
  margin: 4px 0 0;
  font-size: var(--plumi-text-md);
  font-weight: 600;
}

.fr__detail {
  margin: 6px 0 0;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.fr__detail-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.05em;
  font-weight: 600;
  text-transform: uppercase;
}

.fr__detail-badge.is-short {
  background: var(--plumi-primary-soft);
  color: var(--plumi-primary);
}

.fr__detail-badge.is-standard {
  background: var(--plumi-success-soft, #e8f7ee);
  color: var(--plumi-success, #1a7f48);
}

.fr__detail-badge.is-comprehensive {
  background: var(--plumi-warning-soft, #fff4d6);
  color: var(--plumi-warning, #8a6200);
}

.fr__count {
  font-size: var(--plumi-text-xs);
  color: var(--plumi-text-subtle);
}

/* ---------- HUD + progress ---------- */
.fr__hud {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  color: var(--plumi-text-muted);
  font-size: var(--plumi-text-sm);
}

.fr__known {
  color: var(--plumi-success, #1a7f48);
  font-weight: 600;
}

.fr__bar {
  height: 6px;
  background: var(--plumi-border);
  border-radius: 999px;
  overflow: hidden;
  margin: 4px 0 var(--size-4, 1rem);
}

.fr__bar>div {
  height: 100%;
  background: var(--plumi-primary);
  transition: width 260ms cubic-bezier(0.22, 0.61, 0.36, 1);
}

/* ---------- Card + flip ---------- */
.fr__stage {
  perspective: 1200px;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 160ms ease, transform 160ms ease;
  animation: stage-in 320ms ease both;
  /* The click target. Its box is stable regardless of flip state. */
}
.fr__stage:focus-visible {
  box-shadow: 0 0 0 3px var(--plumi-primary-soft);
  border-radius: 20px;
}
.fr__stage.is-leaving {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

@keyframes stage-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.fr__card {
  position: relative;
  min-height: 260px;
  border-radius: 20px;
  transform-style: preserve-3d;
  transition: transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: transform;
}
.fr__stage.is-flipped .fr__card {
  transform: rotateY(180deg);
}

.fr__face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--size-6, 1.5rem);
  border: 1px solid var(--plumi-border);
  border-radius: 20px;
  background: var(--plumi-surface);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  /* Prevent the hidden face from intercepting clicks. */
  pointer-events: none;
}
.fr__face--front { transform: rotateY(0deg); pointer-events: auto; }
.fr__stage.is-flipped .fr__face--front { pointer-events: none; }
.fr__stage.is-flipped .fr__face--back  { pointer-events: auto; }

.fr__face--back { transform: rotateY(180deg); }

.fr__side {
  color: var(--plumi-text-muted);
  font-size: var(--plumi-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 6px;
}
.fr__text {
  font-size: var(--plumi-text-lg);
  text-align: center;
  margin: 0 0 var(--size-3, 0.75rem);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.fr__hint { color: var(--plumi-text-subtle); font-size: var(--plumi-text-xs); margin: 0; }

/* ---------- Actions ---------- */
.fr__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: var(--size-4, 1rem);
}

@media (max-width: 480px) {
  .fr__actions {
    grid-template-columns: 1fr;
  }
}

/* ---------- Done state ---------- */
.fr__done {
  margin-top: var(--size-4, 1rem);
  padding: var(--size-5, 1.25rem);
  border: 1px solid var(--plumi-border);
  border-radius: 20px;
  background: var(--plumi-primary-subtle);
  text-align: center;
  animation: card-in 320ms ease both;
}

.fr__done-title {
  margin: 0 0 4px;
  font-size: var(--plumi-text-lg);
  font-weight: 700;
}

.fr__done-text {
  margin: 0 0 var(--size-3, 0.75rem);
  color: var(--plumi-text-muted);
  font-size: var(--plumi-text-sm);
}

.fr__done-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

/* Reduced-motion respect */
@media (prefers-reduced-motion: reduce) {
  .fr__card {
    transition: none;
    animation: none;
  }

  .fr__stage {
    transition: none;
  }

  .fr__bar>div {
    transition: none;
  }

  .fr__done {
    animation: none;
  }
}
</style>