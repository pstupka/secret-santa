<script setup lang="ts">
// A paper gift tag with a punched hole and cranberry twine tied through it:
// the product's object for a secret name. `ground` is the colour behind the
// tag, shown through the hole.
withDefaults(
  defineProps<{
    twine?: boolean;
    ground?: 'page' | 'paper' | 'white';
  }>(),
  { twine: true, ground: 'page' },
);
</script>

<template>
  <div class="gift-tag relative" :class="twine ? 'pl-12' : ''">
    <svg
      v-if="twine"
      class="pointer-events-none absolute top-1/2 left-0 z-10 h-20 w-19 -translate-y-1/2 overflow-visible print:hidden"
      viewBox="0 0 76 80"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M76 40C54 38 36 18 2 22"
        class="stroke-cranberry-600"
        stroke-width="2.5"
        stroke-linecap="round"
      />
      <path
        d="M76 40C56 44 30 68 4 60"
        class="stroke-cranberry-700"
        stroke-width="2.5"
        stroke-linecap="round"
      />
    </svg>
    <div class="tag-shadow">
      <div class="tag-body relative bg-paper py-6 pr-6 pl-14 sm:py-8 sm:pr-8">
        <span
          class="absolute top-1/2 left-5.5 size-3.5 -translate-y-1/2 rounded-full ring-[3px] ring-kraft-400"
          :class="{
            'bg-ground': ground === 'page',
            'bg-paper': ground === 'paper',
            'bg-white': ground === 'white',
          }"
          aria-hidden="true"
        />
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The tag's cut corners clip any box-shadow, so the shadow is a filter on a
   wrapper instead. Its own compositing layer: a filtered element inside a
   rotated one otherwise leaves stale paint behind when its content moves
   (e.g. when the web fonts swap in). */
.tag-shadow {
  filter: drop-shadow(0 1px 1px rgb(74 52 28 / 0.12))
    drop-shadow(0 10px 14px rgb(74 52 28 / 0.22));
  transform: translateZ(0);
  isolation: isolate;
}

.tag-body {
  clip-path: polygon(
    1.5rem 0,
    100% 0,
    100% 100%,
    1.5rem 100%,
    0 calc(100% - 1.5rem),
    0 1.5rem
  );
}

@media print {
  .tag-shadow {
    filter: none;
  }

  .tag-body {
    outline: 1px solid var(--color-stone-400);
    outline-offset: -1px;
  }
}
</style>
