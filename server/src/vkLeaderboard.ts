// VK Leaderboard — отключено (приложение не верифицировано)
// https://dev.vk.com/ru/games/promotion/game-mechanics/leaderboards

export async function sendLeaderboardLevel(_userId: number, _level: number, _oauthId: string): Promise<void> {
  // Приложение VK не верифицировано — secure.addAppEvent не работает
  // Вернуть, когда появится verified app
}