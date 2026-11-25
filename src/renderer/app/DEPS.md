# Зависимости частей окна

Создаётся командой `node tools/build-app.js --deps` — не правьте вручную. Для каждой части: какие части она использует
(по именам верхнего уровня, приблизительно: одноимённая локальная переменная тоже засчитывается; в скобках — сколько разных имён). Части делят одну область видимости, порядок важен только
для кода, который выполняется при загрузке.

| Часть | Использует |
|---|---|
| 01-core | 02-render (1), 04-server (1), 10-tabs (3), 12-messages (2), 22-card (2), 27-users-team (1), 33-project-forms (1), 34-file-menu (1) |
| 02-render | 01-core (20), 05-card-widgets (1), 06-settings (1), 07-my-day (3), 08-overview (2), 10-tabs (3), 12-messages (4), 14-projects (1), 15-counterparties (1), 15-people (2), 17-gantt (2), 18-kanban (2), 19-task-list (2), 21-bulk (2), 22-card (1), 23-card-who (1), 25-card-talk (1), 26-card-panels (2), 27-users-team (2), 29-focus-tour-notify (5), 30-project-customer (1), 37-phone (2) |
| 03-dialogs | 01-core (16), 12-messages (1), 22-card (1), 27-users-team (1), 29-focus-tour-notify (1), 30-project-customer (3), 32-cabinet (1) |
| 04-server | 01-core (13), 03-dialogs (3), 05-card-widgets (1), 15-counterparties (1), 22-card (1), 29-focus-tour-notify (1), 37-phone (1), 38-events (1) |
| 05-card-widgets | 01-core (33), 02-render (1), 03-dialogs (2), 06-settings (1), 10-tabs (2), 12-messages (3), 15-people (2), 18-kanban (1), 20-filters-usage-help (1), 22-card (4), 23-card-who (1), 25-card-talk (2), 29-focus-tour-notify (2), 38-events (1) |
| 06-settings | 01-core (29), 02-render (1), 05-card-widgets (4), 08-overview (1), 10-tabs (2), 22-card (1), 29-focus-tour-notify (1), 32-cabinet (2), 34-file-menu (3), 38-events (1) |
| 07-my-day | 01-core (21), 02-render (1), 05-card-widgets (1), 06-settings (1), 08-overview (3), 12-messages (3), 13-assignments (1), 13-expertise (2), 13-project-data (1), 18-kanban (1), 22-card (1), 23-card-who (1), 25-card-talk (1), 27-users-team (1), 29-focus-tour-notify (1), 30-project-customer (2) |
| 08-overview | 01-core (27), 02-render (2), 06-settings (12), 09-project-page (1), 12-messages (6), 14-projects (3), 20-filters-usage-help (2), 22-card (2), 27-users-team (1), 29-focus-tour-notify (1), 32-cabinet (1) |
| 09-project-page | 01-core (20), 02-render (1), 05-card-widgets (2), 08-overview (4), 10-tabs (3), 12-messages (8), 13-assignments (1), 13-expertise (1), 13-project-data (5), 14-projects (3), 19-task-list (1), 27-users-team (1), 33-project-forms (1), 36-search (1), 37-phone (1) |
| 10-tabs | 01-core (21), 02-render (2), 05-card-widgets (1), 06-settings (1), 09-project-page (1), 12-messages (8), 20-filters-usage-help (1), 22-card (1), 29-focus-tour-notify (1) |
| 11-assign | 01-core (12), 05-card-widgets (1), 09-project-page (1), 12-messages (1), 13-project-data (1), 22-card (1), 24-card-marks (1), 27-users-team (1) |
| 12-messages | 01-core (28), 03-dialogs (2), 05-card-widgets (1), 08-overview (1), 09-project-page (1), 10-tabs (5), 13-project-data (1), 22-card (2), 25-card-talk (1), 27-users-team (1), 29-focus-tour-notify (2), 32-cabinet (3), 33-project-forms (1), 38-events (1) |
| 13-assignments | 01-core (20), 02-render (1), 03-dialogs (1), 05-card-widgets (3), 12-messages (2), 29-focus-tour-notify (1), 34-file-menu (1) |
| 13-expertise | 01-core (20), 02-render (1), 03-dialogs (1), 05-card-widgets (1), 12-messages (2), 13-project-data (1), 26-card-panels (1), 27-users-team (1), 29-focus-tour-notify (1) |
| 13-project-data | 01-core (21), 02-render (1), 03-dialogs (2), 05-card-widgets (2), 12-messages (1), 22-card (1), 26-card-panels (3), 29-focus-tour-notify (1), 38-events (1) |
| 14-projects | 01-core (17), 02-render (1), 08-overview (4), 09-project-page (1), 10-tabs (1), 19-task-list (1), 20-filters-usage-help (1), 22-card (1), 37-phone (1), 38-events (1) |
| 15-counterparties | 01-core (22), 02-render (3), 03-dialogs (1), 04-server (1), 08-overview (1), 12-messages (1), 22-card (7), 29-focus-tour-notify (1), 30-project-customer (1), 32-cabinet (8), 36-search (1), 38-events (1) |
| 15-people | 01-core (30), 02-render (1), 03-dialogs (2), 05-card-widgets (3), 08-overview (5), 14-projects (5), 16-org (1), 16-profile (5), 22-card (1), 23-card-who (1), 27-users-team (2), 28-weekly-absences (1), 29-focus-tour-notify (1), 30-project-customer (1) |
| 16-org | 01-core (12), 02-render (1), 03-dialogs (2), 08-overview (1), 13-project-data (1), 22-card (1), 27-users-team (1), 29-focus-tour-notify (1) |
| 16-profile | 01-core (18), 02-render (1), 03-dialogs (3), 05-card-widgets (2), 12-messages (1), 13-assignments (2), 13-project-data (1), 15-people (1), 20-filters-usage-help (1), 22-card (1), 27-users-team (3), 28-weekly-absences (1), 29-focus-tour-notify (1), 37-phone (1) |
| 17-gantt | 01-core (29), 02-render (1), 05-card-widgets (4), 08-overview (3), 14-projects (3), 15-people (1), 20-filters-usage-help (1), 22-card (1), 23-card-who (2), 27-users-team (1), 30-project-customer (1), 37-phone (1) |
| 18-kanban | 01-core (26), 02-render (1), 05-card-widgets (4), 08-overview (4), 14-projects (3), 17-gantt (1), 20-filters-usage-help (1), 22-card (3), 23-card-who (4), 25-card-talk (3), 27-users-team (1), 30-project-customer (1) |
| 19-task-list | 01-core (30), 05-card-widgets (11), 06-settings (2), 08-overview (7), 20-filters-usage-help (1), 21-bulk (1), 22-card (1), 23-card-who (4), 27-users-team (1), 30-project-customer (1) |
| 20-filters-usage-help | 01-core (11), 02-render (1), 03-dialogs (1), 12-messages (1), 29-focus-tour-notify (1), 34-file-menu (1), 38-events (1) |
| 21-bulk | 01-core (14), 02-render (1), 03-dialogs (2), 05-card-widgets (2), 12-messages (1), 20-filters-usage-help (1), 22-card (1), 27-users-team (1) |
| 22-card | 01-core (42), 02-render (2), 05-card-widgets (5), 08-overview (2), 12-messages (1), 13-expertise (1), 23-card-who (9), 24-card-marks (4), 25-card-talk (5), 26-card-panels (9), 29-focus-tour-notify (3), 30-project-customer (1), 34-file-menu (1), 36-search (1), 37-demo-window (1), 37-phone (1), 38-events (1) |
| 23-card-who | 01-core (15), 22-card (4), 24-card-marks (1), 27-users-team (1), 29-focus-tour-notify (1) |
| 24-card-marks | 01-core (8), 05-card-widgets (3), 09-project-page (1), 22-card (4), 23-card-who (2) |
| 25-card-talk | 01-core (18), 05-card-widgets (1), 12-messages (1), 22-card (3), 23-card-who (4), 24-card-marks (1), 26-card-panels (1), 29-focus-tour-notify (1), 38-events (1) |
| 26-card-panels | 01-core (30), 05-card-widgets (2), 22-card (2), 23-card-who (1), 24-card-marks (1), 29-focus-tour-notify (1), 30-project-customer (1), 33-project-forms (1), 38-events (2) |
| 27-users-team | 01-core (29), 02-render (3), 04-server (1), 08-overview (2), 12-messages (1), 14-projects (1), 15-people (1), 20-filters-usage-help (1), 22-card (6), 29-focus-tour-notify (1), 33-project-forms (1), 34-file-menu (1), 37-phone (2) |
| 28-weekly-absences | 01-core (23), 03-dialogs (2), 05-card-widgets (1), 25-card-talk (1), 29-focus-tour-notify (1), 34-file-menu (1), 38-events (1) |
| 29-focus-tour-notify | 01-core (15), 02-render (1), 05-card-widgets (2), 08-overview (1), 10-tabs (1), 12-messages (1), 34-file-menu (1) |
| 30-project-customer | 01-core (24), 03-dialogs (1), 07-my-day (1), 08-overview (1), 13-project-data (3), 22-card (1), 27-users-team (1), 32-cabinet (1), 33-project-forms (2), 34-file-menu (1), 37-phone (1) |
| 31-project-composition | 01-core (17), 03-dialogs (3), 05-card-widgets (1), 22-card (2), 27-users-team (1), 29-focus-tour-notify (1), 30-project-customer (3), 32-cabinet (4), 33-project-forms (1), 34-file-menu (1), 37-phone (1) |
| 32-cabinet | 01-core (12), 02-render (1), 03-dialogs (2), 06-settings (1), 08-overview (1), 12-messages (1), 15-counterparties (1), 25-card-talk (1), 29-focus-tour-notify (1), 30-project-customer (2), 33-project-forms (2), 38-events (1) |
| 33-project-forms | 01-core (22), 02-render (2), 03-dialogs (1), 05-card-widgets (1), 08-overview (1), 09-project-page (1), 12-messages (4), 13-assignments (1), 15-counterparties (7), 22-card (6), 27-users-team (2), 29-focus-tour-notify (1), 30-project-customer (3), 31-project-composition (2), 32-cabinet (4), 34-file-menu (1), 36-search (1) |
| 34-file-menu | 01-core (26), 02-render (2), 03-dialogs (1), 06-settings (1), 15-people (1), 20-filters-usage-help (3), 22-card (3), 28-weekly-absences (1), 29-focus-tour-notify (1), 30-project-customer (1), 33-project-forms (1) |
| 35-journal | 01-core (9), 22-card (1), 34-file-menu (4) |
| 36-search | 01-core (20), 02-render (1), 05-card-widgets (1), 09-project-page (1), 12-messages (3), 15-counterparties (1), 22-card (1), 23-card-who (1), 27-users-team (1), 29-focus-tour-notify (1), 33-project-forms (1), 34-file-menu (1) |
| 37-demo-window | 01-core (12), 02-render (1), 22-card (1), 27-users-team (2), 34-file-menu (1) |
| 37-phone | 01-core (26), 02-render (2), 03-dialogs (2), 05-card-widgets (3), 06-settings (1), 07-my-day (5), 09-project-page (1), 10-tabs (1), 12-messages (4), 13-assignments (5), 13-expertise (4), 13-project-data (3), 15-people (1), 16-profile (4), 17-gantt (2), 18-kanban (1), 22-card (1), 23-card-who (1), 25-card-talk (1), 27-users-team (2), 29-focus-tour-notify (1), 30-project-customer (1), 32-cabinet (1) |
| 38-events | 01-core (23), 02-render (5), 05-card-widgets (4), 06-settings (1), 08-overview (3), 10-tabs (5), 12-messages (7), 13-expertise (1), 13-project-data (3), 15-counterparties (10), 15-people (1), 17-gantt (1), 18-kanban (1), 20-filters-usage-help (4), 21-bulk (1), 22-card (8), 23-card-who (4), 24-card-marks (3), 25-card-talk (4), 26-card-panels (4), 27-users-team (4), 29-focus-tour-notify (1), 30-project-customer (2), 31-project-composition (2), 32-cabinet (1), 33-project-forms (2), 34-file-menu (6), 35-journal (2), 36-search (1) |
| 39-boot | 01-core (13), 02-render (1), 04-server (2), 09-project-page (1), 10-tabs (1), 12-messages (2), 22-card (1), 32-cabinet (1), 34-file-menu (1), 36-search (2), 37-demo-window (1) |
