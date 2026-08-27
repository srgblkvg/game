import assert from 'node:assert/strict';
import test from 'node:test';
import { getAdHealPresentation } from './adHealPresentation.ts';

test('shows cooldown before loading and formats remaining time', () => {
    assert.deepEqual(getAdHealPresentation({ missingHp: 10, loading: true, cooldown: 65 }), {
        disabled: true,
        onCooldown: true,
        buttonText: '⏳ 1:05',
        hintText: 'Подождите до следующего бесплатного лечения',
    });
});

test('shows loading when cooldown is over', () => {
    assert.deepEqual(getAdHealPresentation({ missingHp: 10, loading: true, cooldown: 0 }), {
        disabled: true,
        onCooldown: false,
        buttonText: '⏳ Загрузка...',
        hintText: 'Полное восстановление HP за просмотр рекламы. Доступно раз в 5 минут.',
    });
});

test('disables ready action when no health is missing', () => {
    assert.deepEqual(getAdHealPresentation({ missingHp: 0, loading: false, cooldown: 0 }), {
        disabled: true,
        onCooldown: false,
        buttonText: '▶️ За рекламу — бесплатно',
        hintText: 'Полное восстановление HP за просмотр рекламы. Доступно раз в 5 минут.',
    });
});

 test('enables ready action when healing is available', () => {
    assert.deepEqual(getAdHealPresentation({ missingHp: 1, loading: false, cooldown: 0 }), {
        disabled: false,
        onCooldown: false,
        buttonText: '▶️ За рекламу — бесплатно',
        hintText: 'Полное восстановление HP за просмотр рекламы. Доступно раз в 5 минут.',
    });
});
