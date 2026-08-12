export declare function isGuestRestrictionsDisabled(): Promise<boolean>;
export declare function setGuestRestrictionsDisabled(v: boolean): Promise<void>;
export declare function toggleGuestRestrictions(): Promise<boolean>;
export declare function authMiddleware(req: any, res: any, next: any): Promise<any>;
export declare function requireAdmin(req: any, res: any, next: any): Promise<any>;
export declare function requirePlayer(req: any, res: any, next: any): Promise<any>;
export declare function requireFullAccess(req: any, res: any, next: any): Promise<any>;
//# sourceMappingURL=auth.d.ts.map