declare const router: import("express-serve-static-core").Router;
declare const FACTIONS: {
    readonly bandit: {
        readonly name: "Бандиты";
        readonly desc: "+10% к основным характеристикам против Ремесленников. Атаки ±4 уровня. +1% дополнительного награбленного серебра за каждые 100 побед в PvP. Кулдаун между атаками в PvP уменьшен в два раза.";
    };
    readonly crafter: {
        readonly name: "Ремесленники";
        readonly desc: "+10% шанс создания/улучшения +1% за 100 успешных созданных и улучшенных предметов. +100% награда за работы.";
    };
    readonly guard: {
        readonly name: "Стражники";
        readonly desc: "+10% к основным характеристикам против Бандитов и в PvE. Карма: +1 за победу над бандитом или монстром, -1 за победу над мирным игроком. +1% к жалованию за очко кармы.";
    };
};
type Faction = keyof typeof FACTIONS;
export { FACTIONS };
export type { Faction };
export default router;
//# sourceMappingURL=faction.d.ts.map