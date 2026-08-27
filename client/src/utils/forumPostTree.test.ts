import assert from 'node:assert/strict';
import test from 'node:test';
import { buildForumPostTree, type ForumPostNode } from './forumPostTree.ts';

test('builds forum post tree with roots, children, and input order', () => {
    const posts: ForumPostNode[] = [
        { id: 1, parent_id: null, text: 'root' },
        { id: 3, parent_id: 1, text: 'child' },
        { id: 2, parent_id: 999, text: 'orphan' },
        { id: 4, parent_id: 1, text: 'second child' },
    ];

    const roots = buildForumPostTree(posts);

    assert.deepEqual(roots.map(post => post.id), [1, 2]);
    assert.deepEqual(roots[0]!.children!.map((post: ForumPostNode) => post.id), [3, 4]);
    assert.deepEqual(roots[1].children, []);
    assert.strictEqual(posts[0].children, roots[0].children);
});

test('returns empty tree for empty posts', () => {
    assert.deepEqual(buildForumPostTree([]), []);
});
