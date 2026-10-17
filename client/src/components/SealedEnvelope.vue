<script setup lang="ts">
// One sealed envelope with a participant's name under it: what the draw
// produced for them, without showing what is inside. `order` staggers the
// seal being pressed on when a row of them appears.
const props = withDefaults(defineProps<{ name: string; order?: number }>(), {
  order: 0,
});

const initial = props.name.trim().charAt(0).toLocaleUpperCase('pl');
</script>

<template>
  <figure class="flex flex-col items-center gap-2.5">
    <div
      class="relative aspect-[3/2] w-full max-w-40 rounded-sm bg-paper shadow-paper ring-1 ring-kraft-300"
    >
      <svg
        class="absolute inset-0 size-full"
        viewBox="0 0 120 80"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M1 1 60 47 119 1Z" class="fill-stone-100" />
        <path
          d="M1 1 60 47 119 1"
          fill="none"
          class="stroke-kraft-400"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <span
        class="seal absolute top-[59%] left-1/2 flex size-10 items-center justify-center rounded-full bg-cranberry-600 font-display font-bold text-gold-300 shadow-sm ring-4 ring-cranberry-700/30"
        :style="{ animationDelay: `${order * 90}ms` }"
        aria-hidden="true"
      >
        {{ initial }}
      </span>
    </div>
    <figcaption class="max-w-40 truncate text-center font-bold text-stone-800">
      {{ name }}
    </figcaption>
  </figure>
</template>

<style scoped>
.seal {
  transform: translate(-50%, -50%);
  animation: press-seal 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* The wax seal is pressed on: it lands from slightly larger, already
   visible, so nothing waits on the animation. */
@keyframes press-seal {
  from {
    transform: translate(-50%, -50%) scale(1.35);
    opacity: 0.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .seal {
    animation: none;
  }
}
</style>
