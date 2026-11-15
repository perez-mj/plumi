<!-- src/views/student/ai/AiGenerationViewerPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <template v-else-if="generation">
          <h1 class="gv__title">{{ generation.title }}</h1>
          <p class="gv__meta">{{ typeLabel(generation.type) }} · {{ generation.detail_level }}</p>

          <!-- SUMMARY -->
          <template v-if="generation.type === 'SUMMARY' && summaryContent">
            <article class="gv__summary">
              <p>{{ summaryContent.summary }}</p>
            </article>
            <h2 v-if="summaryContent.key_points?.length">Key points</h2>
            <ul v-if="summaryContent.key_points?.length">
              <li v-for="(kp, i) in summaryContent.key_points" :key="i">{{ kp }}</li>
            </ul>
          </template>

          <!-- REVIEWER -->
          <template v-else-if="generation.type === 'REVIEWER' && reviewerContent">
            <section v-for="(s, i) in reviewerContent.sections" :key="i" class="gv__section">
              <h2>{{ s.heading }}</h2>
              <ul>
                <li v-for="(b, j) in s.bullets" :key="j">{{ b }}</li>
              </ul>
            </section>
          </template>

          <!-- STUDY_GUIDE -->
          <template v-else-if="generation.type === 'STUDY_GUIDE' && guideContent">
            <h2 v-if="guideContent.objectives?.length">Learning objectives</h2>
            <ul v-if="guideContent.objectives?.length">
              <li v-for="(o, i) in guideContent.objectives" :key="i">{{ o }}</li>
            </ul>
            <section v-for="(s, i) in guideContent.sections" :key="i" class="gv__section">
              <h2>{{ s.heading }}</h2>
              <p>{{ s.body }}</p>
            </section>
          </template>

          <!-- Fallback -->
          <EmptyState v-else title="Nothing to display" message="This generation has no renderable content."
            :icon="documentTextOutline" />
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { arrowBackOutline, documentTextOutline } from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { getGeneration } from '@/services/ai';
import type { MaterialGeneration } from '@/types/app';

const route = useRoute();
const generationId = route.params.generationId as string;

const loading = ref(true);
const error = ref<string | null>(null);
const generation = ref<MaterialGeneration | null>(null);

/*
 * Mirror only the metadata fields the template needs into a flat ref. Reading
 * `generation.value.content` inside a `computed` forces vue-tsc to instantiate
 * `MaterialGeneration` deeply (its `content: Json` field is recursive), which
 * triggers TS2589 regardless of how the cast is written. Keeping `content` in a
 * separately-typed `unknown` ref moves the recursive type out of every
 * `computed` callback signature.
 */

interface GenerationMeta {
  title: string;
  type: string;
  detailLevel: string;
}

const meta = ref<GenerationMeta | null>(null);
const rawContent = ref<unknown>(null);

interface SummaryContent {
  summary: string;
  key_points?: string[];
}

interface ReviewerSection {
  heading: string;
  bullets: string[];
}

interface ReviewerContent {
  title?: string;
  sections: ReviewerSection[];
}

interface GuideSection {
  heading: string;
  body: string;
}

interface GuideContent {
  title?: string;
  objectives?: string[];
  sections: GuideSection[];
}

const summaryContent = computed<SummaryContent | null>(() =>
  meta.value?.type === 'SUMMARY' ? (rawContent.value as SummaryContent) : null,
);

const reviewerContent = computed<ReviewerContent | null>(() =>
  meta.value?.type === 'REVIEWER' ? (rawContent.value as ReviewerContent) : null,
);

const guideContent = computed<GuideContent | null>(() =>
  meta.value?.type === 'STUDY_GUIDE' ? (rawContent.value as GuideContent) : null,
);

function typeLabel(t: string): string {
  return t.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const g = await getGeneration(generationId);
    // Extract fields here so the recursive `content: Json` type never enters
    // any computed/template-typed expression.
    generation.value = g;
    meta.value = {
      title: g.title,
      type: g.type as string,
      detailLevel: g.detail_level as string,
    };
    rawContent.value = g.content as unknown;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.page-shell--narrow {
  max-width: 820px;
}

.gv__title {
  margin: 0;
}

.gv__meta {
  color: var(--plumi-text-muted);
  margin-top: 4px;
}

.gv__summary {
  padding: var(--size-4, 1rem);
  background: var(--plumi-primary-subtle);
  border-radius: 14px;
}

.gv__section {
  margin-top: var(--size-5, 1.25rem);
}

.gv__section h2 {
  margin: 0 0 var(--size-2, 0.5rem);
}
</style>