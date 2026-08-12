export declare function startBots(count: number, useExisting?: boolean): Promise<{
    started: number;
    bots: any[];
}>;
export declare function stopBots(): Promise<{
    stopped: number;
}>;
export declare function getBotsStatus(): {
    running: boolean;
    count: number;
    bots: any[];
};
//# sourceMappingURL=botManager.d.ts.map