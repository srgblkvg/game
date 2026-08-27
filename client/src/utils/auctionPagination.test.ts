import assert from 'node:assert/strict';
import test from 'node:test';
import { getAuctionPagination } from './auctionPagination.ts';

test('builds a centered pagination window with first-page ellipsis flags', () => {
    assert.deepEqual(getAuctionPagination(5, 10), {
        start: 3,
        end: 7,
        pages: [3, 4, 5, 6, 7],
        showFirstPage: true,
        showLeadingEllipsis: true,
        showTrailingEllipsis: true,
        showLastPage: true,
    });
});

test('keeps the first page in the window near the beginning', () => {
    assert.deepEqual(getAuctionPagination(3, 10), {
        start: 1,
        end: 5,
        pages: [1, 2, 3, 4, 5],
        showFirstPage: false,
        showLeadingEllipsis: false,
        showTrailingEllipsis: true,
        showLastPage: true,
    });
});

test('returns no pagination for a single page', () => {
    assert.deepEqual(getAuctionPagination(1, 1), {
        start: 1,
        end: 1,
        pages: [],
        showFirstPage: false,
        showLeadingEllipsis: false,
        showTrailingEllipsis: false,
        showLastPage: false,
    });
});
