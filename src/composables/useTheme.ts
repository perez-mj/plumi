import { ref, watch } from 'vue';

const isDark = ref<boolean>(false);

// Initialize from localStorage / system preference
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('plumi_theme');
  if (stored) {
    isDark.value = stored === 'dark';
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  document.documentElement.classList.toggle('dark', isDark.value);
}

watch(isDark, (val) => {
  document.documentElement.classList.toggle('dark', val);
  localStorage.setItem('plumi_theme', val ? 'dark' : 'light');
});

export function useTheme() {
  function toggle() {
    isDark.value = !isDark.value;
  }
  return { isDark, toggle };
}