import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';

export default function PrivacyPage() {
    const navigate = useNavigate();
    const isVK = localStorage.getItem('isVK') === '1';

    return (
        <div className="max-w-2xl mx-auto px-4 py-6">
            <button onClick={() => navigate(-1)} className="text-sm text-[var(--color-accent-info)] hover:underline mb-4 inline-block">← Назад</button>

            <h1 className="text-xl font-bold text-center mb-1">🔒 Обработка данных</h1>
            <p className="text-center text-[var(--color-text-muted)] text-sm mb-5">Согласие на обработку персональных данных</p>

            {isVK ? (
                <Card className="p-4 space-y-4 text-sm text-[var(--color-text-secondary)]">
                    <div>
                        <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">1. Какие данные мы собираем</h3>
                        <p>При входе через VK ID мы получаем ваш никнейм и аватар из профиля ВКонтакте. Никакие другие данные вашего профиля VK не запрашиваются и не сохраняются.</p>
                    </div>

                    <div>
                        <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">2. Как мы используем данные</h3>
                        <ul className="list-disc ml-4 space-y-1">
                            <li>Авторизация в игре — вход через VK ID</li>
                            <li>Отображение ника и аватара в игре, чате, рейтингах и турнирах</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">3. Что мы НЕ делаем</h3>
                        <ul className="list-disc ml-4 space-y-1 text-[var(--color-accent-success)]">
                            <li>Не передаём данные третьим лицам</li>
                            <li>Не используем данные для рекламных или спам-рассылок</li>
                            <li>Не продаём и не обмениваем данные</li>
                            <li>Не отслеживаем вашу активность за пределами игры</li>
                            <li>Не получаем доступ к вашему списку друзей, сообщениям или стене VK</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">4. Хранение и удаление</h3>
                        <p>Данные хранятся на сервере. Вы можете удалить аккаунт через настройки ВКонтакте: Мои приложения → MMO Arena → Удалить. После удаления все данные безвозвратно стираются.</p>
                    </div>

                    <div>
                        <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">5. Согласие</h3>
                        <p>Используя игру MMO Arena, вы даёте согласие на обработку данных в соответствии с этим документом. Согласие действует с момента входа и до удаления аккаунта.</p>
                    </div>

                    <div>
                        <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">6. Контакты</h3>
                        <p>По вопросам обработки данных пишите через форму «Обратная связь» в меню настроек.</p>
                    </div>

                    <div className="border-t border-[var(--color-border-light)] pt-3">
                        <p className="text-xs text-[var(--color-text-muted)]">Последнее обновление: июнь 2026</p>
                    </div>
                </Card>
            ) : (
                <Card className="p-4 space-y-4 text-sm text-[var(--color-text-secondary)]">
                <div>
                    <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">1. Какие данные мы собираем</h3>
                    <p>При регистрации или входе через OAuth мы получаем ваш никнейм и email (если указан). При создании аккаунта через email мы храним email для авторизации и восстановления пароля.</p>
                </div>

                <div>
                    <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">2. Как мы используем данные</h3>
                    <ul className="list-disc ml-4 space-y-1">
                        <li>Авторизация на сайте — вход в ваш аккаунт</li>
                        <li>Восстановление доступа — сброс пароля через email</li>
                        <li>Отображение ника в игре, чате, рейтингах и турнирах</li>
                    </ul>
                </div>

                <div>
                    <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">3. Что мы НЕ делаем</h3>
                    <ul className="list-disc ml-4 space-y-1 text-[var(--color-accent-success)]">
                        <li>Не передаём данные третьим лицам</li>
                        <li>Не используем данные для рекламных или спам-рассылок</li>
                        <li>Не продаём и не обмениваем данные</li>
                        <li>Не отслеживаем вашу активность за пределами сайта</li>
                    </ul>
                </div>

                <div>
                    <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">4. Хранение и удаление</h3>
                    <p>Данные хранятся на сервере. Вы можете удалить аккаунт в любое время через раздел «Аккаунт» → «Удалить аккаунт». После удаления все данные безвозвратно стираются.</p>
                </div>

                <div>
                    <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">5. Согласие</h3>
                    <p>Используя сайт MMO Arena, вы даёте согласие на обработку данных в соответствии с этим документом. Согласие действует с момента входа и до удаления аккаунта.</p>
                </div>

                <div>
                    <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">6. Контакты</h3>
                    <p>По вопросам обработки данных пишите через форму «Обратная связь» в меню настроек.</p>
                </div>

                <div className="border-t border-[var(--color-border-light)] pt-3">
                    <p className="text-xs text-[var(--color-text-muted)]">Последнее обновление: июнь 2026</p>
                </div>
            </Card>
            )}
        </div>
    );
}
