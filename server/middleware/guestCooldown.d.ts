import { Response, NextFunction } from 'express';
/**
 * Замедляет гостевые запросы — не чаще 1 действия в 5 секунд.
 */
export declare function guestCooldown(req: any, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=guestCooldown.d.ts.map