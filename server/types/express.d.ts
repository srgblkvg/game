// Расширяем Express Request для наших middleware
declare namespace Express {
  interface Request {
    userId: number;
    isGuest?: boolean;
    adminId?: number;
  }
}
