const TEMPORARY_SERVER_MESSAGE = 'Сервер временно перезапускается. Повторите попытку через несколько секунд.';

export async function readJsonResponse<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(TEMPORARY_SERVER_MESSAGE);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error(TEMPORARY_SERVER_MESSAGE);
  }

  if (!response.ok) {
    throw new Error(data?.error || TEMPORARY_SERVER_MESSAGE);
  }
  return data as T;
}
