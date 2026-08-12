export declare function auditLoginSuccess(username: string, userId: number, ip?: string): void;
export declare function auditLoginFailure(username: string, ip?: string, reason?: string): void;
export declare function auditRegister(username: string, userId: number, ip?: string): void;
export declare function auditPasswordChange(userId: number, username: string, ip?: string): void;
export declare function auditUsernameChange(userId: number, oldName: string, newName: string, ip?: string): void;
export declare function auditWsConnect(username: string, userId: number, ip?: string): void;
export declare function auditWsDisconnect(username: string, userId: number): void;
export declare function auditAccountLocked(username: string, ip?: string): void;
//# sourceMappingURL=audit.d.ts.map