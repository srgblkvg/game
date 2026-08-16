/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteAtSelection, insertAtSelection } from './vkTextEditing';

test('символ вставляется в текущую позицию, а не в конец сообщения', () => {
    assert.deepEqual(insertAtSelection('Привет мир', 7, 7, 'X'), {
        value: 'Привет Xмир',
        start: 8,
        end: 8,
    });
});

test('ввод заменяет выделенный фрагмент', () => {
    assert.deepEqual(insertAtSelection('Привет мир', 7, 10, 'друг'), {
        value: 'Привет друг',
        start: 11,
        end: 11,
    });
});

test('backspace удаляет символ перед кареткой в середине текста', () => {
    assert.deepEqual(deleteAtSelection('Привет мир', 7, 7), {
        value: 'Приветмир',
        start: 6,
        end: 6,
    });
});

test('backspace удаляет выделенный фрагмент целиком', () => {
    assert.deepEqual(deleteAtSelection('Привет мир', 7, 10), {
        value: 'Привет ',
        start: 7,
        end: 7,
    });
});
