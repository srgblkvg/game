import nodemailer from 'nodemailer';
import logger from './logger';

const transporter = nodemailer.createTransport({
  sendmail: true,
  newline: 'unix',
  path: '/usr/sbin/sendmail',
});

const FROM = 'noreply@mmoarena.ru';

export async function sendVerificationCode(email: string, code: string): Promise<boolean> {
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
    logger.info({ email }, 'Verification code sent');
    return true;
  } catch (err) {
    logger.error({ err, email }, 'Failed to send verification code');
    return false;
  }
}
