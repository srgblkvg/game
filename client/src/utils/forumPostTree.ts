export type ForumPostNode = {
    id: number;
    parent_id?: number | null;
    children?: ForumPostNode[];
    [key: string]: unknown;
};

export function buildForumPostTree(flatPosts: ForumPostNode[]): ForumPostNode[] {
    const map = new Map<number, ForumPostNode>();
    const roots: ForumPostNode[] = [];

    for (const post of flatPosts) {
        post.children = [];
        map.set(post.id, post);
    }
    for (const post of flatPosts) {
        if (post.parent_id && map.has(post.parent_id)) {
            map.get(post.parent_id)!.children!.push(post);
        } else {
            roots.push(post);
        }
    }
    return roots;
}
