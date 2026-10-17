<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';

import { printLocation } from '@/assignment/myAssignment';
import { useMyAssignment } from '@/assignment/useMyAssignment';
import GiftIcon from '@/components/GiftIcon.vue';
import GiftTag from '@/components/GiftTag.vue';
import RecipientWishlist from '@/components/RecipientWishlist.vue';
import { formatBudget, formatExchangeDate } from '@/events/eventDetails';
import { useEventsStore } from '@/stores/events';

// `/events/:eventId/assignment`: whom the acting participant (oneself or a
// managed participant) gives a gift to, and the recipient's wishlist.
// Rendered inside `EventView`, which loads the event.
const events = useEventsStore();
const { state, error, reload } = useMyAssignment();

const event = computed(() => events.event);
const acting = computed(() => events.actingParticipant);
// The name stays sealed until the person chooses to look, every time the page
// opens: assignments often get opened at the family table.
const revealed = ref(false);
const recipientName = ref<HTMLElement | null>(null);
const revealButton = ref<HTMLButtonElement | null>(null);

const reveal = async () => {
  revealed.value = true;
  await nextTick();
  recipientName.value?.focus();
};

const hide = async () => {
  revealed.value = false;
  await nextTick();
  revealButton.value?.focus();
};

watch(
  () => events.actingAs,
  () => {
    revealed.value = false;
  },
);

const budget = computed(
  () =>
    event.value &&
    formatBudget(event.value.budgetAmount, event.value.budgetCurrency),
);
</script>

<template>
  <div v-if="event && acting">
    <div v-if="error" class="alert-error" role="alert">
      <p>{{ error }}</p>
      <button
        type="button"
        class="mt-2 font-semibold underline underline-offset-2"
        @click="reload"
      >
        {{ $t('common.tryAgain') }}
      </button>
    </div>

    <p v-else-if="!state" class="text-stone-600" role="status">
      {{ $t('assignment.loading') }}
    </p>

    <section
      v-else-if="state.kind === 'notDrawn'"
      class="card text-center"
      data-testid="assignment-not-drawn"
    >
      <GiftIcon class="mx-auto size-14" />
      <h2 class="mt-4 text-xl font-bold">
        {{ $t('assignment.notDrawn.title') }}
      </h2>
      <p class="mx-auto mt-2 max-w-md text-stone-600">
        {{
          acting.isSelf
            ? $t('assignment.notDrawn.lead')
            : $t('assignment.notDrawn.managedLead', {
                name: acting.displayName,
              })
        }}
      </p>
      <RouterLink
        :to="{ name: 'event-wishlists', params: { eventId: event.id } }"
        class="btn-secondary mt-5"
      >
        {{ $t('assignment.notDrawn.toWishlists') }}
      </RouterLink>
    </section>

    <section
      v-else-if="state.kind === 'none'"
      class="card text-center"
      data-testid="assignment-none"
    >
      <h2 class="text-xl font-bold">{{ $t('assignment.none.title') }}</h2>
      <p class="mx-auto mt-2 max-w-md text-stone-600">
        {{
          acting.isSelf
            ? $t('assignment.none.lead')
            : $t('assignment.none.managedLead', { name: acting.displayName })
        }}
      </p>
    </section>

    <div v-else class="space-y-8">
      <section aria-labelledby="recipient-intro" class="mx-auto max-w-xl">
        <GiftTag>
          <p id="recipient-intro" class="text-lg text-stone-700">
            {{
              acting.isSelf
                ? $t('assignment.youGiveTo')
                : $t('assignment.managedGivesTo', { name: acting.displayName })
            }}
          </p>

          <Transition name="unseal" mode="out-in">
            <div
              v-if="!revealed"
              key="sealed"
              class="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
            >
              <span
                class="flex size-16 shrink-0 items-center justify-center rounded-full bg-cranberry-600 shadow-sm ring-4 ring-cranberry-700/30"
                aria-hidden="true"
              >
                <span class="size-10 rounded-full ring-2 ring-gold-300/70" />
              </span>
              <div class="min-w-0">
                <p class="font-display text-2xl font-bold text-pine-900">
                  {{ $t('assignment.sealed.title') }}
                </p>
                <p class="mt-1 text-sm text-stone-600">
                  {{ $t('assignment.sealed.lead') }}
                </p>
                <button
                  ref="revealButton"
                  type="button"
                  class="btn-primary mt-4 w-full sm:w-auto"
                  data-testid="assignment-reveal"
                  @click="reveal"
                >
                  {{ $t('assignment.sealed.reveal') }}
                </button>
              </div>
            </div>

            <div v-else key="revealed" class="mt-3">
              <p
                ref="recipientName"
                tabindex="-1"
                class="font-display text-4xl leading-tight font-bold break-words text-cranberry-700 focus:outline-none sm:text-5xl"
                data-testid="assignment-recipient"
              >
                {{ state.assignment.recipient.displayName }}
              </p>
              <span
                class="mt-3 block h-1 w-20 rounded-full bg-gold-400"
                aria-hidden="true"
              />
              <p class="mt-3 text-sm text-stone-600">
                {{ $t('assignment.keepSecret') }}
              </p>
              <button
                type="button"
                class="btn-quiet mt-2 -ml-3"
                data-testid="assignment-hide"
                @click="hide"
              >
                {{ $t('assignment.sealed.hide') }}
              </button>
            </div>
          </Transition>
        </GiftTag>
      </section>

      <p v-if="event.status === 'finished'" class="alert-info" role="status">
        {{ $t('assignment.finished') }}
      </p>

      <article class="card">
        <section aria-labelledby="gift-details-title">
          <h2 id="gift-details-title" class="text-lg font-bold">
            {{ $t('assignment.details.title') }}
          </h2>
          <dl class="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt class="text-sm font-bold text-stone-600">
                {{ $t('assignment.details.exchangeOn') }}
              </dt>
              <dd class="mt-0.5 text-stone-800">
                {{ formatExchangeDate(event.exchangeOn) }}
              </dd>
            </div>
            <div>
              <dt class="text-sm font-bold text-stone-600">
                {{ $t('assignment.details.budget') }}
              </dt>
              <dd class="mt-0.5 text-stone-800">
                {{ budget ?? $t('assignment.details.noBudget') }}
              </dd>
            </div>
            <div v-if="event.rules" class="sm:col-span-2">
              <dt class="text-sm font-bold text-stone-600">
                {{ $t('assignment.details.rules') }}
              </dt>
              <dd class="mt-0.5 break-words whitespace-pre-line text-stone-800">
                {{ event.rules }}
              </dd>
            </div>
          </dl>
        </section>

        <template v-if="revealed">
          <section
            class="sheet-rule mt-8 pt-8"
            aria-labelledby="recipient-wishlist-title"
          >
            <h2 id="recipient-wishlist-title" class="text-lg font-bold">
              {{
                $t('assignment.wishlist.title', {
                  name: state.assignment.recipient.displayName,
                })
              }}
            </h2>
            <RecipientWishlist
              class="mt-3"
              :wishlist="state.assignment.wishlist"
              :recipient-name="state.assignment.recipient.displayName"
            />
          </section>

          <section
            class="sheet-rule mt-8 flex flex-col gap-4 pt-8 sm:flex-row sm:items-center sm:justify-between"
            aria-labelledby="print-title"
          >
            <div>
              <h2 id="print-title" class="text-lg font-bold">
                {{ $t('assignment.print.title') }}
              </h2>
              <p class="mt-1 text-stone-600">
                {{
                  acting.isSelf
                    ? $t('assignment.print.lead')
                    : $t('assignment.print.managedLead', {
                        name: acting.displayName,
                      })
                }}
              </p>
            </div>
            <RouterLink
              :to="printLocation(event.id, events.actingAs)"
              class="btn-secondary w-full shrink-0 sm:w-auto"
              data-testid="assignment-print-link"
            >
              {{ $t('assignment.print.open') }}
            </RouterLink>
          </section>
        </template>
        <p v-else class="sheet-rule mt-8 pt-6 text-sm text-stone-600">
          {{ $t('assignment.sealed.wishlistHidden') }}
        </p>
      </article>
    </div>
  </div>
</template>

<style scoped>
/* Unsealing: the name slides out from under the seal, left to right. */
.unseal-enter-active {
  transition: clip-path 600ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 300ms ease-out;
}

.unseal-leave-active {
  transition: opacity 150ms ease-in;
}

.unseal-enter-from {
  clip-path: inset(0 100% 0 0);
  opacity: 0;
}

.unseal-enter-to {
  clip-path: inset(0 0 0 0);
}

.unseal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .unseal-enter-active,
  .unseal-leave-active {
    transition: none;
  }
}
</style>
