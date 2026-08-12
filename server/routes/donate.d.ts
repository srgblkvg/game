declare const router: import("express-serve-static-core").Router;
export declare function deliverStarterPack(userId: number): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function deliverSilver(userId: number, amount: number): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function deliverCraftPack(userId: number, packType: 'rare' | 'epic'): Promise<{
    success: boolean;
    error?: string;
}>;
export default router;
export declare function deliverCursePack(userId: number, packType: 'small' | 'large' | 'x50' | 'x100'): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function deliverRubyRune(userId: number, count: number): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function deliverMegaCraftSet(userId: number): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function deliverLargeCraftSet(userId: number): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function deliverRuneStonePack(userId: number): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function deliverCraftRare200(userId: number): Promise<{
    success: boolean;
    error?: string;
}>;
//# sourceMappingURL=donate.d.ts.map