import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    username: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const verifyEmailSchema: z.ZodObject<{
    email: z.ZodString;
    code: z.ZodString;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const battleSchema: z.ZodObject<{
    opponentId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strip>;
export declare const arenaEnterSchema: z.ZodObject<{}, z.core.$strip>;
export declare const buyItemSchema: z.ZodObject<{
    itemId: z.ZodNumber;
}, z.core.$strip>;
export declare const startJobSchema: z.ZodObject<{
    jobId: z.ZodNumber;
}, z.core.$strip>;
export declare const createItemSchema: z.ZodObject<{
    name: z.ZodString;
    slot: z.ZodEnum<{
        helmet: "helmet";
        chest: "chest";
        gloves: "gloves";
        boots: "boots";
        amulet: "amulet";
        ring: "ring";
        belt: "belt";
        weapon1: "weapon1";
        shield: "shield";
    }>;
    rarity_id: z.ZodNumber;
    bonuses: z.ZodOptional<z.ZodObject<{
        s: z.ZodOptional<z.ZodNumber>;
        a: z.ZodOptional<z.ZodNumber>;
        d: z.ZodOptional<z.ZodNumber>;
        m: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    extra: z.ZodOptional<z.ZodObject<{
        crit: z.ZodOptional<z.ZodNumber>;
        dodge: z.ZodOptional<z.ZodNumber>;
        counter: z.ZodOptional<z.ZodNumber>;
        fullBlock: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    cost: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    image: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const createJobSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    duration: z.ZodNumber;
    rewardMin: z.ZodNumber;
    rewardMax: z.ZodNumber;
}, z.core.$strip>;
export declare const addMoneySchema: z.ZodObject<{
    userId: z.ZodNumber;
    amount: z.ZodNumber;
}, z.core.$strip>;
export declare const resetTimersSchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodNumber>;
    all: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const changeUsernameSchema: z.ZodObject<{
    newUsername: z.ZodString;
}, z.core.$strip>;
export declare const changePasswordSchema: z.ZodObject<{
    oldPassword: z.ZodString;
    newPassword: z.ZodString;
}, z.core.$strip>;
export declare const wsPublicMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"public">;
    content: z.ZodString;
}, z.core.$strip>;
export declare const wsPrivateMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"private">;
    targetUserId: z.ZodNumber;
    content: z.ZodString;
}, z.core.$strip>;
export declare const wsItemLinkSchema: z.ZodObject<{
    type: z.ZodLiteral<"itemLink">;
    itemId: z.ZodOptional<z.ZodNumber>;
    itemData: z.ZodOptional<z.ZodAny>;
}, z.core.$strip>;
export declare const registerGuestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    code: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=validation.d.ts.map