export interface TextSelectionResult {
    value: string;
    start: number;
    end: number;
}

export function insertAtSelection(value: string, start: number, end: number, text: string): TextSelectionResult {
    const safeStart = Math.max(0, Math.min(start, value.length));
    const safeEnd = Math.max(safeStart, Math.min(end, value.length));
    const nextValue = value.slice(0, safeStart) + text + value.slice(safeEnd);
    const cursor = safeStart + text.length;
    return { value: nextValue, start: cursor, end: cursor };
}

export function deleteAtSelection(value: string, start: number, end: number): TextSelectionResult {
    const safeStart = Math.max(0, Math.min(start, value.length));
    const safeEnd = Math.max(safeStart, Math.min(end, value.length));
    if (safeStart !== safeEnd) {
        return { value: value.slice(0, safeStart) + value.slice(safeEnd), start: safeStart, end: safeStart };
    }
    if (safeStart === 0) return { value, start: 0, end: 0 };
    return { value: value.slice(0, safeStart - 1) + value.slice(safeStart), start: safeStart - 1, end: safeStart - 1 };
}
