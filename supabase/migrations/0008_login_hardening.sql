-- KatoVape: закрываем утечку почты через вход.
-- resolve_login был доступен анониму и по логину возвращал auth_email, а у тех, кто
-- регистрировался с реальной почтой, это и есть их настоящий адрес. Подобрал логин —
-- узнал почту клиента. Теперь связку «логин -> адрес» делает edge-функция login
-- под service_role, а наружу функция больше не выставляется.
-- ВАЖНО: в PostgreSQL новая функция автоматически получает execute у роли PUBLIC,
-- поэтому отзыва только у anon и authenticated недостаточно, вызов всё равно проходит.
revoke execute on function public.resolve_login(text) from public;
revoke execute on function public.resolve_login(text) from anon, authenticated;

-- login_availability оставляем: она отдаёт только да/нет по занятости и нужна форме
-- регистрации, чтобы подсказать до отправки. Чужих данных она не раскрывает.
