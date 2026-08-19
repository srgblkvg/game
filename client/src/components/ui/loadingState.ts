export type LoadingText = string | null;

export function selectLoadingText(isLoading: boolean, text = 'Загрузка...'): LoadingText {
  return isLoading ? text : null;
}
