# Сайт Артёма Уварова — электромонтаж

Статический сайт для GitHub Pages с собственной админкой. Без сборки и зависимостей.

```
index.html          — сайт
assets/             — стили, скрипт, иконка
data/content.json   — ВЕСЬ текст, цены, контакты, фото (редактируется из админки)
images/             — фотографии (новые из админки попадают в images/uploads/)
admin/              — админка: https://<логин>.github.io/<репозиторий>/admin/
```

## Публикация на GitHub Pages

1. Создайте репозиторий на github.com (например, `uvarov-electric`, публичный).
2. Загрузите в него все файлы этой папки (кнопка **Add file → Upload files**, перетащить содержимое папки).
3. **Settings → Pages → Build and deployment**: Source — *Deploy from a branch*, Branch — `main`, папка `/ (root)` → Save.
4. Через 1–2 минуты сайт будет на `https://<логин>.github.io/<репозиторий>/`.

Свой домен (например, `uvarov-electric.ru`): **Settings → Pages → Custom domain**, затем у регистратора домена добавьте CNAME-запись на `<логин>.github.io`.

## Админка

1. Создайте токен: <https://github.com/settings/personal-access-tokens/new>
   - Repository access → **Only select repositories** → репозиторий сайта
   - Permissions → Repository permissions → **Contents: Read and write**
2. Откройте `/admin/`, введите логин, репозиторий, ветку `main` и токен.
3. Правьте тексты, цены, фото → **Опубликовать** (или Ctrl+S). Сайт обновится за 1–2 минуты.

«Предпросмотр» показывает несохранённые изменения только вам (`/?preview=1`).

Подсказки:
- В заголовке первого экрана слова между `*звёздочками*` выделяются оранжевым.
- Telegram — только username без `@`; WhatsApp — только цифры, начиная с 7.
- Форма не отправляет данные на сервер: она собирает заявку и открывает чат в Telegram/WhatsApp с готовым текстом (и копирует его в буфер обмена).

## Локальный просмотр

```
node tools/serve.mjs
```
→ http://localhost:5173

Фото-заглушки — с Unsplash (бесплатная лицензия). Замените на фото реальных работ через админку.
