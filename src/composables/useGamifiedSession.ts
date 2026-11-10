// src/composables/useGamifiedSession.ts
import { ref, computed, shallowRef } from 'vue';
import type {
  GamificationSettings,
  PracticeQuestion,
  SessionDraftAnswer,
  Difficulty,
} from '@/types/app';
import type { PracticeQuestion as PQ } from '@/services/ai';

export interface AnswerFeedback {
  correct: boolean;
  gained: number;
  correctAnswer: string;
  explanation: string | null;
}

const BASE_FALLBACK: Record<Difficulty, number> = { EASY: 10, MEDIUM: 20, HARD: 30 };

export function useGamifiedSession(
  questions: PracticeQuestion[],
  settings: GamificationSettings,
) {
  const queue = shallowRef<PracticeQuestion[]>(questions);
  const index = ref(0);
  const score = ref(0);
  const streak = ref(0);
  const longestStreak = ref(0);
  const answers = ref<SessionDraftAnswer[]>([]);
  const startedAt = Date.now();
  let questionStartedAt = Date.now();

  const current = computed(() => queue.value[index.value] ?? null);
  const total = computed(() => queue.value.length);
  const isLast = computed(() => index.value >= total.value - 1);
  const progress = computed(() =>
    total.value === 0 ? 0 : Math.round((index.value / total.value) * 100),
  );

  const comboMultiplier = computed(() => {
    const thresholds = settings.combo_thresholds ?? {};
    const cap = settings.combo_cap ?? 3;
    // Sort ascending by multiplier so the highest passing threshold wins.
    const passed = Object.entries(thresholds)
      .map(([mult, min]) => ({ mult: Number(mult), min: Number(min) }))
      .filter((t) => streak.value >= t.min)
      .sort((a, b) => b.mult - a.mult);
    return Math.min(passed[0]?.mult ?? 1, cap);
  });

  function answer(choice: string): AnswerFeedback | null {
    const q = current.value;
    if (!q) return null;

    const correct = choice.trim() === q.answer.trim();
    const timeTaken = Math.round((Date.now() - questionStartedAt) / 1000);
    let gained = 0;

    if (correct) {
      const base = settings.base_points?.[q.difficulty] ?? BASE_FALLBACK[q.difficulty] ?? 10;
      gained = base * comboMultiplier.value;
      score.value += gained;
      streak.value += 1;
      if (streak.value > longestStreak.value) longestStreak.value = streak.value;
    } else {
      // Non-punitive: reset streak, no score loss.
      streak.value = 0;
    }

    answers.value.push({ questionId: q.id, isCorrect: correct, timeTaken });
    questionStartedAt = Date.now();

    return {
      correct,
      gained,
      correctAnswer: q.answer,
      explanation: q.explanation,
    };
  }

  function next(): boolean {
    if (isLast.value) return false;
    index.value += 1;
    return true;
  }

  function finish() {
    // Completion bonus — always granted, regardless of accuracy.
    const bonus = settings.completion_bonus ?? 0;
    score.value += bonus;
    return {
      score: score.value,
      accuracy: total.value === 0 ? 0 : (answers.value.filter((a) => a.isCorrect).length / total.value) * 100,
      longestStreak: longestStreak.value,
      durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      answers: answers.value.slice(),
      completionBonus: bonus,
    };
  }

  return {
    current,
    total,
    index,
    isLast,
    progress,
    score,
    streak,
    longestStreak,
    comboMultiplier,
    answer,
    next,
    finish,
    answers,
  };
}