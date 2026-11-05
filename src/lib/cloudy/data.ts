import type { Lesson, Level, LevelDef } from "./types";

const P = (t: string, w: string, s: string): Lesson => ({
  t,
  w: w.split(",").map((x) => x.split("=") as [string, string]),
  s: s.split(";").map((x) => x.split("=") as [string, string, string]),
});

export const D: Lesson[] = [
  { t: "Привет", w: [["hello", "привет"], ["goodbye", "пока"], ["thanks", "спасибо"], ["please", "пожалуйста"], ["yes", "да"], ["no", "нет"]], s: [["Привет, меня зовут Анна", "Hello, my name is Anna.", "you the"], ["Да, пожалуйста", "Yes, please.", "no thanks"]] },
  { t: "Семья", w: [["mother", "мама"], ["father", "папа"], ["brother", "брат"], ["sister", "сестра"], ["son", "сын"], ["daughter", "дочь"]], s: [["У меня есть брат", "I have a brother", "sister the"], ["Это моя мама", "This is my mother", "father your"]] },
  { t: "Числа", w: [["one", "один"], ["two", "два"], ["three", "три"], ["four", "четыре"], ["five", "пять"], ["six", "шесть"]], s: [["Это число шесть", "This number is six.", "four the"], ["У меня три книги", "I have three books", "two a"]] },
  { t: "Еда", w: [["apple", "яблоко"], ["water", "вода"], ["bread", "хлеб"], ["milk", "молоко"], ["coffee", "кофе"], ["cheese", "сыр"]], s: [["Я люблю кофе", "I like coffee", "water the"], ["Мне нужна вода", "I need water", "bread a"]] },
  { t: "Дом", w: [["house", "дом"], ["door", "дверь"], ["window", "окно"], ["table", "стол"], ["bed", "кровать"], ["book", "книга"]], s: [["Это мой дом", "This is my house", "your a"], ["У меня есть книга", "I have a book", "table the"]] },
  { t: "Цвета", w: [["red", "красный"], ["blue", "синий"], ["green", "зелёный"], ["yellow", "жёлтый"], ["black", "чёрный"], ["white", "белый"]], s: [["Это красное яблоко", "This is a red apple", "blue the"], ["Небо синее", "The sky is blue", "red green"]] },
  { t: "Город", w: [["bank", "банк"], ["street", "улица"], ["station", "вокзал"], ["market", "рынок"], ["park", "парк"], ["bridge", "мост"]], s: [["Я иду в парк", "I'm going to the park", "market a"], ["Где находится вокзал?", "Where is the station?", "street a"]] },
  { t: "Покупки", w: [["cheap", "дешёвый"], ["expensive", "дорогой"], ["price", "цена"], ["shop", "магазин"], ["money", "деньги"], ["ticket", "билет"]], s: [["Сколько это стоит?", "How much is it?", "cheap the"], ["У меня нет денег", "I have no money", "shop a"]] },
  { t: "Время", w: [["morning", "утро"], ["evening", "вечер"], ["today", "сегодня"], ["tomorrow", "завтра"], ["week", "неделя"], ["always", "всегда"]], s: [["Увидимся завтра", "See you tomorrow", "today the"], ["Я всегда пью кофе утром", "I always drink coffee in the morning", "evening a"]] },
  { t: "Работа", w: [["job", "работа"], ["office", "офис"], ["meeting", "встреча"], ["boss", "начальник"], ["salary", "зарплата"], ["skill", "навык"]], s: [["У меня завтра встреча", "I have a meeting tomorrow", "office the"], ["Я ищу новую работу", "I am looking for a new job", "boss the"]] },
  { t: "Поездки", w: [["journey", "путешествие"], ["luggage", "багаж"], ["passport", "паспорт"], ["flight", "рейс"], ["hotel", "отель"], ["reservation", "бронь"]], s: [["Я забронировал отель", "I booked a hotel", "flight the"], ["Где мой багаж?", "Where is my luggage?", "passport the"]] },
  { t: "Здоровье", w: [["healthy", "здоровый"], ["medicine", "лекарство"], ["headache", "головная боль"], ["advice", "совет"], ["exercise", "упражнение"], ["recover", "восстановиться"]], s: [["Мне нужен медицинский совет", "I need medical advice", "doctor the"], ["Она быстро восстановилась", "She recovered quickly", "healthy a"]] },
  { t: "Мнения", w: [["opinion", "мнение"], ["agree", "соглашаться"], ["argue", "спорить"], ["evidence", "доказательство"], ["however", "однако"], ["although", "хотя"]], s: [["Я не согласен с вами", "I disagree with you", "agree the"], ["Хотя было поздно, мы работали", "Although it was late we worked", "however the"]] },
  { t: "Общество", w: [["government", "правительство"], ["society", "общество"], ["environment", "окружающая среда"], ["economy", "экономика"], ["challenge", "вызов"], ["achievement", "достижение"]], s: [["Экономика быстро растёт", "The economy is growing fast", "society the"], ["Это большой вызов", "This is a big challenge", "government a"]] },
  { t: "Бизнес", w: [["deadline", "срок"], ["budget", "бюджет"], ["negotiate", "вести переговоры"], ["strategy", "стратегия"], ["profit", "прибыль"], ["risk", "риск"]], s: [["Нам нужна новая стратегия", "We need a new strategy", "budget the"], ["Срок уже близко", "The deadline is close", "risk a"]] },
  P("Ресторан", "restaurant=ресторан,menu=меню,bill=счёт,waiter=официант,delicious=вкусный,hungry=голодный", "Можно мне счёт, пожалуйста?=Could I have the bill, please?=menu the;Я очень голоден=I am very hungry=waiter a"),
  P("Погода", "weather=погода,rainy=дождливый,sunny=солнечный,cold=холодный,wind=ветер,snow=снег", "Сегодня солнечно=It is sunny today=rainy the;Зимой идёт снег=It snows in winter=wind a"),
  P("Одежда", "jacket=куртка,shoes=обувь,dress=платье,shirt=рубашка,size=размер,wear=носить", "Мне нужна куртка=I need a jacket=shoes the;Какой размер вы носите?=What size do you wear?=dress a"),
  P("Технологии", "password=пароль,download=скачивать,screen=экран,battery=батарея,website=сайт,update=обновление", "Я забыл пароль=I forgot my password=screen the;Батарея почти разряжена=The battery is almost dead=update a"),
  P("Эмоции", "nervous=нервный,proud=гордый,embarrassed=смущённый,disappointed=разочарованный,excited=взволнованный,jealous=завистливый", "Я горжусь тобой=I am proud of you=nervous the;Она была разочарована=She was disappointed=excited a"),
  P("Учёба", "degree=степень,lecture=лекция,exam=экзамен,subject=предмет,scholarship=стипендия,graduate=окончить", "Завтра у меня экзамен=I have an exam tomorrow=lecture the;Это мой любимый предмет=This is my favorite subject=degree a"),
  P("Инновации", "innovation=инновация,algorithm=алгоритм,privacy=конфиденциальность,device=устройство,breakthrough=прорыв,reliable=надёжный", "Это настоящий прорыв=This is a real breakthrough=device the;Мы ценим конфиденциальность=We value privacy=algorithm a"),
  P("Культура", "heritage=наследие,tradition=традиция,exhibition=выставка,ancient=древний,masterpiece=шедевр,influence=влияние", "Мы посетили выставку=We visited the exhibition=heritage the;Это настоящий шедевр=It is a true masterpiece=ancient a"),
  P("Карьера", "promotion=повышение,colleague=коллега,resign=уволиться,experience=опыт,demanding=требовательный,workload=нагрузка", "Я получил повышение=I got a promotion=colleague the;У него большой опыт=He has a lot of experience=workload a"),
];

const A1_EXTRA: Lesson[] = [
  {
    "t": "Люди и друзья",
    "w": [
      [
        "friend",
        "друг"
      ],
      [
        "boy",
        "мальчик"
      ],
      [
        "girl",
        "девочка"
      ],
      [
        "person",
        "человек"
      ],
      [
        "people",
        "люди"
      ]
    ],
    "s": [
      [
        "Это мой друг",
        "This is my friend",
        "are the"
      ],
      [
        "Она хорошая девочка",
        "She is a good girl",
        "am the"
      ],
      [
        "У меня два друга",
        "I have two friends",
        "has a"
      ],
      [
        "Они мои друзья",
        "They are my friends",
        "is the"
      ]
    ]
  },
  {
    "t": "Мой день",
    "w": [
      [
        "wake up",
        "просыпаться"
      ],
      [
        "get up",
        "вставать"
      ],
      [
        "breakfast",
        "завтрак"
      ],
      [
        "lunch",
        "обед"
      ],
      [
        "dinner",
        "ужин"
      ]
    ],
    "s": [
      [
        "Я встаю в семь",
        "I get up at seven",
        "is the"
      ],
      [
        "Мы завтракаем дома",
        "We have breakfast at home",
        "has a"
      ],
      [
        "Она обедает в школе",
        "She has lunch at school",
        "have the"
      ],
      [
        "Я ужинаю с семьёй",
        "I have dinner with my family",
        "is a"
      ]
    ]
  },
  {
    "t": "В школе",
    "w": [
      [
        "teacher",
        "учитель"
      ],
      [
        "student",
        "ученик"
      ],
      [
        "pencil",
        "карандаш"
      ],
      [
        "pen",
        "ручка"
      ],
      [
        "classroom",
        "классная комната"
      ]
    ],
    "s": [
      [
        "Мой учитель добрый",
        "My teacher is kind",
        "are the"
      ],
      [
        "Я ученик",
        "I am a student",
        "is the"
      ],
      [
        "Это твоя ручка",
        "This is your pen",
        "are a"
      ],
      [
        "У меня есть карандаш",
        "I have a pencil",
        "has the"
      ]
    ]
  },
  {
    "t": "Части тела",
    "w": [
      [
        "head",
        "голова"
      ],
      [
        "hand",
        "кисть руки"
      ],
      [
        "eye",
        "глаз"
      ],
      [
        "nose",
        "нос"
      ],
      [
        "mouth",
        "рот"
      ]
    ],
    "s": [
      [
        "У меня две руки",
        "I have two hands",
        "has a"
      ],
      [
        "У неё голубые глаза",
        "She has blue eyes",
        "have the"
      ],
      [
        "Это мой нос",
        "This is my nose",
        "are a"
      ],
      [
        "Открой рот",
        "Open your mouth",
        "opens the"
      ]
    ]
  },
  {
    "t": "Животные",
    "w": [
      [
        "dog",
        "собака"
      ],
      [
        "cat",
        "кошка"
      ],
      [
        "bird",
        "птица"
      ],
      [
        "fish",
        "рыба"
      ],
      [
        "horse",
        "лошадь"
      ]
    ],
    "s": [
      [
        "У меня есть собака",
        "I have a dog",
        "has the"
      ],
      [
        "Кошка маленькая",
        "The cat is small",
        "are a"
      ],
      [
        "Птица умеет летать",
        "A bird can fly",
        "is the"
      ],
      [
        "Лошади быстрые",
        "Horses are fast",
        "is a"
      ]
    ]
  },
  {
    "t": "Еда и напитки",
    "w": [
      [
        "banana",
        "банан"
      ],
      [
        "orange",
        "апельсин"
      ],
      [
        "egg",
        "яйцо"
      ],
      [
        "rice",
        "рис"
      ],
      [
        "tea",
        "чай"
      ]
    ],
    "s": [
      [
        "Я ем банан",
        "I eat a banana",
        "drinks the"
      ],
      [
        "Она любит апельсины",
        "She likes oranges",
        "like a"
      ],
      [
        "На завтрак я ем яйцо",
        "I eat an egg for breakfast",
        "a the"
      ],
      [
        "Мы пьём чай",
        "We drink tea",
        "drinks an"
      ]
    ]
  },
  {
    "t": "Места вокруг нас",
    "w": [
      [
        "school",
        "школа"
      ],
      [
        "hospital",
        "больница"
      ],
      [
        "supermarket",
        "супермаркет"
      ],
      [
        "library",
        "библиотека"
      ],
      [
        "cinema",
        "кинотеатр"
      ]
    ],
    "s": [
      [
        "Моя школа рядом",
        "My school is nearby",
        "are the"
      ],
      [
        "Больница большая",
        "The hospital is big",
        "are a"
      ],
      [
        "Я иду в библиотеку",
        "I'm going to the library",
        "goes a"
      ],
      [
        "Кинотеатр рядом с домом",
        "The cinema is near my home",
        "are a"
      ]
    ]
  },
  {
    "t": "Транспорт",
    "w": [
      [
        "bus",
        "автобус"
      ],
      [
        "train",
        "поезд"
      ],
      [
        "car",
        "машина"
      ],
      [
        "bicycle",
        "велосипед"
      ],
      [
        "taxi",
        "такси"
      ]
    ],
    "s": [
      [
        "Я езжу на автобусе",
        "I go by bus",
        "goes the"
      ],
      [
        "Поезд быстрый",
        "The train is fast",
        "are a"
      ],
      [
        "У моего папы есть машина",
        "My father has a car",
        "have the"
      ],
      [
        "Она ездит на велосипеде",
        "She rides a bicycle",
        "ride the"
      ]
    ]
  },
  {
    "t": "Природа",
    "w": [
      [
        "sun",
        "солнце"
      ],
      [
        "cloud",
        "облако"
      ],
      [
        "tree",
        "дерево"
      ],
      [
        "flower",
        "цветок"
      ],
      [
        "river",
        "река"
      ]
    ],
    "s": [
      [
        "Солнце жёлтое",
        "The sun is yellow",
        "are a"
      ],
      [
        "В небе облако",
        "There is a cloud in the sky",
        "are an"
      ],
      [
        "Это высокое дерево",
        "This is a tall tree",
        "are the"
      ],
      [
        "Цветок красивый",
        "The flower is beautiful",
        "are a"
      ]
    ]
  },
  {
    "t": "Свободное время",
    "w": [
      [
        "music",
        "музыка"
      ],
      [
        "sport",
        "спорт"
      ],
      [
        "game",
        "игра"
      ],
      [
        "swim",
        "плавать"
      ],
      [
        "dance",
        "танцевать"
      ]
    ],
    "s": [
      [
        "Я люблю музыку",
        "I like music",
        "likes the"
      ],
      [
        "Мы играем в игру",
        "We play a game",
        "plays the"
      ],
      [
        "Я умею плавать",
        "I can swim",
        "am the"
      ],
      [
        "Она любит танцевать",
        "She likes to dance",
        "like a"
      ]
    ]
  },
  {
    "t": "Мои вещи",
    "w": [
      [
        "phone",
        "телефон"
      ],
      [
        "key",
        "ключ"
      ],
      [
        "bag",
        "сумка"
      ],
      [
        "cup",
        "чашка"
      ],
      [
        "clock",
        "настенные / настольные часы"
      ]
    ],
    "s": [
      [
        "Где мой телефон?",
        "Where is my phone?",
        "are the"
      ],
      [
        "Это твой ключ",
        "This is your key",
        "are a"
      ],
      [
        "У меня новая сумка",
        "I have a new bag",
        "has the"
      ],
      [
        "Чашка на столе",
        "The cup is on the table",
        "are a"
      ]
    ]
  },
  {
    "t": "Дни и время",
    "w": [
      [
        "Monday",
        "понедельник"
      ],
      [
        "Tuesday",
        "вторник"
      ],
      [
        "Friday",
        "пятница"
      ],
      [
        "weekend",
        "выходные"
      ],
      [
        "hour",
        "час"
      ]
    ],
    "s": [
      [
        "Сегодня понедельник",
        "Today is Monday",
        "are the"
      ],
      [
        "Во вторник я учусь",
        "I study on Tuesday",
        "studies a"
      ],
      [
        "В пятницу мы дома",
        "We are at home on Friday",
        "is the"
      ],
      [
        "У меня есть один час",
        "I have one hour",
        "has a"
      ]
    ]
  },
  {
    "t": "Простые описания",
    "w": [
      [
        "big",
        "большой"
      ],
      [
        "small",
        "маленький"
      ],
      [
        "new",
        "новый"
      ],
      [
        "old",
        "старый"
      ],
      [
        "happy",
        "счастливый"
      ]
    ],
    "s": [
      [
        "Мой дом большой",
        "My house is big",
        "are the"
      ],
      [
        "Это маленькая кошка",
        "This is a small cat",
        "are the"
      ],
      [
        "У меня новый телефон",
        "I have a new phone",
        "has the"
      ],
      [
        "Моя бабушка счастлива",
        "My grandmother is happy",
        "are a"
      ]
    ]
  },
  {
    "t": "Действия",
    "w": [
      [
        "open",
        "открывать"
      ],
      [
        "close",
        "закрывать"
      ],
      [
        "sit",
        "сидеть"
      ],
      [
        "stand",
        "стоять"
      ],
      [
        "help",
        "помогать"
      ]
    ],
    "s": [
      [
        "Открой дверь",
        "Open the door",
        "opens a"
      ],
      [
        "Закрой окно",
        "Close the window",
        "closes a"
      ],
      [
        "Садись здесь",
        "Sit here",
        "sits the"
      ],
      [
        "Помоги мне, пожалуйста.",
        "Please help me",
        "helps the"
      ]
    ]
  },
  {
    "t": "Одежда",
    "w": [
      [
        "hat",
        "шляпа"
      ],
      [
        "coat",
        "пальто"
      ],
      [
        "socks",
        "носки"
      ],
      [
        "trousers",
        "брюки"
      ],
      [
        "skirt",
        "юбка"
      ]
    ],
    "s": [
      [
        "Моя шляпа синяя",
        "My hat is blue",
        "are the"
      ],
      [
        "Надень пальто",
        "Put on your coat",
        "puts a"
      ],
      [
        "Мои носки белые",
        "My socks are white",
        "is the"
      ],
      [
        "Её юбка новая",
        "Her skirt is new",
        "are a"
      ]
    ]
  }
];

D.push(...A1_EXTRA);

const A2_EXTRA = [
  P("Распорядок дня и привычки", "routine=распорядок дня,schedule=расписание,usually=обычно,rarely=редко,early=рано,late=поздно", "Я обычно просыпаюсь рано=I usually wake up early=never late;Я редко смотрю телевизор=I rarely watch TV=always the;Мой рабочий день начинается в девять=My working day starts at nine=finish yesterday"),
  P("Прошедшие выходные", "visited=посетил,bought=купил,met=встретил,spent=провёл,stayed=остался,trip=поездка", "Мы посетили музей вчера=We visited the museum yesterday=tomorrow the;Он купил новый билет=He bought a new ticket=buys tomorrow;Я встретил друга в парке=I met a friend in the park=meet the"),
  P("Планы на будущее", "plan=план,invite=приглашать,appointment=назначенная встреча,arrange=организовать,decide=решать,hope=надеяться", "Я собираюсь навестить двоюродного брата или сестру=I am going to visit my cousin=visited yesterday;Мы встречаемся с друзьями завтра=We are meeting friends tomorrow=met last week;Она надеется найти новую работу=She hopes to find a new job=found yesterday"),
  P("Сравнение мест и вещей", "crowded=переполненный,quiet=тихий,modern=современный,comfortable=удобный,safer=безопаснее,farther=дальше", "Этот район тише центра=This area is quieter than the city centre=the quietest;Это самый удобный отель=This is the most comfortable hotel=more comfortable;Моя поездка короче твоей=My trip is shorter than yours=the shortest"),
  P("Количество и покупки", "a little=немного,a few=несколько,enough=достаточно,too much=слишком много,bottle=бутылка,packet=пакет", "В бутылке немного воды=There is a little water in the bottle=many bottles;Нам нужно несколько яблок=We need a few apples=any apple;У нас достаточно времени=We have enough time=too many times"),
  P("Путешествия и направления", "turn left=повернуть налево,straight ahead=прямо,opposite=напротив,corner=угол,platform=платформа,return ticket=билет туда и обратно", "Поверните налево на углу=Turn left at the corner=turn right;Банк напротив вокзала=The bank is opposite the station=behind the;Мне нужен билет туда и обратно=I need a return ticket=one way"),
  P("Здоровье и советы", "cough=кашель,fever=повышенная температура,sore throat=боль в горле,should=следует,rest=отдых,medical appointment=приём у врача", "Тебе следует отдохнуть=You should get some rest=shouldn't work;У него болит горло=He has a sore throat=has a headache;Мне нужно записаться к врачу=I need to make an appointment with the doctor=cancel the"),
  P("Домашние обязанности", "tidy=убирать,sweep=подметать,wash up=мыть посуду,take out the rubbish=выносить мусор,repair=чинить,have to=быть должным", "Мне нужно убрать комнату=I have to tidy my room=tidied yesterday;Ей не нужно работать в воскресенье=She doesn't have to work on Sunday=mustn't the;Пожалуйста, вынеси мусор=Please take out the rubbish=bring the"),
  P("Жизненный опыт", "ever=когда-либо,never=никогда,already=уже,yet=ещё,recently=недавно,experience=опыт", "Ты когда-нибудь был в Лондоне?=Have you ever been to London?=Did you ever go;Я ещё не закончил домашнюю работу=I haven't finished my homework yet=already finished;Она уже позвонила маме=She has already called her mother=will call tomorrow"),
  P("Приглашения и договорённости", "would you like=не хотел бы ты,shall we=давай,sounds great=звучит отлично,available=свободный,maybe=возможно,unfortunately=к сожалению", "Хочешь пойти в кино?=Would you like to go to the cinema?=Do you like cinema;Давай встретимся в шесть?=Shall we meet at six?=Did we meet;Это звучит отлично=That sounds great=That sounds bad"),
  P("Природа и окружающая среда", "recycle=перерабатывать,pollution=загрязнение,waste=отходы,protect=защищать,save energy=экономить энергию,reduce=сокращать", "Мы должны перерабатывать бумагу=We should recycle paper=throw the;Загрязнение воздуха — серьёзная проблема=Air pollution is a serious problem=water the;Выключай свет, чтобы экономить энергию=Turn off the lights to save energy=leave everything on"),
  P("Общение и обучение", "explain=объяснять,repeat=повторять,understand=понимать,remember=помнить,forget=забывать,instruction=инструкция", "Можешь повторить вопрос?=Could you repeat the question?=forget the;Я не понял инструкции=I didn't understand the instructions=remembered yesterday;Она объяснила правило ясно=She explained the rule clearly=explains unclear"),
  P("Работа и обязанности", "task=задача,colleague=коллега,customer=клиент,shift=рабочая смена,busy=занятый,finish=заканчивать,start=начинать,help=помогать,break=перерыв,uniform=форма", "Я начинаю работу в девять=I start work at nine=starts the;Моя смена заканчивается в шесть=My shift finishes at six=finish yesterday;Сегодня у нас много задач=We have a lot of tasks today=has much task;Мой коллега помогает клиентам=My colleague helps customers=help customer;Я делаю перерыв после обеда=I take a break after lunch=takes break;На работе я ношу форму=I wear a uniform at work=wears uniforms"),
  P("Решение повседневных проблем", "problem=проблема,broken=сломанный,fix=чинить,lost=потерянный,find=находить,ask=спрашивать,explain=объяснять,mistake=ошибка,possible=возможный,need=нуждаться / быть необходимым", "Мой телефон сломан=My phone is broken=My phone are broken;Я не могу найти ключи=I can't find my keys=I can find my keys;Можешь мне помочь?=Can you help me?=Can you helps me?;Я ошибся с адресом=I made a mistake with the address=I make mistake yesterday;Пожалуйста, объясните проблему=Please explain the problem=Please explains the problem;Можно это исправить сегодня?=Is it possible to fix this today?=Was it possible yesterday?"),
  P("Цели и планы", "goal=цель,improve=улучшать,practise=заниматься / практиковаться,course=курс,skill=навык,next=следующий,future=будущее,choose=выбирать,hope=надеяться,progress=прогресс", "Моя цель — лучше говорить по-английски=My goal is to speak English better=My goal speak better;Я каждый день занимаюсь английским=I practise English every day=I practises every day;Я хочу пройти новый курс=I want to take a new course=I wanted yesterday;Мне нужно улучшить навыки=I need to improve my skills=I needs improve;Что ты хочешь делать дальше?=What do you want to do next?=What you wanted yesterday;Я надеюсь добиться прогресса=I hope to make progress=I hope making progress")
];
D.push(...A2_EXTRA);

const extendLesson = (index: number, words: Lesson["w"], sentences: Lesson["s"]) => {
  const lesson = D[index];
  if (!lesson) throw new Error("Missing Cloudy lesson at index " + index);
  lesson.w.push(...words);
  lesson.s.push(...sentences);
};


 // Expand A1 lessons with beginner-safe vocabulary and short everyday sentences.
extendLesson(0, [["good morning", "доброе утро"], ["good evening", "добрый вечер"], ["name", "имя"], ["meet", "знакомиться"]], [
  ["Доброе утро!", "Good morning!", "Good evenings!"],
  ["Как тебя зовут?", "What's your name?", "What's he name?"],
  ["Приятно познакомиться", "Nice to meet you", "Nice meet you"],
  ["До скорой встречи!", "See you soon!", "See you yesterday!"],
]);
extendLesson(1, [["parents", "родители"], ["child", "ребёнок"], ["grandmother", "бабушка"], ["grandfather", "дедушка"]], [
  ["Это моя семья", "This is my family", "These is my family"],
  ["Мои родители дома", "My parents are at home", "My parents is home"],
  ["У неё есть сын", "She has a son", "She have a son"],
  ["Мой дедушка добрый", "My grandfather is kind", "My grandfather are kind"],
]);
extendLesson(2, [["seven", "семь"], ["eight", "восемь"], ["nine", "девять"], ["ten", "десять"]], [
  ["Мне десять лет", "I am ten years old", "I have ten years"],
  ["У меня пять яблок", "I have five apples", "I has five apples"],
  ["Сколько тебе лет?", "How old are you?", "How many years you?"],
  ["Номер автобуса — семь", "The bus number is seven", "The bus number are seven"],
]);
extendLesson(3, [["banana", "банан"], ["tea", "чай"], ["egg", "яйцо"], ["rice", "рис"]], [
  ["Я ем яблоко", "I eat an apple", "I eats an apple"],
  ["Она пьёт чай", "She drinks tea", "She drink tea"],
  ["Мы любим сыр", "We like cheese", "We likes cheese"],
  ["Я ем хлеб на завтрак", "I eat bread for breakfast", "I eat bread at breakfast"],
]);
extendLesson(4, [["kitchen", "кухня"], ["bathroom", "ванная"], ["chair", "стул"], ["room", "комната"]], [
  ["Книга на столе", "The book is on the table", "The book are on table"],
  ["Моя кровать в комнате", "My bed is in the room", "My bed are in room"],
  ["Кухня большая", "The kitchen is big", "The kitchen are big"],
  ["Закрой дверь, пожалуйста", "Close the door, please", "Closes the door please"],
]);
extendLesson(5, [["orange", "оранжевый"], ["pink", "розовый"], ["brown", "коричневый"], ["grey", "серый"]], [
  ["Моя сумка синяя", "My bag is blue", "My bag are blue"],
  ["У неё красное платье", "She has a red dress", "She have a red dress"],
  ["Трава зелёная", "The grass is green", "The grass are green"],
  ["Мой любимый цвет — жёлтый", "My favourite colour is yellow", "My favourite colour are yellow"],
]);
extendLesson(24, [["family", "семья"], ["classmate", "одноклассник"], ["kind", "добрый"], ["together", "вместе"], ["meet", "встречаться"]], [
  ["Мой одноклассник очень добрый", "My classmate is very kind", "My classmate are kind"],
  ["Мы часто играем вместе", "We often play together", "We often plays together"],
]);
extendLesson(25, [["morning", "утро"], ["school", "школа"], ["work", "работа"], ["usually", "обычно"], ["at night", "ночью"]], [
  ["Я просыпаюсь рано утром", "I wake up early in the morning", "I wakes up early"],
  ["Мы ужинаем в семь часов", "We have dinner at seven", "We has dinner at seven"],
]);
extendLesson(26, [["book", "книга"], ["desk", "парта"], ["lesson", "урок"], ["homework", "домашнее задание"], ["bag", "сумка"]], [
  ["У нас сегодня английский", "We have English today", "We has English today"],
  ["Мой карандаш в сумке", "My pencil is in my bag", "My pencil are in my bag"],
]);
extendLesson(27, [["arm", "рука"], ["leg", "нога"], ["foot", "ступня"], ["ear", "ухо"], ["hair", "волосы"]], [
  ["У неё длинные волосы", "She has long hair", "She have long hair"],
  ["У меня болит нога", "My leg hurts", "My leg hurted"],
]);
extendLesson(28, [["cow", "корова"], ["rabbit", "кролик"], ["mouse", "мышь"], ["farm", "ферма"], ["small", "маленький"]], [
  ["Кролик маленький", "The rabbit is small", "The rabbit are small"],
  ["Лошадь на ферме", "The horse is on the farm", "The horse are farm"],
]);
extendLesson(29, [["juice", "сок"], ["water", "вода"], ["chicken", "курица"], ["potato", "картофель"], ["hungry", "голодный"]], [
  ["Я хочу апельсиновый сок", "I want orange juice", "I wants orange juice"],
  ["Она ест рис и курицу", "She eats rice and chicken", "She eat rice and chicken"],
]);
extendLesson(30, [["shop", "магазин"], ["cafe", "кафе"], ["park", "парк"], ["near", "рядом"], ["street", "улица"]], [
  ["Библиотека рядом со школой", "The library is near the school", "The library are near school"],
  ["Мы идём в кафе", "We're going to a cafe", "We goes to cafe"],
]);
extendLesson(31, [["driver", "водитель"], ["road", "дорога"], ["bus stop", "автобусная остановка"], ["fast", "быстрый"], ["slow", "медленный"]], [
  ["Автобус останавливается здесь", "The bus stops here", "The bus stop here"],
  ["Мой папа водит машину", "My father drives a car", "My father drive a car"],
]);
extendLesson(32, [["sky", "небо"], ["grass", "трава"], ["mountain", "гора"], ["sea", "море"], ["forest", "лес"]], [
  ["Небо сегодня голубое", "The sky is blue today", "The sky are blue today"],
  ["Река рядом с лесом", "The river is near the forest", "The river are near forest"],
]);
extendLesson(33, [["read", "читать"], ["book", "книга"], ["football", "футбол"], ["run", "бегать"], ["weekend", "выходные"]], [
  ["Я читаю книгу вечером", "I read a book in the evening", "I reads a book"],
  ["Мы играем в футбол по воскресеньям", "We play football on Sundays", "We plays football"],
]);
extendLesson(34, [["watch", "наручные часы"], ["wallet", "кошелёк"], ["computer", "компьютер"], ["bottle", "бутылка"], ["glasses", "очки"]], [
  ["Мой телефон на столе", "My phone is on the table", "My phone are on the table"],
  ["Где мои ключи?", "Where are my keys?", "Where is my keys?"],
]);
extendLesson(35, [["Wednesday", "среда"], ["Thursday", "четверг"], ["Saturday", "суббота"], ["Sunday", "воскресенье"], ["calendar", "календарь"]], [
  ["Мой день рождения в субботу", "My birthday is on Saturday", "My birthday are Saturday"],
  ["Урок начинается в девять", "The lesson starts at nine", "The lesson start at nine"],
]);
extendLesson(36, [["beautiful", "красивый"], ["tall", "высокий"], ["short", "низкий"], ["friendly", "дружелюбный"], ["tired", "уставший"]], [
  ["Моя сестра очень дружелюбная", "My sister is very friendly", "My sister are friendly"],
  ["Этот дом старый", "This house is old", "This house are old"],
]);
extendLesson(37, [["read", "читать"], ["write", "писать"], ["walk", "ходить"], ["run", "бегать"], ["listen", "слушать"]], [
  ["Я пишу письмо", "I write a letter", "I writes a letter"],
  ["Послушай эту песню", "Listen to this song", "Listens to this song"],
]);
extendLesson(38, [["shoes", "обувь"], ["shirt", "рубашка"], ["dress", "платье"], ["jacket", "куртка"], ["gloves", "перчатки"]], [
  ["Мои туфли чёрные", "My shoes are black", "My shoes is black"],
  ["Надень свою куртку", "Put on your jacket", "Puts on your jacket"],
]);

// A2 foundations: add practical vocabulary and complete sentence practice.
extendLesson(6, [["pharmacy", "аптека"], ["traffic", "дорожное движение"], ["crossroads", "перекрёсток"]], [
  ["Аптека находится рядом с банком", "The pharmacy is near the bank", "near the"],
  ["На этой улице много машин", "There is a lot of traffic on this street", "are many"],
  ["Поверните направо на перекрёстке", "Turn right at the crossroads", "turn left"],
]);
extendLesson(7, [["receipt", "чек"], ["cash", "наличные"], ["change", "сдача"]], [
  ["Можно получить чек?", "Could I have a receipt?", "Could I get"],
  ["Я заплачу наличными", "I'll pay in cash", "paid yesterday"],
  ["Оставьте сдачу себе", "Keep the change", "take the"],
]);
extendLesson(8, [["midnight", "полночь"], ["noon", "полдень"], ["on time", "вовремя"]], [
  ["Поезд отправляется в половине девятого", "The train leaves at half past eight", "leave tomorrow"],
  ["У меня встреча в полдень", "I have an appointment at noon", "at midnight"],
  ["Мы приехали вовремя", "We arrived on time", "arrive late"],
  ["Мы вернулись домой до полуночи", "We got home before midnight", "We get home at noon"],
]);
extendLesson(15, [["order", "заказывать"], ["starter", "закуска"], ["main course", "основное блюдо"]], [
  ["Я хотел бы заказать салат", "I'd like to order a salad", "I'd like salad"],
  ["Что вы посоветуете на основное блюдо?", "What would you recommend for the main course?", "What you recommend"],
  ["У нас столик на двоих", "We have a table for two", "We has table"],
  ["Я бы хотел закуску", "I'd like a starter", "I like starter"],
]);
extendLesson(16, [["forecast", "прогноз погоды"], ["cloudy", "облачный"], ["temperature", "температура"]], [
  ["По прогнозу будет дождь", "The forecast says it will rain", "The forecast say"],
  ["Сегодня температура десять градусов", "The temperature is ten degrees today", "The temperature are ten"],
  ["Завтра будет облачно", "It will be cloudy tomorrow", "It will cloudy yesterday"],
  ["Возьми с собой зонт", "Take an umbrella with you", "Takes umbrella"],
]);
extendLesson(17, [["boots", "ботинки"], ["tight", "тесный"], ["comfortable", "удобный"]], [
  ["Эти туфли слишком тесные", "These shoes are too tight", "This shoes"],
  ["Эта куртка мне хорошо подходит", "This jacket fits me well", "fit me good"],
  ["Я ищу тёплое пальто", "I'm looking for a warm coat", "I look yesterday"],
  ["Эти ботинки очень удобные", "These boots are very comfortable", "This boots is comfortable"],
]);

// A2 extension topics: broaden each vocabulary set and add contextual phrases.
extendLesson(39, [["sometimes", "иногда"], ["twice", "дважды"]], [
  ["Я иногда хожу на работу пешком", "I sometimes walk to work", "I sometimes walks"],
  ["Я хожу в спортзал два раза в неделю", "I go to the gym twice a week", "I goes to the gym"],
]);
extendLesson(40, [["concert", "концерт"], ["restaurant", "ресторан"]], [
  ["Мы ходили на концерт в субботу", "We went to a concert on Saturday", "We go to a concert tomorrow"],
  ["Мы ужинали в небольшом ресторане", "We had dinner at a small restaurant", "We have dinner tomorrow"],
]);
extendLesson(41, [["probably", "вероятно"], ["perhaps", "возможно"]], [
  ["Возможно, я навещу двоюродного брата в эти выходные", "Perhaps I'll visit my cousin this weekend", "Perhaps I visited last week"],
  ["Мы, вероятно, забронируем столик", "We will probably book a table", "We booked yesterday"],
]);
extendLesson(42, [["cheaper", "дешевле"], ["noisy", "шумный"]], [
  ["Автобус дешевле такси", "The bus is cheaper than a taxi", "the cheapest taxi"],
  ["Это самая тихая комната в отеле", "This is the quietest room in the hotel", "more quiet room"],
  ["Эта улица шумнее парка", "This street is noisier than the park", "This street is noisy than"],
]);
extendLesson(43, [["price", "цена"], ["cash", "наличные"]], [
  ["Сколько стоит эта бутылка?", "How much does this bottle cost?", "How much this cost"],
  ["Осталось не так много яиц", "There aren't many eggs left", "There isn't many"],
  ["Цена включает доставку", "The price includes delivery", "The price include delivery"],
  ["Я предпочитаю платить наличными", "I prefer to pay in cash", "I prefer paying cashless"],
]);
extendLesson(44, [["departure", "отправление"], ["arrival", "прибытие"]], [
  ["Поезд отправляется с платформы номер два", "The train leaves from platform two", "The train leave"],
  ["Идите прямо и поверните налево", "Go straight ahead and turn left", "Go straight and turning"],
  ["Время отправления указано в билете", "The departure time is on the ticket", "The depart time"],
  ["Мы прибываем в десять часов", "Our arrival time is ten o'clock", "We arrives at ten"],
]);
extendLesson(45, [["temperature", "температура"], ["medicine", "лекарство"]], [
  ["Сегодня у меня высокая температура", "I have a high temperature today", "I has a high"],
  ["Тебе следует пить много воды", "You should drink plenty of water", "You should drinks"],
  ["Принимай это лекарство после еды", "Take this medicine after meals", "Takes medicine yesterday"],
]);
extendLesson(46, [["laundry", "стирка"], ["floor", "пол"]], [
  ["По субботам я стираю", "I do the laundry on Saturdays", "I does laundry"],
  ["Пожалуйста, подмети пол на кухне", "Please sweep the kitchen floor", "Please sweeps"],
]);
extendLesson(47, [["been", "был"], ["abroad", "за границей"]], [
  ["Я никогда не путешествовал за границей", "I have never travelled abroad", "I never travelled yesterday"],
  ["Ты уже закончил домашнюю работу?", "Have you finished your homework yet?", "Did you finished"],
]);
extendLesson(48, [["free", "свободный"], ["plan", "план"]], [
  ["Ты свободен в субботу?", "Are you free on Saturday?", "Do you free"],
  ["Извини, я не могу прийти сегодня вечером", "Sorry, I can't come tonight", "I don't can"],
  ["Нам нужно составить план на выходные", "We need to make a plan for the weekend", "We make a plan yesterday"],
]);
extendLesson(49, [["plastic", "пластик"], ["paper", "бумага"]], [
  ["Нам следует использовать меньше пластика", "We should use less plastic", "We should uses"],
  ["Люди могут экономить воду дома", "People can save water at home", "People can saves"],
  ["Положи бумагу в контейнер для переработки", "Put the paper in the recycling bin", "Puts paper in bin"],
]);
extendLesson(50, [["meaning", "значение"], ["example", "пример"]], [
  ["Что означает это слово?", "What does this word mean?", "What this word means"],
  ["Можешь привести пример?", "Can you give me an example?", "Can you gives"],
]);




 // Complete the A2 topic sets to a consistent 10-word / 6-sentence standard.
extendLesson(6, [["neighbourhood", "район"]], [
  ["В моём районе есть большой парк", "There is a large park in my neighbourhood", "There are a park"],
]);
extendLesson(7, [["refund", "возврат денег"]], [
  ["Могу я вернуть эту вещь?", "Can I return this item?", "Can I returned this item"],
]);
extendLesson(8, [["quarter past", "четверть после"]], [
  ["Сейчас четверть шестого", "It's a quarter past five", "It's five past a quarter"],
]);
extendLesson(15, [["dessert", "десерт"]], [
  ["Можем заказать десерт?", "Can we order dessert?", "Can we orders dessert"],
]);
extendLesson(16, [["windy", "ветреный"]], [
  ["Сегодня очень ветрено", "It's very windy today", "It very windy today"],
]);
extendLesson(17, [["socks", "носки"]], [
  ["Мне нужна пара носков", "I need a pair of socks", "I need pair socks"],
]);
extendLesson(39, [["get dressed", "одеваться"], ["commute", "дорога на работу"]], [
  ["Я одеваюсь до завтрака", "I get dressed before breakfast", "I gets dressed"],
]);
extendLesson(40, [["returned", "вернулся"], ["decided", "решил"]], [
  ["Мы вернулись домой поздно", "We returned home late", "We return home tomorrow"],
]);
extendLesson(41, [["expect", "ожидать"], ["book", "бронировать"]], [
  ["Я планирую начать курс в январе", "I plan to start a course in January", "I planned yesterday"],
]);
extendLesson(42, [["better", "лучше"], ["worse", "хуже"]], [
  ["Этот район безопаснее ночью", "This area is safer at night", "This area is safest than"],
]);
extendLesson(43, [["several", "несколько"], ["plenty of", "много"]], [
  ["У нас достаточно места в машине", "We have plenty of room in the car", "We has many rooms"],
]);
extendLesson(44, [["underground", "метро"], ["entrance", "вход"]], [
  ["Вход находится рядом с платформой", "The entrance is near the platform", "The entrance are near"],
]);
extendLesson(45, [["symptom", "симптом"], ["painkiller", "обезболивающее"]], [
  ["Это может быть симптомом простуды", "It may be a symptom of a cold", "It may is symptom"],
]);
extendLesson(46, [["dust", "вытирать пыль"], ["vacuum", "пылесосить"]], [
  ["Я пылесошу гостиную по пятницам", "I vacuum the living room on Fridays", "I vacuums living room"],
]);
extendLesson(47, [["museum", "музей"], ["mountain", "гора"]], [
  ["Я уже посетил этот музей", "I have already visited this museum", "I already visit yesterday"],
]);
extendLesson(48, [["busy", "занятый"], ["weekend", "выходные"]], [
  ["К сожалению, я занят в воскресенье", "Unfortunately, I'm busy on Sunday", "Unfortunately I busy"],
]);
extendLesson(49, [["bin", "контейнер"], ["environment", "окружающая среда"]], [
  ["Мы сортируем отходы дома", "We sort our waste at home", "We sorts waste"],
]);
extendLesson(50, [["pronunciation", "произношение"], ["vocabulary", "словарный запас"]], [
  ["Я стараюсь запоминать новые слова", "I try to remember new words", "I tries remember"],
]);


 // Context coverage: use remaining key words in natural A1/A2 examples.
extendLesson(2, [], [
  ["У меня восемь карандашей", "I have eight pencils", "I has eight pencils"],
  ["Число девять", "The number is nine", "The number are nine"],
]);
extendLesson(3, [], [
  ["Я ем банан", "I eat a banana", "I eats a banana"],
  ["Она ест рис и яйцо", "She eats rice and an egg", "She eat rice and egg"],
]);
extendLesson(4, [], [
  ["Стул на кухне", "The chair is in the kitchen", "The chair are kitchen"],
  ["Ванная рядом с кухней", "The bathroom is next to the kitchen", "The bathroom are next kitchen"],
]);
extendLesson(5, [], [
  ["У меня оранжевая чашка", "I have an orange cup", "I has an orange cup"],
  ["Её любимый цвет — розовый", "Her favourite colour is pink", "Her favourite colour are pink"],
  ["Мой свитер коричневый", "My sweater is brown", "My sweater are brown"],
  ["Мой кот серый", "My cat is grey", "My cat are grey"],
]);
extendLesson(25, [], [
  ["Я обычно иду на работу в восемь", "I usually go to work at eight", "I usually goes to work"],
  ["Я читаю перед сном", "I read before bed", "I reads before bed"],
]);
extendLesson(26, [], [
  ["Моя книга на парте", "My book is on the desk", "My book are on desk"],
  ["Я делаю домашнее задание после школы", "I do my homework after school", "I does my homework"],
]);
extendLesson(27, [], [
  ["У меня две руки", "I have two arms", "I has two arms"],
  ["У меня болят уши", "My ears hurt", "My ears hurts"],
]);
extendLesson(28, [], [
  ["На ферме есть корова", "There is a cow on the farm", "There are a cow"],
  ["Мышь маленькая", "The mouse is small", "The mouse are small"],
]);
extendLesson(29, [], [
  ["Я хочу пить воду", "I want some water", "I wants some water"],
  ["Картофель горячий", "The potato is hot", "The potato are hot"],
]);
extendLesson(30, [], [
  ["Магазин на этой улице", "The shop is on this street", "The shop are street"],
  ["Парк рядом с кафе", "The park is near the cafe", "The park are near cafe"],
]);
extendLesson(31, [], [
  ["Автобусная остановка рядом с домом", "The bus stop is near my house", "The bus stop are near"],
  ["Этот поезд быстрый", "This train is fast", "This train are fast"],
]);
extendLesson(32, [], [
  ["Трава зелёная после дождя", "The grass is green after the rain", "The grass are green"],
  ["Летом мы купаемся в море", "We swim in the sea in summer", "We swims in sea"],
  ["Гора высокая", "The mountain is high", "The mountain are high"],
]);
extendLesson(33, [], [
  ["Я бегаю в парке по выходным", "I run in the park at weekends", "I runs in the park"],
]);
extendLesson(34, [], [
  ["Мои наручные часы новые", "My watch is new", "My watch are new"],
  ["Где мой кошелёк?", "Where is my wallet?", "Where are my wallet?"],
  ["Мой компьютер на столе", "My computer is on the desk", "My computer are desk"],
  ["У меня есть бутылка воды", "I have a bottle of water", "I has bottle water"],
  ["Я ношу очки", "I wear glasses", "I wears glasses"],
]);
extendLesson(35, [], [
  ["Сегодня воскресенье", "Today is Sunday", "Today are Sunday"],
  ["В субботу у меня выходной", "I have a day off on Saturday", "I has day off"],
]);
extendLesson(36, [], [
  ["Это красивый цветок", "This is a beautiful flower", "This are beautiful flower"],
  ["Дерево высокое", "The tree is tall", "The tree are tall"],
  ["Я сегодня устал", "I am tired today", "I is tired today"],
]);
extendLesson(37, [], [
  ["Я хожу в школу пешком", "I walk to school", "I walks to school"],
  ["Мы бегаем в парке", "We run in the park", "We runs in the park"],
]);
extendLesson(38, [], [
  ["Моя рубашка белая", "My shirt is white", "My shirt are white"],
  ["Её платье красивое", "Her dress is beautiful", "Her dress are beautiful"],
  ["Надень перчатки", "Put on your gloves", "Puts on your gloves"],
]);
extendLesson(6, [], [
  ["На этой улице оживлённое движение", "Traffic is heavy on this street", "There are a lot traffic"],
]);
extendLesson(7, [], [
  ["Могу я получить возврат денег?", "Can I get a refund?", "Can I gets a refund?"],
]);
extendLesson(41, [], [
  ["Мы ожидаем подтверждение бронирования", "We expect a booking confirmation", "We expects a booking"],
]);
extendLesson(42, [], [
  ["Этот отель лучше предыдущего", "This hotel is better than the previous one", "This hotel is good than"],
]);
extendLesson(43, [], [
  ["Я купил несколько яблок", "I bought several apples", "I buy several apples tomorrow"],
]);
extendLesson(44, [], [
  ["Давай поедем на метро", "Let's take the underground", "Let's takes the underground"],
]);
extendLesson(45, [], [
  ["Прими обезболивающее, если боль не проходит", "Take a painkiller if the pain doesn't go away", "Takes a painkiller"],
]);
extendLesson(46, [], [
  ["Я вытираю пыль с полок каждую субботу", "I dust the shelves every Saturday", "I dusts the shelves"],
]);
extendLesson(47, [], [
  ["Прошлым летом мы поднялись на гору", "We climbed a mountain last summer", "We climb a mountain tomorrow"],
]);
extendLesson(49, [], [
  ["Положи пластик в контейнер для переработки", "Put the plastic in the recycling bin", "Puts plastic in bin"],
  ["Нам следует защищать окружающую среду", "We should protect the environment", "We should protects environment"],
]);
extendLesson(50, [], [
  ["Я тренирую произношение каждый день", "I practise my pronunciation every day", "I practises pronunciation"],
  ["Мой словарный запас растёт", "My vocabulary is growing", "My vocabulary are growing"],
]);
extendLesson(52, [], [
  ["Я потерял ключи", "I lost my keys", "I lose my keys tomorrow"],
]);

export const LV: Record<Level, LevelDef> = {
  A1: { s: [
    { n: "Знакомство", l: [0, 1, 2] },
    { n: "Повседневная жизнь", l: [3, 4, 5] },
    { n: "Люди и школа", l: [24, 25, 26] },
    { n: "Тело и окружающий мир", l: [27, 28, 29] },
    { n: "Город и транспорт", l: [30, 31, 32] },
    { n: "Досуг и повседневность", l: [33, 34, 35] },
    { n: "Время и практика", l: [36, 37, 38] },
  ] },
  A2: { s: [
    { n: "Город и быт", l: [6, 7, 8] },
    { n: "Повседневное общение", l: [15, 16, 17] },
    { n: "Привычки и прошлое", l: [39, 40, 41] },
    { n: "Сравнения и покупки", l: [42, 43, 44] },
    { n: "Путешествия и здоровье", l: [45, 46, 47] },
    { n: "Общение и окружающий мир", l: [48, 49, 50] },
    { n: "Работа, общение и самостоятельность", l: [51, 52, 53] },
  ] },
  B1: { s: [{ n: "Работа и поездки", l: [9, 10, 11] }, { n: "Жизнь и технологии", l: [18, 19, 20] }] },
  B2: { s: [{ n: "Мнения и общество", l: [12, 13, 14] }, { n: "Культура и карьера", l: [21, 22, 23] }] },
};

export const LVS: Level[] = ["A1", "A2", "B1", "B2"];
export const nextLevel = (l: Level): Level | undefined => LVS[LVS.indexOf(l) + 1];

export const LI: Record<Level, [string, string]> = {
  A1: ["Начальный", "Знаю базовые слова и фразы"],
  A2: ["Элементарный", "Могу говорить на простые темы"],
  B1: ["Средний", "Поддерживаю беседу на знакомые темы"],
  B2: ["Выше среднего", "Свободно общаюсь и читаю сложные тексты"],
};

export const TQ: [number, string, string[], number][] = [
  [0, "I ___ a student.", ["am", "is", "are", "be"], 0],
  [0, "Как переводится слово «apple»?", ["яблоко", "груша", "стол", "дом"], 0],
  [0, "She ___ coffee every day.", ["like", "likes", "liking", "to like"], 1],
  [1, "Yesterday I ___ to the park.", ["go", "goes", "went", "gone"], 2],
  [1, "This bag is ___ than that one.", ["cheap", "cheaper", "cheapest", "more cheap"], 1],
  [1, "There isn't ___ milk in the fridge.", ["any", "many", "a", "few"], 0],
  [2, "If it rains tomorrow, we ___ at home.", ["stay", "will stay", "would stay", "stayed"], 1],
  [2, "I have been working here ___ five years.", ["since", "for", "from", "during"], 1],
  [2, "The report ___ by the manager yesterday.", ["wrote", "was written", "is writing", "has wrote"], 1],
  [3, "If I ___ more time, I would learn Spanish.", ["have", "had", "will have", "would have"], 1],
  [3, "She suggested ___ the meeting.", ["to postpone", "postponing", "postpone", "postponed"], 1],
  [3, "Hardly ___ the office when it started to rain.", ["I had left", "had I left", "I left", "did I left"], 1],
];

// Keep learner-facing examples consistently punctuated in both app runtimes.
const sentenceMark = (ru: string): string => {
  const last = ru.trimEnd().slice(-1);
  return /[.!?…]/.test(last) ? last : ".";
};
for (const lesson of D) {
  lesson.s = lesson.s.map(([ru, en, distractors]) => {
    const mark = sentenceMark(ru);
    return [/[.!?…]$/.test(ru.trim()) ? ru : ru + mark, /[.!?…]$/.test(en.trim()) ? en : en + mark, distractors];
  });
}

export const LG: [string, number][] = [["Бронза", 0], ["Серебро", 200], ["Золото", 600], ["Сапфир", 1500], ["Бриллиант", 3000]];
export const LC = ["#cd7f32", "#c0c8d8", "#ffd35a", "#4db3ff", "#b9f2ff"];

export const ruOf = (en: string) => D.flatMap((l) => l.w).find((x) => x[0] === en)?.[1] ?? "";
export const levelPool = (lv: Level) => LV[lv].s.flatMap((section) => section.l).flatMap((index) => D[index]?.w ?? []);
export const levelLessons = (lv: Level) => LV[lv].s.flatMap((x) => x.l);
