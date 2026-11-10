<!-- src/views/student/ai/GamifiedSessionPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />

        <!-- Active session -->
        <template v-else-if="session && !finished">
          <header class="gs__hud">
            <span>{{ session.index.value + 1 }} / {{ session.total.value }}</span>
            <span>Score: {{ session.score.value }}</span>
            <span v-if="session.streak.value > 1" class="gs__streak">
              🔥 {{ session.streak.value }} · x{{ session.comboMultiplier.value }}
            </span>
          </header>

          <div class="gs__bar"><div :style="{ width: session.progress.value + '%' }" /></div>

          <article v-if="session.current.value" class="gs__card">
            <p class="gs__difficulty">{{ session.current.value.difficulty }}</p>
            <h2 class="gs__question">{{ session.current.value.question }}</h2>

            <div class="gs__choices">
              <button
                v-for="(opt, i) in session.current.value.options"
                :key="i"
                class="gs__choice"
                :class="choiceClass(opt)"
                :disabled="!!feedback"
                @click="choose(opt)"
              >{{ opt }}</button>
            </div>

            <div v-if="feedback" class="gs__feedback" :class="feedback.correct ? 'good' : 'encourage'">
              <p v-if="feedback.correct">✅ Correct · +{{ feedback.gained }} pts</p>
              <p v-else>💪 Not quite — the answer is <strong>{{ feedback.correctAnswer }}</strong></p>
              <p v-if="feedback.explanation" class="gs__explain">{{ feedback.explanation }}</p>
              <ion-button expand="block" @click="advance">
                {{ session.isLast.value ? 'See summary' : 'Next question' }}
              </ion-button>
            </div>
          </article>
        </template>

        <!-- Summary -->
        <template v-else-if="finished && summary">
          <section class="gs__summary">
            <h1>Session complete 🎉</h1>
            <div class="gs__stats">
              <div><strong>{{ summary.score }}</strong><span>Score</span></div>
              <div><strong>{{ Math.round(summary.accuracy) }}%</strong><span>Accuracy</span></div>
              <div><strong>{{ summary.longestStreak }}</strong><span>Best streak</span></div>
              <div><strong>{{ summary.durationSeconds }}s</strong><span>Duration</span></div>
            </div>
            <p class="gs__bonus">Completion bonus: +{{ summary.completionBonus }}</p>
            <p v-if="saveError" class="gs__save-error">{{ saveError }}</p>
            <ion-button expand="block" @click="backToPractice">Back to practice</ion-button>
          </section>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonContent, IonButton } from '@ionic/vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import {
  getGeneration,
  listGenerationQuestions,
  getGamificationSettings,
  completeQuestionSession,
} from '@/services/ai';
import { useGamifiedSession, type AnswerFeedback } from '@/composables/useGamifiedSession';

const route = useRoute();
const router = useRouter();
const generationId = route.params.generationId as string;

const loading = ref(true);
const error = ref<string | null>(null);
const saveError = ref<string | null>(null);

const session = ref<ReturnType<typeof useGamifiedSession> | null>(null);
const feedback = ref<AnswerFeedback | null>(null);
const selectedChoice = ref<string | null>(null);
const finished = ref(false);
const summary = ref<ReturnType<NonNullable<typeof session.value>['finish']> | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [_, questions, settings] = await Promise.all([
      getGeneration(generationId),
      listGenerationQuestions(generationId),
      getGamificationSettings(),
    ]);
    if (!questions.length) throw new Error('This generation has no questions.');

    if (!settings.enabled) {
      // Gamification disabled globally: still allow practice, just no scoring UI.
      // For simplicity we fall back to defaults; the UI hides streak/combo when disabled.
    }

    session.value = useGamifiedSession(questions, settings);
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load session.';
  } finally {
    loading.value = false;
  }
}

function choose(opt: string) {
  if (!session.value || feedback.value) return;
  selectedChoice.value = opt;
  feedback.value = session.value.answer(opt);
}

function choiceClass(opt: string): Record<string, boolean> {
  if (!feedback.value || !session.value?.current.value) return {};
  const correct = session.value.current.value.answer;
  return {
    'is-correct': opt === correct,
    'is-wrong': opt === selectedChoice.value && selectedChoice.value !== correct,
  };
}

async function advance() {
  if (!session.value) return;
  const more = session.value.next();
  if (more) {
    feedback.value = null;
    selectedChoice.value = null;
    return;
  }
  const result = session.value.finish();
  summary.value = result;
  finished.value = true;

  try {
    await completeQuestionSession({
      generationId,
      score: result.score,
      accuracy: Number(result.accuracy.toFixed(2)),
      longestStreak: result.longestStreak,
      durationSeconds: result.durationSeconds,
      answers: result.answers,
    });
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save session.';
  }
}

function backToPractice() {
  router.back();
}

onMounted(load);
</script>

<style scoped>
.page-shell--narrow { max-width: 820px; }
.gs__hud { display: flex; gap: var(--size-3, 0.75rem); justify-content: space-between;
  font-size: var(--plumi-text-sm); color: var(--plumi-text-muted); padding: var(--size-2) 0; }
.gs__streak { color: var(--plumi-primary); font-weight: 600; }
.gs__bar { height: 6px; background: var(--plumi-border); border-radius: 999px; overflow: hidden; }
.gs__bar > div { height: 100%; background: var(--plumi-primary); transition: width 200ms ease; }
.gs__card { margin-top: var(--size-5, 1.25rem); padding: var(--plumi-panel-padding);
  border: 1px solid var(--plumi-border); border-radius: 20px; background: var(--plumi-surface); }
.gs__difficulty { font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); margin: 0 0 var(--size-2); letter-spacing: 0.08em; }
.gs__question { margin: 0 0 var(--size-4); font-size: var(--plumi-text-lg); }
.gs__choices { display: grid; gap: var(--size-2, 0.5rem); }
.gs__choice { text-align: left; padding: var(--size-3, 0.75rem) var(--size-4, 1rem);
  border: 1px solid var(--plumi-border); border-radius: 12px; background: var(--plumi-surface);
  color: var(--plumi-ink); cursor: pointer; transition: all 120ms ease; }
.gs__choice:hover:not(:disabled) { border-color: var(--plumi-primary); }
.gs__choice:disabled { cursor: default; opacity: 0.9; }
.gs__choice.is-correct { border-color: var(--plumi-success); background: var(--plumi-success-soft); }
.gs__choice.is-wrong { border-color: var(--plumi-danger); background: var(--plumi-danger-soft); }
.gs__feedback { margin-top: var(--size-4); padding: var(--size-3);
  border-radius: 12px; background: var(--plumi-surface-muted, #f8f9fb); }
.gs__feedback.encourage { background: var(--plumi-warning-soft, #fff8e6); }
.gs__explain { font-size: var(--plumi-text-sm); color: var(--plumi-text-muted); }
.gs__summary { padding: var(--size-6) 0; text-align: center; }
.gs__stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--size-3);
  margin: var(--size-5) 0; }
.gs__stats > div { padding: var(--size-4); border-radius: 16px;
  border: 1px solid var(--plumi-border); background: var(--plumi-surface); }
.gs__stats strong { display: block; font-size: var(--plumi-text-2xl); }
.gs__stats span { color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); }
.gs__bonus { color: var(--plumi-text-muted); }
.gs__save-error { color: var(--plumi-danger); }
</style>