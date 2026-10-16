import { useI18n } from 'vue-i18n';

import type { Event } from '@/api';
import { exchangeCountdown } from '@/events/eventDetails';

// Short countdown to an event's exchange date: "za 12 dni", "jutro", "dziś",
// "zakończone".
export const useExchangeCountdown = () => {
  const { t } = useI18n();

  return ({ exchangeOn, timezone }: Pick<Event, 'exchangeOn' | 'timezone'>) => {
    const countdown = exchangeCountdown(exchangeOn, timezone);
    return countdown.kind === 'days'
      ? t('event.countdown.days', { days: countdown.days })
      : t(`event.countdown.${countdown.kind}`);
  };
};
