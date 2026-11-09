import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowLeft, ArrowUpRight, Check, ClipboardList, CreditCard, FileText, LockKeyhole, MessageCircle, Scale, ShieldCheck, UserRound, Users } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";

type LegalSection = readonly [string, string];
type LegalDocument = {
  id: string;
  title: string;
  description: string;
  sections: readonly LegalSection[];
};

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  {
    id: "terms",
    title: "Пользовательское соглашение",
    description: "Условия использования Cloudy English Academy",
    sections: [
      ["1. О сервисе", "Cloudy English Academy — цифровой сервис для самостоятельного изучения английского языка. В нём доступны учебные материалы, упражнения, проверка ответов, сохранение прогресса и помощник Cloudy AI. Cloudy AI — фирменный помощник сервиса, работающий с использованием моделей и технической инфраструктуры, которые могут предоставляться сторонними поставщиками. Он помогает изучать английский, объясняет ошибки и отвечает на вопросы о функциях приложения. Ответы формируются автоматически, могут быть неточными и не заменяют преподавателя, переводчика, юриста, врача или другого специалиста."],
      ["2. Возраст и регистрация", "Минимальный возраст регистрации — 13 лет. Указывайте возраст достоверно; для этого сервис запрашивает возраст в полных годах, а не полную дату рождения. Если законодательство страны пользователя требует согласия родителя или законного представителя либо иных дополнительных мер для пользователей младше 18 лет, такие требования должны быть соблюдены до использования соответствующих функций. В сервисе пока нет автоматизированной проверки полномочий родителя или представителя. По вопросам несовершеннолетних можно обратиться в поддержку."],
      ["3. Аккаунт и способы входа", "Для сохранения и синхронизации прогресса используйте личный аккаунт. Гостевой режим, если он доступен, может иметь ограничения и не гарантирует сохранение данных между устройствами. Доступные способы входа отображаются непосредственно в приложении и могут изменяться. Не передавайте другим людям пароль, одноразовые коды и ссылки для входа. Если вы подозреваете несанкционированный доступ, обратитесь в поддержку."],
      ["4. Профиль и изменения данных", "Имя и доступные настройки профиля можно менять средствами приложения. Если изменение возраста или адреса электронной почты недоступно в интерфейсе, направьте запрос в поддержку. Для предотвращения доступа посторонних к аккаунту поддержка может запросить разумное подтверждение личности или полномочий представителя. Никогда не отправляйте пароль, полный номер банковской карты или коды подтверждения."],
      ["5. Допустимое использование", "Используйте сервис законно и не мешайте другим пользователям. Запрещены попытки взлома, обхода технических ограничений, вмешательства в работу приложения или чужие аккаунты, распространение вредоносного кода, травля, угрозы и публикация чужих персональных данных. Не перепродавайте доступ и не представляйте сервис как собственный продукт без разрешения правообладателей. Эти правила не ограничивают права, которые предоставлены пользователю обязательными нормами закона."],
      ["6. Внешние учебные инструменты", "Вы можете пользоваться сторонними словарями, переводчиками и учебными инструментами по своему усмотрению. Их результаты могут отличаться от ответов Cloudy English. Не передавайте сторонним сервисам пароли, личные переписки и другие сведения, которые не нужны для выбранной функции."],
      ["7. Материалы и интеллектуальная собственность", "Права на материалы, которые пользователь самостоятельно создаёт и загружает, сохраняются за пользователем или соответствующими правообладателями. Пользователь разрешает сервису обрабатывать такие материалы только в объёме, необходимом для предоставления выбранных функций, обеспечения безопасности и исполнения обязательных требований закона. Название Cloudy English Academy, фирменный стиль, логотип, персонаж Cloudy, программный код и оригинальные учебные материалы охраняются применимым законодательством и принадлежат соответствующим правообладателям. Публикация личных материалов пользователя в рекламе или продвижении не предполагается без отдельного согласия."],
      ["8. Профиль и публичные материалы", "Настройки публичности могут быть доступны не для всех типов профиля и материалов. Перед публикацией проверьте, какие сведения будут видны другим пользователям. Не публикуйте контактные данные, документы, адрес проживания, сведения о школе или чужую личную информацию без законного основания. Личные сообщения и адрес электронной почты не предназначены для публичного отображения."],
      ["9. Модерация и обжалование", "При сообщении о нарушении администрация может проверить материал и принять соразмерные меры: запросить пояснения, скрыть или удалить материал, ограничить отдельную функцию либо временно ограничить доступ к аккаунту. При выборе меры учитываются обстоятельства, безопасность пользователей и применимое право. Пользователь может запросить объяснение и обжаловать решение через официальную поддержку. Обработка жалобы может потребовать времени; немедленное рассмотрение не гарантируется."],
      ["10. Доступность, прогресс и прекращение использования", "Сервис стремится обеспечивать доступность приложения и сохранность прогресса, но не гарантирует непрерывную работу, отсутствие ошибок или восстановление каждой записи после сбоя. Синхронизация может задерживаться; перед важными действиями убедитесь, что данные сохранены. Уведомления зависят от настроек приложения, устройства, браузера и выданных разрешений. Запрос на удаление аккаунта можно направить через центр конфиденциальности или поддержку. Отправка запроса сама по себе не означает, что аккаунт и все данные уже удалены: запрос регистрируется и требует дальнейшей обработки. Некоторые сведения могут временно сохраняться в резервных копиях либо дольше, если этого требует закон."],
      ["11. Изменения сервиса и документов", "Функции приложения и документы могут обновляться. При существенных изменениях администрация стремится сообщать об этом заранее, если это практически возможно и требуется применимым правом. Если изменение требует нового согласия, оно запрашивается отдельно. Продолжение использования сервиса не отменяет обязательные права пользователя."],
      ["12. Оператор, контакты и применимое право", "Сервис действует под наименованием Cloudy English Academy. На дату этой редакции оператор не оформлен как юридическое лицо или индивидуальный предприниматель; официальное юридическое наименование, регистрационный номер и почтовый адрес оператора не установлены и поэтому не приводятся в этом документе. Это не отменяет обязанностей по применимому законодательству. Документ не выбирает единственную юрисдикцию и не ограничивает обязательные права пользователя по законам, которые применяются к его ситуации. По вопросам сервиса и персональных данных обращайтесь в официальную поддержку: https://t.me/cloudysupportt_bot."],
      ["13. Доступность по странам", "Доступ к Cloudy English Academy может зависеть от страны и территории пользователя, доступности хостинга, авторизации, баз данных и ИИ-поставщиков, а также от применимых санкционных, экспортных и иных правовых ограничений. Отдельные страны, территории или категории пользователей могут быть недоступны. Географическое определение по IP является приблизительным и может ошибаться, например при использовании VPN или мобильной сети. Наличие доступа сегодня не гарантирует его постоянную доступность. Актуальное ограничение показывается при попытке открыть сервис; при ошибочной блокировке обратитесь в поддержку."]
    ]
  },
  {
    id: "privacy",
    title: "Политика конфиденциальности",
    description: "Какие данные обрабатываются, для чего и какие есть ограничения",
    sections: [
      ["1. Кто отвечает за обработку", "Сервис работает под наименованием Cloudy English Academy. На дату этой редакции оператор не оформлен как юридическое лицо или индивидуальный предприниматель; юридическое наименование, регистрационный номер и почтовый адрес оператора пока не установлены. В документе не указываются вымышленные реквизиты. По вопросам обработки данных доступна официальная поддержка: https://t.me/cloudysupportt_bot."],
      ["2. Какие данные обрабатываются", "В зависимости от используемых функций могут обрабатываться: адрес электронной почты и идентификатор аккаунта; имя и возраст в полных годах; уровень английского и настройки; ответы на задания, результаты тестов, ошибки, достижения, XP и учебный прогресс; сообщения и контекст диалогов с Cloudy AI; публикации, комментарии и реакции, если пользователь использует функции сообщества; технические сведения о браузере, устройстве, подключении и сбоях. Полная дата рождения для указания возраста не требуется. Не отправляйте в сервис пароли от других сайтов, платёжные реквизиты, документы и сведения, не нужные для обучения."],
      ["3. Для чего нужны данные", "Данные используются для создания и защиты аккаунта, входа, предоставления уроков и упражнений, проверки ответов, сохранения и синхронизации прогресса, адаптации учебных заданий, работы Cloudy AI, функций сообщества, ответа на обращения, диагностики ошибок, предотвращения злоупотреблений и исполнения обязательных требований закона. Объём данных должен соответствовать цели выбранной функции."],
      ["4. Cloudy AI и внешние поставщики", "Cloudy AI — фирменный помощник Cloudy English Academy, но вычисления и формирование ответов могут выполняться с помощью внешних моделей и технических поставщиков. Для ответа им может передаваться текст запроса и необходимый контекст, например фрагменты диалога, ответ на упражнение или сведения об учебном уровне. Поэтому не отправляйте в чат конфиденциальные сведения. Точный состав поставщиков и страны обработки могут зависеть от текущей конфигурации сервиса и на дату этой редакции не перечислены здесь исчерпывающим образом. Поставщики обрабатывают переданные им данные в рамках своих условий и применимых правил."],
      ["5. Использование диалогов для улучшения ИИ", "Сообщения и диалоги обрабатываются для формирования ответов Cloudy AI и работы выбранных пользователем функций. Дополнительное использование диалогов для обучения или улучшения моделей не является условием обычного обучения и должно быть отделено от основной обработки. В центре конфиденциальности доступно отдельное необязательное согласие на такую цель; оно по умолчанию выключено и может быть отозвано. Сохранение выбора в центре конфиденциальности фиксирует действие пользователя, но само по себе не подтверждает, что все внешние поставщики или модели используют данные для обучения. До отдельного документированного включения соответствующего процесса нельзя считать, что такой процесс действует."],
      ["6. Голосовые функции", "Распознавание и озвучивание речи могут выполняться средствами устройства, браузера или внешнего сервиса. Конкретный путь обработки зависит от устройства, браузера и выбранной функции. Перед использованием голосовой функции проверьте разрешения микрофона и настройки устройства. Эта политика не обещает, что все аудиоданные обрабатываются исключительно локально или что каждый поставщик использует одинаковые сроки хранения."],
      ["7. Хранение и безопасность", "Данные аккаунта хранятся, пока они нужны для предоставления сервиса, обработки запросов, обеспечения безопасности и исполнения обязательных требований. На дату этой редакции единый подробный график сроков хранения для каждой категории данных не опубликован. Доступ к данным ограничивается техническими и организационными мерами, однако ни один способ передачи или хранения не может гарантировать абсолютную безопасность. Резервные копии и технические журналы могут сохраняться отдельно от основного аккаунта в течение технически необходимого или обязательного срока."],
      ["8. Передача и международная обработка", "Для работы сервиса данные могут обрабатываться поставщиками хостинга, базы данных, авторизации, ИИ-инфраструктуры, уведомлений и диагностики. При использовании внешнего входа, например через Google, часть данных обрабатывается соответствующим провайдером по его правилам. Серверы и поставщики могут находиться в разных странах. Полный актуальный список поставщиков, стран обработки и применяемых механизмов международной передачи на дату редакции не опубликован; не следует считать, что все данные хранятся в одной стране."],
      ["9. Публичность", "Данные профиля и материалы сообщества могут отображаться другим пользователям в соответствии с настройками и правилами конкретной функции. Перед публикацией проверьте её видимость. Адрес электронной почты, пароль и личная переписка не должны включаться в публичный профиль. Не размещайте сведения о других людях без законного основания."],
      ["10. Права и запросы пользователя", "В зависимости от применимого законодательства пользователь может иметь право запросить сведения об обработке, доступ, копию, исправление, удаление или ограничение обработки, а также отозвать согласие. В центре конфиденциальности можно изменить необязательное согласие, отправить запрос и получить экспорт части данных основной базы. Экспорт включает перечисленные в интерфейсе категории основной базы и имеет технические ограничения по числу записей; он не включает данные внешних поставщиков и некоторые технические журналы. Запросы на исправление и удаление регистрируются в системе со статусом «получен» и не исполняются автоматически. Для рассмотрения запроса обратитесь в поддержку; может потребоваться подтверждение личности или полномочий представителя."],
      ["11. Данные несовершеннолетних", "Минимальный возраст регистрации — 13 лет. Для пользователей младше 18 лет могут действовать дополнительные требования применимого законодательства, включая согласие родителя или законного представителя. В сервисе пока нет автоматизированной проверки такого согласия или полномочий представителя. Родительские запросы рассматриваются через поддержку с проверкой полномочий в объёме, необходимом для защиты данных ребёнка."],
      ["12. Изменения и обращения", "При существенном изменении целей или способов обработки политика обновляется; если закон требует нового согласия, оно запрашивается отдельно. Дата редакции указана в интерфейсе документа. По вопросам конфиденциальности и реализации прав обращайтесь в официальную поддержку: https://t.me/cloudysupportt_bot."]
    ]
  },
  {
    id: "consent",
    title: "Согласие на дополнительное использование диалогов",
    description: "Отдельный выбор пользователя для необязательной цели улучшения ИИ",
    sections: [
      ["1. Основная работа сервиса", "Для входа, предоставления уроков, проверки заданий, сохранения прогресса, работы чата и защиты аккаунта обрабатываются данные, необходимые для соответствующих функций. Такая обработка описана в Политике конфиденциальности и не должна смешиваться с необязательным согласием на дополнительное использование диалогов."],
      ["2. Необязательное согласие", "В центре конфиденциальности можно отдельно разрешить дополнительное использование диалогов для улучшения ИИ. Выбор добровольный: он выключен по умолчанию, не является условием регистрации или обычного обучения и может быть изменён в настройках. Переключатель сохраняет событие согласия или отзыва и версию документа. Сам факт сохранения события не означает, что обучение моделей уже запущено или что данные были переданы конкретному поставщику для этой цели."],
      ["3. Отзыв согласия", "Отозвать согласие можно через центр конфиденциальности. После отзыва сервис фиксирует новое состояние и не должен использовать последующие диалоги для указанной дополнительной цели на основании прежнего согласия. Отзыв не отменяет обработку, которая необходима для обычной работы выбранных функций, и не может автоматически отменить уже выполненные операции. Если данные ранее были переданы поставщику, возможность их удаления у него зависит от технических возможностей, договора и применимого права."],
      ["4. Несовершеннолетние", "Если применимое законодательство требует согласия родителя или законного представителя, одного нажатия пользователем переключателя недостаточно. В Cloudy English пока нет автоматизированной проверки личности и полномочий родителя; до внедрения соответствующего механизма нельзя утверждать, что такая проверка выполняется внутри приложения. По вопросам согласия представителя обращайтесь в поддержку."]
    ]
  },
  {
    id: "community",
    title: "Правила сообщества",
    description: "Требования к безопасному и уважительному общению",
    sections: [
      ["1. Уважительное общение", "Не допускаются травля, угрозы, преследование, унижение, намеренное запугивание и публикация материалов, нарушающих закон или права других людей."],
      ["2. Защита личной информации", "Не публикуйте пароли, адрес проживания, номера документов, финансовые сведения, личные контакты и чужие персональные данные. Не просите других пользователей раскрывать такую информацию."],
      ["3. Публикации и профили", "Перед публикацией проверьте настройки видимости и содержание материала. Не публикуйте чужие фотографии, тексты или персональные данные без законного основания. Администрация может ограничить доступ к материалу, если он нарушает правила или создаёт угрозу безопасности."],
      ["4. Безопасность сервиса", "Запрещены взлом, обход ограничений, вмешательство в чужие аккаунты или прогресс, распространение вредоносного кода, автоматизированные действия, создающие чрезмерную нагрузку, и использование платформы для незаконных целей."],
      ["5. Использование Cloudy AI", "Не отправляйте Cloudy AI пароли, платёжные реквизиты, документы и другие конфиденциальные сведения. Ответы формируются автоматически, могут содержать ошибки и не являются профессиональной консультацией. Не используйте ответы ИИ как единственный источник для важных решений."],
      ["6. Жалобы и меры", "О нарушениях сообщайте через официальную поддержку Cloudy English: https://t.me/cloudysupportt_bot. По возможности укажите ссылку или описание материала и причину обращения, но не отправляйте лишние персональные данные. Администрация может запросить уточнения, ограничить видимость материала, вынести предупреждение или временно ограничить аккаунт. Решение можно обжаловать через поддержку."]
    ]
  },
  {
    id: "payments",
    title: "Оплата и возвраты",
    description: "Условия для платных функций, если они будут доступны в приложении",
    sections: [
      ["1. Когда применяются эти условия", "Этот раздел применяется только к платным функциям, для которых в приложении явно показаны цена и условия покупки. Само наличие этого документа не означает, что подписка, платёжный шлюз или автоматическое списание уже подключены."],
      ["2. Информация до оплаты", "До подтверждения покупки пользователю должны быть показаны цена, валюта, состав услуги, срок доступа, периодичность списаний и условия автоматического продления, если они применяются. Если эти сведения не показаны до подтверждения, не считайте покупку согласованной на неуказанных условиях."],
      ["3. Подтверждение и документы об оплате", "Платёж обрабатывается выбранным платёжным провайдером, если такая функция доступна. Условия провайдера могут применяться дополнительно. Сохраняйте подтверждение операции. Не отправляйте в поддержку полный номер карты, CVV/CVC, пароли или одноразовые коды."],
      ["4. Возвраты", "Запросы о возврате рассматриваются с учётом условий, показанных при покупке, правил платёжного провайдера и обязательных норм законодательства о защите потребителей. Этот документ не устанавливает фиксированный срок возврата и не отменяет обязательные права потребителя."],
      ["5. Поддержка по платежам", "По вопросам списаний, доступа к оплаченной функции или возврата обратитесь в официальную поддержку: https://t.me/cloudysupportt_bot. Укажите дату и сумму операции и идентификатор заказа, если он отображается; не передавайте полные платёжные реквизиты."]
    ]
  },
  {
    id: "parents",
    title: "Информация для родителей и представителей",
    description: "Возрастные ограничения, безопасность и обращения по данным несовершеннолетних",
    sections: [
      ["1. Возраст", "Минимальный возраст регистрации в Cloudy English Academy — 13 лет. Для пользователей 13–17 лет применимые требования к согласию родителя или представителя зависят от законодательства страны пользователя и характера обработки данных."],
      ["2. Проверка согласия", "В приложении пока нет автоматизированного механизма проверки личности родителя и его полномочий. Поэтому не следует считать, что одно лишь указание возраста или нажатие переключателя в приложении подтверждает родительское согласие там, где закон требует его проверять. Родителю следует обратиться в поддержку до использования функции, для которой такое согласие обязательно."],
      ["3. Безопасность обучения", "Обсудите с подростком безопасное использование цифровых сервисов. Не размещайте в профиле и чатах домашний адрес, телефон, документы, пароли, сведения о школе и другую информацию, не нужную для обучения. Не отправляйте в Cloudy AI конфиденциальные сведения."],
      ["4. Cloudy AI", "Cloudy AI — фирменный помощник Cloudy English Academy, который использует внешние модели и техническую инфраструктуру для формирования ответов. Он помогает с изучением английского и функциями приложения, но может ошибаться и не заменяет преподавателя или профильного специалиста."],
      ["5. Запросы родителя", "Родитель или законный представитель может обратиться с вопросом о данных несовершеннолетнего, запросом на доступ, исправление или удаление. Для защиты ребёнка поддержка может попросить подтвердить личность и полномочия заявителя. Не отправляйте пароль ребёнка или полные платёжные данные."],
      ["6. Контакты", "Официальная поддержка Cloudy English: https://t.me/cloudysupportt_bot."]
    ]
  },
  {
    id: "guide",
    title: "Краткая памятка пользователя",
    description: "Основные правила использования и защиты данных",
    sections: [
      ["Аккаунт", "Используйте личный аккаунт и не передавайте пароль или коды входа другим людям."],
      ["Профиль", "Проверяйте настройки видимости перед публикацией. Если изменение данных недоступно в профиле, обратитесь в поддержку."],
      ["Личные данные", "Не отправляйте в чаты пароли, документы, домашний адрес, финансовые сведения и другую конфиденциальную информацию."],
      ["Cloudy AI", "Cloudy AI помогает изучать английский и пользоваться приложением. Ответы могут быть неточными; важную информацию проверяйте."],
      ["Конфиденциальность", "Необязательное согласие на дополнительное использование диалогов выключено по умолчанию и может быть отозвано в центре конфиденциальности."],
      ["Экспорт и удаление", "Экспорт можно запросить в центре конфиденциальности; он охватывает данные основной базы в пределах, указанных в интерфейсе. Запрос на удаление регистрируется и требует обработки, а не удаляет всё мгновенно."],
      ["Помощь", "Официальная поддержка Cloudy English: https://t.me/cloudysupportt_bot."]
    ]
  }
] as const;

const LEGAL_PAGE_STYLES = "/* Cloudy Legal — документы простым языком */\n.lgl-root{position:fixed;inset:0;z-index:60;display:flex;justify-content:center;\n  background:linear-gradient(165deg,var(--bg0,#050d2b) 0%,var(--bg1,#0a2a73) 100%);\n  animation:lglIn .5s cubic-bezier(.2,.85,.25,1) both}\n.lgl-root.out{animation:lglOut .32s ease both}\n@keyframes lglIn{from{opacity:0;transform:translateY(48px)}}\n@keyframes lglOut{to{opacity:0;transform:translateY(40px)}}\n.lgl-in{position:relative;width:100%;max-width:560px;height:100%;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top,0px)}\n.lgl-top{display:flex;align-items:center;gap:12px;padding:12px 16px 10px}\n.lgl-top h3{margin:0;flex:1;font-size:19px;font-weight:900;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.lgl-back{width:42px;height:42px;flex:none;border:0;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;font-size:22px;line-height:1;display:grid;place-items:center;padding:0;transition:transform .25s cubic-bezier(.3,1.4,.5,1)}\n.lgl-back:active{transform:scale(.88)}\n.lgl-prog{height:3px;background:rgba(255,255,255,.1);margin:0 16px;border-radius:3px;overflow:hidden}\n.lgl-prog i{display:block;height:100%;width:var(--p,0%);background:linear-gradient(90deg,var(--a1,#4db3ff),#fff);border-radius:3px;transition:width .15s linear}\n.lgl-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;padding:14px 16px calc(34px + env(safe-area-inset-bottom,0px))}\n.lgl-scroll::-webkit-scrollbar{display:none}\n.lgl-pg.fwd{animation:lglFwd .42s cubic-bezier(.2,.85,.25,1) both}\n.lgl-pg.bck{animation:lglBck .42s cubic-bezier(.2,.85,.25,1) both}\n@keyframes lglFwd{from{opacity:0;transform:translateX(36px)}}\n@keyframes lglBck{from{opacity:0;transform:translateX(-36px)}}\n\n/* hero */\n.lgl-hero{text-align:center;padding:22px 18px 20px;margin-bottom:18px;border-radius:28px;background:linear-gradient(135deg,var(--a1,#4db3ff),var(--a2,#2d86f2));box-shadow:0 5px 0 var(--a3,#1a58b5),0 16px 30px rgba(0,0,0,.28)}\n.lgl-hero-ic{font-size:50px;line-height:1;margin-bottom:8px;display:inline-block;animation:float 3s ease-in-out infinite}\n.lgl-hero h2{margin:0 0 8px;font-size:24px;font-weight:900;line-height:1.15}\n.lgl-hero p{margin:0;font-size:14px;line-height:1.45;font-weight:600;opacity:.92}\n.lgl-h{margin:22px 4px 10px;font-size:13px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;opacity:.7}\n\n/* FAQ + expanders */\n.lgl-faq{display:grid;gap:8px}\n.lgl-q{border-radius:18px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.1);overflow:hidden;animation:rise2 .5s both;animation-delay:calc(var(--i)*55ms + 120ms)}\n.lgl-q>button{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:14px 16px;border:0;background:none;color:#fff;font-weight:800;font-size:15px;text-align:left;line-height:1.3}\n.lgl-q>button i{flex:none;width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.14);display:grid;place-items:center;font-style:normal;font-size:18px;transition:transform .4s cubic-bezier(.3,1.4,.5,1)}\n.lgl-q.open>button i{transform:rotate(135deg)}\n.lgl-x{display:grid;grid-template-rows:0fr;transition:grid-template-rows .4s cubic-bezier(.2,.85,.25,1)}\n.lgl-x>div{overflow:hidden;min-height:0}\n.open>.lgl-x,.open .lgl-x{grid-template-rows:1fr}\n.lgl-q .lgl-x p{margin:0;padding:0 16px 6px;font-size:14px;line-height:1.5;opacity:.92;font-weight:500}\n.lgl-more{border:0;background:none;color:#8fd3ff;font-weight:800;font-size:13px;padding:6px 16px 14px}\n\n/* document cards */\n.lgl-cards{display:grid;gap:10px}\n.lgl-card{display:flex;align-items:center;gap:14px;width:100%;padding:14px;border-radius:22px;text-align:left;color:#fff;\n  background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.1);animation:rise2 .5s both;animation-delay:calc(var(--i)*60ms + 250ms);\n  transition:transform .2s cubic-bezier(.3,1.4,.5,1),background .25s}\n.lgl-card:active{transform:scale(.97);background:rgba(255,255,255,.15)}\n.lgl-ic{flex:none;width:52px;height:52px;border-radius:17px;display:grid;place-items:center;font-size:27px;background:color-mix(in srgb,var(--h) 30%,transparent);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--h) 55%,transparent)}\n.lgl-ct{flex:1;min-width:0}.lgl-ct b{display:block;font-size:16px;line-height:1.2}\n.lgl-ct small{display:block;margin-top:3px;font-size:12px;line-height:1.35;opacity:.72;font-weight:600}\n.lgl-card em{flex:none;font-style:normal;font-size:11px;font-weight:900;padding:4px 9px;border-radius:99px;background:rgba(255,255,255,.12)}\n\n/* support */\n.lgl-support{display:flex;align-items:center;gap:14px;margin-top:22px;padding:14px 16px;border-radius:22px;text-decoration:none;color:#fff;\n  background:linear-gradient(135deg,rgba(255,255,255,.16),rgba(255,255,255,.07));border:1px solid rgba(255,255,255,.16);transition:transform .2s cubic-bezier(.3,1.4,.5,1)}\n.lgl-support:active{transform:scale(.97)}\n.lgl-sup-ic{font-size:30px}.lgl-support b{display:block;font-size:15px}.lgl-support small{display:block;opacity:.75;font-weight:600;font-size:12px;margin-top:2px}\n.lgl-support>span:nth-child(2){flex:1}.lgl-support i{font-style:normal;font-size:26px;opacity:.55}\n\n/* document view */\n.lgl-dh{display:flex;align-items:center;gap:14px;margin-bottom:14px}\n.lgl-dh-ic{flex:none;width:62px;height:62px;border-radius:20px;display:grid;place-items:center;font-size:32px;background:color-mix(in srgb,var(--h) 30%,transparent);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--h) 60%,transparent);animation:pop .5s both}\n.lgl-dh h2{margin:0;font-size:22px;line-height:1.15;font-weight:900}\n.lgl-dh p{margin:4px 0 0;font-size:13px;opacity:.75;font-weight:700;line-height:1.35}\n.lgl-short{padding:16px;border-radius:26px;margin-bottom:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--h) 26%,transparent),rgba(255,255,255,.06));border:1px solid color-mix(in srgb,var(--h) 45%,transparent)}\n.lgl-short-t{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:17px}.lgl-short-t span{font-size:22px}\n.lgl-short ul{list-style:none;margin:0;padding:0;display:grid;gap:9px}\n.lgl-short li{display:flex;gap:10px;align-items:flex-start;font-size:14.5px;line-height:1.4;font-weight:700;animation:rise2 .45s both;animation-delay:calc(var(--i)*70ms + 150ms)}\n.lgl-short li i{flex:none;width:22px;height:22px;border-radius:50%;margin-top:1px;display:grid;place-items:center;font-style:normal;font-size:13px;font-weight:900;background:var(--h);color:#06143a}\n.lgl-toc{display:flex;gap:8px;overflow-x:auto;padding:2px 0 14px;scrollbar-width:none;margin:0 -16px;padding-left:16px;padding-right:16px}\n.lgl-toc::-webkit-scrollbar{display:none}\n.lgl-toc button{flex:none;border:0;border-radius:99px;padding:8px 13px;background:rgba(255,255,255,.1);color:#fff;font-weight:800;font-size:12.5px;white-space:nowrap;transition:background .25s,transform .2s}\n.lgl-toc button:active{background:rgba(255,255,255,.22);transform:scale(.94)}\n.lgl-sec{padding:15px 16px 10px;margin-bottom:10px;border-radius:22px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);animation:rise2 .5s both;animation-delay:calc(var(--i)*50ms + 200ms)}\n.lgl-sec.flash{animation:lglFlash 1s ease both}\n@keyframes lglFlash{0%,100%{box-shadow:0 0 0 0 transparent}30%{box-shadow:0 0 0 3px var(--h)}}\n.lgl-sec-h{display:flex;align-items:center;gap:10px;margin-bottom:8px}\n.lgl-n{flex:none;min-width:28px;height:28px;padding:0 6px;border-radius:10px;display:grid;place-items:center;font-size:13px;font-weight:900;background:var(--h);color:#06143a}\n.lgl-sec h4{margin:0;font-size:16px;line-height:1.25;font-weight:900}\n.lgl-sec>p{margin:0;font-size:15px;line-height:1.55;font-weight:500;opacity:.95}\n.lgl-sec a,.lgl-x a{color:#8fd3ff;word-break:break-all}\n.lgl-ox{margin-top:8px}\n.lgl-orig{display:flex;align-items:center;gap:6px;border:0;background:none;color:rgba(255,255,255,.65);font-size:12.5px;font-weight:800;padding:8px 0;letter-spacing:.3px}\n.lgl-orig i{font-style:normal;font-size:16px;transition:transform .4s cubic-bezier(.3,1.4,.5,1)}\n.lgl-ox.open .lgl-orig i{transform:rotate(180deg)}\n.lgl-o{margin:0 0 10px;padding:12px 14px;border-radius:14px;background:rgba(0,0,0,.22);font-size:13px;line-height:1.55;opacity:.85;font-weight:500}\n\nhtml[data-motion=\"off\"] .lgl-root,html[data-motion=\"off\"] .lgl-root *{animation:none!important}\n\n@keyframes rise2{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes pop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
.lgl-root{--bg0:#050d2b;--bg1:#0a2a73;--a1:#4db3ff;--a2:#2d86f2;--a3:#1a58b5;color:#fff}\n.lgl-hero-ic{display:grid;place-items:center;width:62px;height:62px;margin:0 auto 12px;border-radius:20px;background:rgba(255,255,255,.16);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}\n.lgl-card{font:inherit;cursor:pointer}\n.lgl-card:focus-visible,.lgl-back:focus-visible,.lgl-q>button:focus-visible,.lgl-toc button:focus-visible,.lgl-orig:focus-visible,.lgl-more:focus-visible{outline:2px solid #8fd3ff;outline-offset:3px}\n.lgl-card .lgl-ic svg,.lgl-dh-ic svg,.lgl-hero-ic svg,.lgl-support svg{width:27px;height:27px}\n.lgl-card .lgl-ic{display:grid;place-items:center}\n.lgl-dh-ic{display:grid;place-items:center}\n.lgl-hero-ic svg{width:34px;height:34px}\n.lgl-support .lgl-sup-ic{display:grid;place-items:center;width:48px;height:48px;border-radius:16px;background:rgba(255,255,255,.14)}\n.lgl-sec:not(.expanded)>p{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}\n.lgl-sec.expanded>p{display:block}\n.lgl-empty{padding:16px;border-radius:18px;background:rgba(255,255,255,.08);font-size:14px;line-height:1.5}\n.lgl-root a{color:#8fd3ff}\n.lgl-support{color:#fff!important}\n.lgl-support .lgl-support-copy{flex:1;min-width:0}\n.lgl-scroll{scroll-behavior:smooth}\n@media(max-width:380px){.lgl-card{gap:10px;padding:12px}.lgl-ic{width:46px;height:46px}.lgl-card em{display:none}.lgl-hero{padding:19px 15px}.lgl-dh h2{font-size:19px}}\n@media(prefers-reduced-motion:reduce){.lgl-root,.lgl-root *{animation:none!important;scroll-behavior:auto!important;transition:none!important}}\n";

const LEGAL_META: Record<string, { color: string; label: string; icon: typeof FileText; highlights: string[] }> = {
  terms: { color: "#62c5ff", label: "Условия", icon: Scale, highlights: ["Как пользоваться Cloudy English", "Правила аккаунта, материалов и сообщества", "Доступность сервиса и обращения в поддержку"] },
  privacy: { color: "#58d6c0", label: "Данные", icon: ShieldCheck, highlights: ["Какие данные могут обрабатываться", "Как работают Cloudy AI и внешние поставщики", "Как запросить экспорт, исправление или удаление"] },
  consent: { color: "#a99aff", label: "Согласие", icon: LockKeyhole, highlights: ["Дополнительное использование диалогов необязательно", "Согласие выключено по умолчанию", "Согласие можно отозвать в центре конфиденциальности"] },
  community: { color: "#ff9eae", label: "Правила", icon: Users, highlights: ["Уважительное общение и защита приватности", "Запрет травли, угроз и вмешательства в аккаунты", "Жалобы рассматриваются через поддержку"] },
  payments: { color: "#ffd16b", label: "Платежи", icon: CreditCard, highlights: ["Условия действуют для платных функций, если они доступны", "Цена и периодичность должны быть показаны до покупки", "Возвраты учитывают обязательные права потребителей"] },
  parents: { color: "#7ed7e8", label: "Родителям", icon: UserRound, highlights: ["Минимальный возраст регистрации — 13 лет", "Требования к согласию зависят от страны", "В приложении пока нет автоматической проверки полномочий"] },
  guide: { color: "#b5c4ff", label: "Памятка", icon: ClipboardList, highlights: ["Коротко об аккаунте и профиле", "Как беречь личные данные", "Где управлять согласием и запросами"] },
};

const LEGAL_FAQ = [
  ["С чего начать?", "Откройте нужный документ в списке. Внутри есть краткое содержание, переходы к разделам и полный текст условий."],
  ["Как связаться с поддержкой?", "Используйте кнопку «Связаться» внизу юридического центра. Она открывает официальный Telegram поддержки Cloudy English."],
  ["Можно ли отозвать согласие на улучшение ИИ?", "Да. Необязательное согласие управляется отдельно в центре конфиденциальности профиля и по умолчанию выключено."],
  ["Как запросить копию или удаление данных?", "Войдите в аккаунт, откройте профиль и центр конфиденциальности. Запрос на удаление отправляется на рассмотрение и не удаляет аккаунт автоматически."]
];

function CloudyMascot() {
  return (
    <svg viewBox="0 0 100 80" aria-hidden="true" className="h-14 w-16 shrink-0">
      <defs><linearGradient id="cloudyLegalMascot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#bfe0ff" /></linearGradient></defs>
      <path d="M26 68a18 18 0 0 1-2-37 24 24 0 0 1 46-6 20 20 0 0 1 6 43z" fill="url(#cloudyLegalMascot)" />
      <g fill="#06143a"><circle cx="40" cy="45" r="5" /><circle cx="62" cy="45" r="5" /></g>
      <g fill="#fff"><circle cx="42" cy="43" r="1.8" /><circle cx="64" cy="43" r="1.8" /></g>
      <path d="M44 54q7 8 14 0" stroke="#06143a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <g fill="#ff9fb0" opacity=".55"><circle cx="31" cy="55" r="4" /><circle cx="71" cy="55" r="4" /></g>
    </svg>
  );
}

export function LegalPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const active = LEGAL_DOCUMENTS.find((document) => document.id === activeId);
  const activeMeta = active ? LEGAL_META[active.id] : null;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const update = () => {
      const max = node.scrollHeight - node.clientHeight;
      setScrollProgress(max > 0 ? Math.min(100, Math.round((node.scrollTop / max) * 100)) : 0);
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    return () => node.removeEventListener("scroll", update);
  }, [activeId]);

  const openDocument = (id: string) => {
    setActiveId(id);
    setExpandedSections([]);
    setScrollProgress(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };
  const goHome = () => {
    setActiveId(null);
    setExpandedSections([]);
    setScrollProgress(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };
  const jumpToSection = (index: number) => {
    const target = document.getElementById("legal-section-" + index);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const toggleSection = (heading: string) => {
    setExpandedSections((current) => current.includes(heading) ? current.filter((item) => item !== heading) : [...current, heading]);
  };

  return (
    <main className="lgl-root" aria-label="Юридический центр Cloudy English">
      <style>{LEGAL_PAGE_STYLES}</style>
      <div className="lgl-in">
        <header className="lgl-top">
          {active ? (
            <button type="button" className="lgl-back" onClick={goHome} aria-label="Вернуться ко всем документам"><ArrowLeft size={21} /></button>
          ) : <div className="lgl-back" aria-hidden="true"><CloudyMascot /></div>}
          <h3>{active ? active.title : "Юридический центр"}</h3>
          {active ? <span className="text-xs font-bold text-white/65">{scrollProgress}%</span> : <span className="text-xs font-bold text-white/65">Версия 1.0</span>}
        </header>
        {active && <div className="lgl-prog" aria-label="Прогресс чтения"><i style={{ width: scrollProgress + "%" }} /></div>}
        <div className="lgl-scroll" ref={scrollRef} key={activeId || "home"}>
          {active && activeMeta ? (
            <article className="lgl-pg fwd" style={{ ["--h" as string]: activeMeta.color } as CSSProperties}>
              <div className="lgl-dh">
                <div className="lgl-dh-ic"><activeMeta.icon size={30} /></div>
                <div><h2>{active.title}</h2><p>{active.description}</p></div>
              </div>
              <div className="lgl-short">
                <div className="lgl-short-t"><span aria-hidden="true"><activeMeta.icon size={20} /></span><b>Кратко о документе</b></div>
                <ul>{activeMeta.highlights.map((item, index) => <li key={item} style={{ ["--i" as string]: index } as CSSProperties}><i aria-hidden="true"><Check size={14} /></i><span>{item}</span></li>)}</ul>
                <p className="mt-3 text-xs leading-relaxed text-white/65">Полные условия приведены ниже. Краткое содержание не заменяет текст документа.</p>
              </div>
              <div className="lgl-toc" aria-label="Навигация по разделам">
                {active.sections.map(([heading], index) => (
                  <button type="button" key={heading} onClick={() => jumpToSection(index)}>{heading.replace(/^\d+\.\s*/, "")}</button>
                ))}
              </div>
              {active.sections.map(([heading, body], index) => {
                const expanded = expandedSections.includes(heading);
                const splitAt = body.indexOf(". ");
                const preview = splitAt > 50 ? body.slice(0, splitAt + 1) : body.slice(0, 220);
                return (
                  <section id={"legal-section-" + index} key={heading} className={"lgl-sec" + (expanded ? " expanded" : "")} style={{ ["--i" as string]: index, ["--h" as string]: activeMeta.color } as CSSProperties}>
                    <div className="lgl-sec-h"><span className="lgl-n">{index + 1}</span><h4>{heading.replace(/^\d+\.\s*/, "")}</h4></div>
                    <p>{expanded ? body : preview}</p>
                    {body.length > preview.length && <button type="button" className="lgl-orig" onClick={() => toggleSection(heading)} aria-expanded={expanded}><span>{expanded ? "Свернуть раздел" : "Читать полный раздел"}</span><i>⌄</i></button>}
                  </section>
                );
              })}
              <button type="button" className="lgl-support" onClick={() => window.open("https://t.me/cloudysupportt_bot", "_blank", "noopener,noreferrer")}>
                <span className="lgl-sup-ic"><MessageCircle size={25} /></span>
                <span className="lgl-support-copy"><b>Остались вопросы?</b><small>Напишите в официальную поддержку</small></span>
                <ArrowUpRight size={21} />
              </button>
              <p className="mt-4 text-center text-xs text-white/45">Редакция от 9 ноября 2026 года</p>
            </article>
          ) : (
            <div className="lgl-pg fwd">
              <section className="lgl-hero">
                <div className="lgl-hero-ic"><CloudyMascot /></div>
                <h2>Правила и документы</h2>
                <p>Юридическая информация, конфиденциальность и безопасность обучения в Cloudy English Academy.</p>
              </section>
              <h4 className="lgl-h">Документы</h4>
              <div className="lgl-cards">
                {LEGAL_DOCUMENTS.map((document, index) => {
                  const meta = LEGAL_META[document.id];
                  const Icon = meta.icon;
                  return (
                    <button type="button" key={document.id} className="lgl-card" style={{ ["--i" as string]: index, ["--h" as string]: meta.color } as CSSProperties} onClick={() => openDocument(document.id)} aria-label={"Открыть документ: " + document.title}>
                      <span className="lgl-ic"><Icon size={26} /></span>
                      <span className="lgl-ct"><b>{document.title}</b><small>{document.description}</small></span>
                      <em>{meta.label}</em>
                      <ArrowUpRight size={18} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              <h4 className="lgl-h">Частые вопросы</h4>
              <div className="lgl-faq">
                {LEGAL_FAQ.map(([question, answer], index) => (
                  <div className={"lgl-q" + (openFaq === index ? " open" : "")} key={question} style={{ ["--i" as string]: index } as CSSProperties}>
                    <button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}>
                      <span>{question}</span><i aria-hidden="true">+</i>
                    </button>
                    <div className="lgl-x"><div><p>{answer}</p></div></div>
                  </div>
                ))}
              </div>
              <a className="lgl-support" href="https://t.me/cloudysupportt_bot" target="_blank" rel="noopener noreferrer">
                <span className="lgl-sup-ic"><MessageCircle size={25} /></span>
                <span className="lgl-support-copy"><b>Поддержка Cloudy English</b><small>Помощь с аккаунтом, обучением и документами</small></span>
                <ArrowUpRight size={21} />
              </a>
              <footer className="py-6 text-center text-xs text-white/45">Cloudy English Academy · Юридический центр · 9 ноября 2026 года</footer>
              <a href="/" className="block pb-5 text-center text-sm font-bold text-[#8fd3ff]">Вернуться к обучению</a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/legal")({
  staticData: { sitemap: true },
  head: () => ({ meta: [
    { title: "Правила и документы — Cloudy English Academy" },
    { name: "description", content: "Правила использования, конфиденциальности и безопасности Cloudy English Academy." },
    { property: "og:title", content: "Правила и документы — Cloudy English Academy" },
    { property: "og:description", content: "Юридические документы и контакты поддержки Cloudy English Academy." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: LegalPage,
});
