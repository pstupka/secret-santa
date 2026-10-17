<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { OrganizerParticipant } from '@/api';
import AddParticipantForm from '@/components/manage/AddParticipantForm.vue';
import ConfirmPanel from '@/components/manage/ConfirmPanel.vue';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import {
  invitationAction,
  inviteState,
  removalBlock,
  type InviteState,
} from '@/manage/participants';
import { useManageStore } from '@/stores/manage';

// The organizer's participant list: email, invitation state, wishlist
// filled ✓/✗ and caretaker, with per-participant "send / resend invitation"
// and remove while the event is open.
const props = defineProps<{
  participants: OrganizerParticipant[];
  membershipOpen: boolean;
  myParticipantId: string;
}>();

const manage = useManageStore();
const errorMessage = useApiErrorMessage();
const { t } = useI18n();

const names = computed(
  () =>
    new Map(props.participants.map(({ id, displayName }) => [id, displayName])),
);

const rows = computed(() =>
  props.participants.map((participant) => ({
    participant,
    state: inviteState(participant),
    caretakerName: participant.managedByParticipantId
      ? names.value.get(participant.managedByParticipantId) ?? '?'
      : null,
    invitation: props.membershipOpen ? invitationAction(participant) : null,
    removal: removalBlock(participant, props.participants),
  })),
);

const stateStyles: Record<InviteState, string> = {
  managed: 'border-kraft-600/50 text-kraft-600',
  notInvited: 'border-dashed border-stone-500 text-stone-700',
  invited: 'border-pine-600/40 text-pine-700',
  opened: 'border-pine-700 bg-pine-50 text-pine-900',
  declined: 'border-cranberry-600/40 text-cranberry-700',
};

// One participant action at a time.
const busyId = ref<string | null>(null);
const confirmingRemoveId = ref<string | null>(null);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);

const run = async (
  participant: OrganizerParticipant,
  action: () => Promise<unknown>,
  done: string,
) => {
  busyId.value = participant.id;
  error.value = null;
  notice.value = null;
  try {
    await action();
    notice.value = done;
    confirmingRemoveId.value = null;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busyId.value = null;
  }
};

// Once the draw locks the membership, earlier results no longer apply.
watch(
  () => props.membershipOpen,
  () => {
    error.value = null;
    notice.value = null;
    confirmingRemoveId.value = null;
  },
);

const sendInvitation = (participant: OrganizerParticipant) =>
  run(
    participant,
    () => manage.sendInvitation(participant.id),
    t('manage.participants.sentOne', { name: participant.displayName }),
  );

const remove = (participant: OrganizerParticipant) =>
  run(
    participant,
    () => manage.removeParticipant(participant.id),
    t('manage.participants.removed', { name: participant.displayName }),
  );
</script>

<template>
  <section class="card" aria-labelledby="manage-participants-title">
    <h2 id="manage-participants-title" class="text-lg font-bold">
      {{ $t('manage.participants.title', { count: participants.length }) }}
    </h2>

    <p v-if="participants.length <= 1" class="mt-2 text-sm text-stone-600">
      {{ $t('manage.participants.empty') }}
    </p>

    <ul
      class="mt-3 divide-y divide-dashed divide-kraft-400"
      data-testid="participant-list"
    >
      <li
        v-for="row in rows"
        :key="row.participant.id"
        class="py-4"
        data-testid="participant-row"
        :data-participant-name="row.participant.displayName"
      >
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            class="font-bold break-all"
            :class="
              row.state === 'declined'
                ? 'text-stone-600 line-through decoration-stone-400'
                : 'text-stone-800'
            "
          >
            {{ row.participant.displayName }}
          </span>
          <span
            v-if="row.participant.id === myParticipantId"
            class="stamp border-pine-600/40 text-pine-700"
          >
            {{ $t('manage.participants.you') }}
          </span>
          <span
            v-if="row.participant.role === 'organizer'"
            class="stamp border-cranberry-600/40 text-cranberry-700"
          >
            {{ $t('event.role.organizer') }}
          </span>
        </div>

        <p class="mt-0.5 text-sm break-all text-stone-600">
          <template v-if="row.participant.email">
            {{ row.participant.email }}
          </template>
          <template v-else>
            {{ $t('manage.participants.noEmail') }} ·
            {{
              $t('manage.participants.caretaker', { name: row.caretakerName })
            }}
          </template>
        </p>

        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span
            class="stamp"
            :class="stateStyles[row.state]"
            data-testid="invite-state"
          >
            {{ $t(`manage.participants.inviteState.${row.state}`) }}
          </span>
          <span
            class="text-sm"
            :class="
              row.participant.wishlistFilled
                ? 'font-bold text-pine-700'
                : 'text-stone-600'
            "
            data-testid="wishlist-filled"
            :data-filled="row.participant.wishlistFilled"
          >
            {{
              row.participant.wishlistFilled
                ? $t('manage.participants.wishlistFilled')
                : $t('manage.participants.wishlistEmpty')
            }}
          </span>
        </div>

        <div
          v-if="membershipOpen && (row.invitation || !row.removal)"
          class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          <button
            v-if="row.invitation"
            type="button"
            class="btn-secondary min-h-9 px-3.5 py-1.5 text-sm"
            :disabled="busyId !== null"
            data-testid="send-invitation"
            @click="sendInvitation(row.participant)"
          >
            {{
              busyId === row.participant.id &&
              confirmingRemoveId !== row.participant.id
                ? $t('manage.participants.sendingOne')
                : $t(`manage.participants.${row.invitation}`)
            }}
          </button>
          <button
            v-if="!row.removal && confirmingRemoveId !== row.participant.id"
            type="button"
            class="btn-quiet -my-1 min-h-9 px-0 py-1 text-sm"
            :disabled="busyId !== null"
            data-testid="remove-participant"
            @click="confirmingRemoveId = row.participant.id"
          >
            {{ $t('manage.participants.remove') }}
          </button>
        </div>
        <p
          v-if="membershipOpen && row.removal === 'caretaker'"
          class="field-hint"
        >
          {{ $t('manage.participants.removeBlocked.caretaker') }}
        </p>

        <ConfirmPanel
          v-if="confirmingRemoveId === row.participant.id"
          class="mt-3"
          :message="
            $t('manage.participants.confirmRemove', {
              name: row.participant.displayName,
            })
          "
          :confirm-label="$t('manage.participants.confirmRemoveYes')"
          :busy-label="$t('manage.participants.removing')"
          :busy="busyId === row.participant.id"
          confirm-testid="confirm-remove-participant"
          @confirm="remove(row.participant)"
          @cancel="confirmingRemoveId = null"
        />
      </li>
    </ul>

    <p v-if="error" class="alert-error mt-3" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="status-ok mt-3" role="status">{{ notice }}</p>

    <AddParticipantForm
      v-if="membershipOpen"
      class="mt-6"
      :participants="participants"
    />
    <p v-else class="field-hint mt-4">{{ $t('manage.add.locked') }}</p>
  </section>
</template>
