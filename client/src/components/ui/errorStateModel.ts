export type ErrorText = string | null;

export function selectErrorText(error: string | null | undefined): ErrorText {
  return error ? error : null;
}
