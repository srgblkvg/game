const FOCUS_RELEASING_TAGS = new Set(['SELECT', 'BUTTON', 'A', 'SUMMARY']);

export function shouldReleaseVkKeyboardFocus(tagName: string, isTextInput: boolean): boolean {
  if (isTextInput) return false;
  return FOCUS_RELEASING_TAGS.has(tagName.toUpperCase());
}
