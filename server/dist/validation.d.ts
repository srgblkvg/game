import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
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
        weapon1: "weapon1";
        ring1: "ring1";
        amulet: "amulet";
        gloves: "gloves";
        belt: "belt";
        boots: "boots";
        chest: "chest";
        ring2: "ring2";
        weapon2: "weapon2";
    }>;
    rarity: z.ZodNumber;
    bonuses: z.ZodOptional<z.ZodObject<{
        s: z.ZodOptional<z.ZodNumber>;
        a: z.ZodOptional<z.ZodNumber>;
        d: z.ZodOptional<z.ZodNumber>;
        m: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    extra: z.ZodOptional<z.ZodObject<{
        stamReg: z.ZodOptional<z.ZodNumber>;
        crit: z.ZodOptional<z.ZodNumber>;
        dodge: z.ZodOptional<z.ZodNumber>;
        counter: z.ZodOptional<z.ZodNumber>;
        fullBlock: z.ZodOptional<z.ZodNumber>;
        hpRegen: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
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
//# sourceMappingURL=validation.d.ts.map