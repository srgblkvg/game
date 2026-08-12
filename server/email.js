"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPaymentReceipt = sendPaymentReceipt;
exports.sendVerificationCode = sendVerificationCode;
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = __importDefault(require("./logger"));
const transporter = nodemailer_1.default.createTransport({
    sendmail: true,
    newline: 'unix',
    path: '/usr/sbin/sendmail',
});
const FROM = 'noreply@mmoarena.ru';
async function sendPaymentReceipt(email, itemName, amount) {
    try {
        await transporter.sendMail({
            from: FROM,
            to: email,
            subject: `MMO Arena — чек об оплате: ${itemName}`,
            text: `Спасибо за покупку!\\n\\nТовар: ${itemName}\\nСумма: ${amount} ₽\\n\\nСредства зачислены в игру.\\n\\nmmoarena.ru`,
            html: `<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        <h2 style="color: #c084fc;">MMO Arena</h2>
        <p>Спасибо за покупку!</p>
        <div style="padding: 16px; background: #1e1e2e; border-radius: 8px; margin: 16px 0;">
          <p style="color: #cdd6f4; margin: 4px 0;"><strong>Товар:</strong> ${itemName}</p>
          <p style="color: #cdd6f4; margin: 4px 0;"><strong>Сумма:</strong> ${amount} ₽</p>
        </div>
        <p style="color: #6c7086; font-size: 14px;">Средства зачислены в игру.</p>
        <p style="color: #6c7086; font-size: 12px;">mmoarena.ru</p>
      </div>`,
        });
        logger_1.default.info({ email, itemName }, 'Payment receipt sent');
        return true;
    }
    catch (err) {
        logger_1.default.error({ err, email }, 'Failed to send payment receipt');
        return false;
    }
}
async function sendVerificationCode(email, code) {
    try {
        await transporter.sendMail({
            from: FROM,
            to: email,
            subject: 'MMO Arena — код подтверждения',
            text: `Ваш код подтверждения: ${code}\n\nКод действителен 10 минут.\n\nЕсли вы не регистрировались на mmoarena.ru, просто проигнорируйте это письмо.`,
            html: `<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        <h2 style="color: #c084fc;">MMO Arena</h2>
        <p>Ваш код подтверждения:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #1e1e2e; color: #cdd6f4; border-radius: 8px; margin: 16px 0;">${code}</div>
        <p style="color: #6c7086; font-size: 14px;">Код действителен 10 минут.</p>
        <p style="color: #6c7086; font-size: 12px;">Если вы не регистрировались на mmoarena.ru, просто проигнорируйте это письмо.</p>
      </div>`,
        });
        logger_1.default.info({ email }, 'Verification code sent');
        return true;
    }
    catch (err) {
        logger_1.default.error({ err, email }, 'Failed to send verification code');
        return false;
    }
}
//# sourceMappingURL=email.js.map