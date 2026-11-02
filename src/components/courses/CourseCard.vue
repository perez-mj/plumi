<!-- src/components/courses/CourseCard.vue -->
<template>
  <article class="course-card" @click="$emit('open', course.id)">
    <div class="course-card__cover">
      <img v-if="course.cover_image_url" :src="course.cover_image_url" :alt="course.title" />
      <div v-else class="course-card__cover-fallback">
        {{ initials }}
      </div>
      <span class="course-card__status" :class="`status--${course.status.toLowerCase()}`">
        {{ statusLabel }}
      </span>
    </div>
    <div class="course-card__body">
      <p v-if="course.code" class="course-card__code">{{ course.code }}</p>
      <h3 class="course-card__title">{{ course.title }}</h3>
      <p v-if="course.category" class="course-card__category">{{ course.category.name }}</p>
      <p v-if="course.description" class="course-card__desc">{{ course.description }}</p>
    </div>
    <div v-if="course.instructor" class="course-card__footer">
      <span class="course-card__instructor">
        {{ course.instructor.first_name }} {{ course.instructor.last_name }}
      </span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CourseWithMeta } from '@/types/app';

const props = defineProps<{ course: CourseWithMeta }>();
defineEmits<{ (e: 'open', id: string): void }>();

const initials = computed(() =>
  props.course.title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase(),
);

const statusLabel = computed(() => {
  const s = props.course.status;
  return s.charAt(0) + s.slice(1).toLowerCase();
});
</script>

<style scoped>
.course-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--plumi-border);
  border-radius: var(--plumi-radius-lg);
  background: var(--plumi-surface);
  cursor: pointer;
  transition: transform var(--plumi-duration-fast) var(--plumi-easing),
    box-shadow var(--plumi-duration-fast) var(--plumi-easing);
}
.course-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--plumi-shadow-raised);
}
.course-card__cover {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--plumi-primary-soft);
  overflow: hidden;
}
.course-card__cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.course-card__cover-fallback {
  display: grid; place-items: center; height: 100%;
  font-size: 40px; font-weight: var(--plumi-weight-bold); color: var(--plumi-primary);
}
.course-card__status {
  position: absolute; top: var(--size-2); right: var(--size-2);
  padding: 2px 10px; border-radius: var(--radius-round);
  font-size: 11px; font-weight: var(--plumi-weight-semibold); letter-spacing: 0.03em;
  background: var(--plumi-surface); color: var(--plumi-text-muted);
  text-transform: uppercase;
}
.status--published { background: var(--plumi-success-soft); color: var(--plumi-success); }
.status--draft { background: var(--plumi-warning-soft); color: var(--plumi-warning); }
.status--archived { background: var(--plumi-surface-muted); color: var(--plumi-text-muted); }
.course-card__body { flex: 1; padding: var(--size-3) var(--size-4); }
.course-card__code {
  margin: 0 0 4px; font-family: var(--plumi-font-mono);
  font-size: var(--plumi-text-xs); color: var(--plumi-text-subtle);
}
.course-card__title { margin: 0 0 6px; font-size: var(--plumi-text-md); color: var(--plumi-ink); line-height: 1.3; }
.course-card__category {
  margin: 0 0 6px; font-size: var(--plumi-text-xs);
  color: var(--plumi-primary); font-weight: var(--plumi-weight-semibold);
}
.course-card__desc {
  margin: 0; font-size: var(--plumi-text-sm); color: var(--plumi-text-muted);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.course-card__footer {
  padding: var(--size-2) var(--size-4);
  border-top: 1px solid var(--plumi-border);
  font-size: var(--plumi-text-xs); color: var(--plumi-text-muted);
}
</style>