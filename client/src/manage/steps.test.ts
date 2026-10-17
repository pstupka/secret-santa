import { describe, expect, test } from 'vitest';

import { ania, babcia, jan, piotr } from '@/test/organizerParticipants';
import { currentStep, stepState } from './steps';

const invitedPiotr = { ...piotr, inviteSentAt: '2026-10-16T12:00:00.000Z' };

describe('currentStep', () => {
  test('gathering participants comes first', () => {
    expect(currentStep('open', [jan, ania])).toBe('participants');
  });

  test('then inviting everyone with an email address', () => {
    expect(currentStep('open', [jan, ania, piotr])).toBe('invitations');
  });

  test('then the draw', () => {
    expect(currentStep('open', [jan, ania, invitedPiotr])).toBe('draw');
    expect(currentStep('open', [jan, ania, babcia])).toBe('draw');
  });

  test('nothing is left once the draw has run', () => {
    expect(currentStep('drawn', [jan, ania, invitedPiotr])).toBeNull();
    expect(currentStep('finished', [jan, ania, invitedPiotr])).toBeNull();
  });
});

describe('stepState', () => {
  test('steps before the current one are done, later ones upcoming', () => {
    expect(stepState('participants', 'invitations')).toBe('done');
    expect(stepState('invitations', 'invitations')).toBe('current');
    expect(stepState('draw', 'invitations')).toBe('upcoming');
  });

  test('every step is done after the draw', () => {
    expect(stepState('draw', null)).toBe('done');
  });
});
