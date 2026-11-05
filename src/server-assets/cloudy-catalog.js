/* Cloudy English lesson catalog. Data and ordering are preserved from the legacy runtime. */
(() => {
  "use strict";
const D=[
{t:"Привет",w:[["hello","привет"],["goodbye","пока"],["thanks","спасибо"],["please","пожалуйста"],["yes","да"],["no","нет"]],s:[["Привет, меня зовут Анна","Hello, my name is Anna.","you the"],["Да, пожалуйста","Yes please","no thanks"]]},
{t:"Семья",w:[["mother","мама"],["father","папа"],["brother","брат"],["sister","сестра"],["son","сын"],["daughter","дочь"]],s:[["У меня есть брат","I have a brother","sister the"],["Это моя мама","This is my mother","father your"]]},
{t:"Числа",w:[["one","один"],["two","два"],["three","три"],["four","четыре"],["five","пять"],["six","шесть"]],s:[["Это число шесть","This number is six.","four the"],["У меня три книги","I have three books","two a"]]},
{t:"Еда",w:[["apple","яблоко"],["water","вода"],["bread","хлеб"],["milk","молоко"],["coffee","кофе"],["cheese","сыр"]],s:[["Я люблю кофе","I like coffee","water the"],["Мне нужна вода","I need water","bread a"]]},
{t:"Дом",w:[["house","дом"],["door","дверь"],["window","окно"],["table","стол"],["bed","кровать"],["book","книга"]],s:[["Это мой дом","This is my house","your a"],["У меня есть книга","I have a book","table the"]]},
{t:"Цвета",w:[["red","красный"],["blue","синий"],["green","зелёный"],["yellow","жёлтый"],["black","чёрный"],["white","белый"]],s:[["Это красное яблоко","This is a red apple","blue the"],["Небо синее","The sky is blue","red green"]]}
];
D.push(
{t:"Город",w:[["bank","банк"],["street","улица"],["station","вокзал"],["market","рынок"],["park","парк"],["bridge","мост"]],s:[["Я иду в парк","I go to the park","market a"],["Где находится вокзал","Where is the station?","street a"]]},
{t:"Покупки",w:[["cheap","дешёвый"],["expensive","дорогой"],["price","цена"],["shop","магазин"],["money","деньги"],["ticket","билет"]],s:[["Сколько это стоит","How much is it","cheap the"],["У меня нет денег","I have no money","shop a"]]},
{t:"Время",w:[["morning","утро"],["evening","вечер"],["today","сегодня"],["tomorrow","завтра"],["week","неделя"],["always","всегда"]],s:[["Увидимся завтра","See you tomorrow","today the"],["Я всегда пью кофе утром","I always drink coffee in the morning","evening a"]]},
{t:"Работа",w:[["job","работа"],["office","офис"],["meeting","встреча"],["boss","начальник"],["salary","зарплата"],["skill","навык"]],s:[["У меня завтра встреча","I have a meeting tomorrow","office the"],["Я ищу новую работу","I am looking for a new job","boss the"]]},
{t:"Поездки",w:[["journey","путешествие"],["luggage","багаж"],["passport","паспорт"],["flight","рейс"],["hotel","отель"],["reservation","бронь"]],s:[["Я забронировал отель","I booked a hotel","flight the"],["Где мой багаж","Where is my luggage","passport the"]]},
{t:"Здоровье",w:[["healthy","здоровый"],["medicine","лекарство"],["headache","головная боль"],["advice","совет"],["exercise","упражнение"],["recover","восстановиться"]],s:[["Мне нужен медицинский совет","I need medical advice","doctor the"],["Она быстро восстановилась","She recovered quickly","healthy a"]]},
{t:"Мнения",w:[["opinion","мнение"],["agree","соглашаться"],["argue","спорить"],["evidence","доказательство"],["however","однако"],["although","хотя"]],s:[["Я не согласен с вами","I disagree with you","agree the"],["Хотя было поздно, мы работали","Although it was late we worked","however the"]]},
{t:"Общество",w:[["government","правительство"],["society","общество"],["environment","окружающая среда"],["economy","экономика"],["challenge","вызов"],["achievement","достижение"]],s:[["Экономика быстро растёт","The economy is growing fast","society the"],["Это большой вызов","This is a big challenge","government a"]]},
{t:"Бизнес",w:[["deadline","срок"],["budget","бюджет"],["negotiate","вести переговоры"],["strategy","стратегия"],["profit","прибыль"],["risk","риск"]],s:[["Нам нужна новая стратегия","We need a new strategy","budget the"],["Срок уже близко","The deadline is close","risk a"]]}
);
const LV={A1:{s:[{n:"Знакомство",l:[0,1,2]},{n:"Повседневная жизнь",l:[3,4,5]}]},A2:{s:[{n:"Город и быт",l:[6,7,8]},{n:"Повседневное общение",l:[15,16,17]}]},B1:{s:[{n:"Работа и поездки",l:[9,10,11]},{n:"Жизнь и технологии",l:[18,19,20]}]},B2:{s:[{n:"Мнения и общество",l:[12,13,14]},{n:"Культура и карьера",l:[21,22,23]}]}};
const P=(t,w,s)=>({t,w:w.split(',').map(x=>x.split('=')),s:s.split(';').map(x=>x.split('='))});
D.push(
P('Ресторан','restaurant=ресторан,menu=меню,bill=счёт,waiter=официант,delicious=вкусный,hungry=голодный','Принесите счёт, пожалуйста=Bring me the bill please=menu the;Я очень голоден=I am very hungry=waiter a'),
P('Погода','weather=погода,rainy=дождливый,sunny=солнечный,cold=холодный,wind=ветер,snow=снег','Сегодня солнечно=It is sunny today=rainy the;Зимой идёт снег=It snows in winter=wind a'),
P('Одежда','jacket=куртка,shoes=обувь,dress=платье,shirt=рубашка,size=размер,wear=носить','Мне нужна куртка=I need a jacket=shoes the;Какой у вас размер=What is your size=dress a'),
P('Технологии','password=пароль,download=скачивать,screen=экран,battery=батарея,website=сайт,update=обновление','Я забыл пароль=I forgot my password=screen the;Батарея почти разряжена=The battery is almost dead=update a'),
P('Эмоции','nervous=нервный,proud=гордый,embarrassed=смущённый,disappointed=разочарованный,excited=взволнованный,jealous=завистливый','Я горжусь тобой=I am proud of you=nervous the;Она была разочарована=She was disappointed=excited a'),
P('Учёба','degree=степень,lecture=лекция,exam=экзамен,subject=предмет,scholarship=стипендия,graduate=окончить','Завтра у меня экзамен=I have an exam tomorrow=lecture the;Это мой любимый предмет=This is my favorite subject=degree a'),
P('Инновации','innovation=инновация,algorithm=алгоритм,privacy=конфиденциальность,device=устройство,breakthrough=прорыв,reliable=надёжный','Это настоящий прорыв=This is a real breakthrough=device the;Мы ценим конфиденциальность=We value privacy=algorithm a'),
P('Культура','heritage=наследие,tradition=традиция,exhibition=выставка,ancient=древний,masterpiece=шедевр,influence=влияние','Мы посетили выставку=We visited the exhibition=heritage the;Это настоящий шедевр=It is a true masterpiece=ancient a'),
P('Карьера','promotion=повышение,colleague=коллега,resign=уволиться,experience=опыт,demanding=требовательный,workload=нагрузка','Я получил повышение=I got a promotion=colleague the;У него большой опыт=He has a lot of experience=workload a')
);

// 150 curated A1 practice items: 15 new lessons × (5 vocabulary + 1 matching + 4 sentence-building).
const A1_EXTRA = [
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
        "класс"
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
        "рука"
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
        "My school is near",
        "are the"
      ],
      [
        "Больница большая",
        "The hospital is big",
        "are a"
      ],
      [
        "Я иду в библиотеку",
        "I go to the library",
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
        "Я еду на автобусе",
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
        "Она едет на велосипеде",
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
        "часы"
      ]
    ],
    "s": [
      [
        "Где мой телефон",
        "Where is my phone",
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
        "Помоги мне пожалуйста",
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
        "шапка"
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
        "Моя шапка синяя",
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
  P("Распорядок дня и привычки", "routine=распорядок,schedule=расписание,usually=обычно,rarely=редко,early=рано,late=поздно", "Я обычно просыпаюсь рано=I usually wake up early=never late;Я редко смотрю телевизор=I rarely watch TV=always the;Мой рабочий день начинается в девять=My working day starts at nine=finish yesterday"),
  P("Прошедшие выходные", "visited=посетил,bought=купил,met=встретил,spent=провёл,stayed=остался,trip=поездка", "Мы посетили музей вчера=We visited the museum yesterday=tomorrow the;Он купил новый билет=He bought a new ticket=buys tomorrow;Я встретил друга в парке=I met a friend in the park=meet the"),
  P("Планы на будущее", "plan=план,invite=приглашать,appointment=встреча,arrange=организовать,decide=решать,hope=надеяться", "Я собираюсь навестить двоюродного брата=I am going to visit my cousin=visited yesterday;Мы встречаемся с друзьями завтра=We are meeting friends tomorrow=met last week;Она надеется найти новую работу=She hopes to find a new job=found yesterday"),
  P("Сравнение мест и вещей", "crowded=переполненный,quiet=тихий,modern=современный,comfortable=удобный,safer=безопаснее,farther=дальше", "Этот район тише центра=This area is quieter than the city centre=the quietest;Это самый удобный отель=This is the most comfortable hotel=more comfortable;Мой путь короче твоего=My journey is shorter than yours=the shortest"),
  P("Количество и покупки", "a little=немного,a few=несколько,enough=достаточно,too much=слишком много,bottle=бутылка,packet=пакет", "В бутылке немного воды=There is a little water in the bottle=many bottles;Нам нужно несколько яблок=We need a few apples=any apple;У нас достаточно времени=We have enough time=too many times"),
  P("Путешествия и направления", "turn left=повернуть налево,straight ahead=прямо,across from=напротив,corner=угол,platform=платформа,return ticket=билет туда и обратно", "Поверните налево на углу=Turn left at the corner=turn right;Банк напротив вокзала=The bank is across from the station=behind the;Мне нужен билет туда и обратно=I need a return ticket=one way"),
  P("Здоровье и советы", "cough=кашель,fever=температура,sore throat=боль в горле,should=следует,rest=отдых,medical appointment=приём у врача", "Тебе следует отдохнуть=You should get some rest=shouldn't work;У него болит горло=He has a sore throat=has a headache;Мне нужно записаться к врачу=I need to make an appointment with the doctor=cancel the"),
  P("Домашние обязанности", "tidy=убирать,sweep=подметать,wash up=мыть посуду,take out the rubbish=выносить мусор,repair=чинить,have to=быть должным", "Мне нужно убрать комнату=I have to tidy my room=tidied yesterday;Ей не нужно работать в воскресенье=She doesn't have to work on Sunday=mustn't the;Пожалуйста, вынеси мусор=Please take out the rubbish=bring the"),
  P("Жизненный опыт", "ever=когда-либо,never=никогда,already=уже,yet=ещё,recently=недавно,experience=опыт", "Ты когда-нибудь был в Лондоне=Have you ever been to London=Did you ever go;Я ещё не закончил домашнюю работу=I haven't finished my homework yet=already finished;Она уже позвонила маме=She has already called her mother=will call tomorrow"),
  P("Приглашения и договорённости", "would you like=не хотел бы ты,shall we=давай,sounds great=звучит отлично,available=свободный,maybe=возможно,unfortunately=к сожалению", "Хочешь пойти в кино=Would you like to go to the cinema=Do you like cinema;Давай встретимся в шесть=Shall we meet at six=Did we meet;Это звучит отлично=That sounds great=That sound badly"),
  P("Природа и окружающая среда", "recycle=перерабатывать,pollution=загрязнение,waste=отходы,protect=защищать,save energy=экономить энергию,reduce=сокращать", "Мы должны перерабатывать бумагу=We should recycle paper=throw the;Загрязнение воздуха — серьёзная проблема=Air pollution is a serious problem=water the;Выключай свет, чтобы экономить энергию=Turn off the lights to save energy=leave everything on"),
  P("Общение и обучение", "explain=объяснять,repeat=повторять,understand=понимать,remember=помнить,forget=забывать,instruction=инструкция", "Можешь повторить вопрос=Could you repeat the question=forget the;Я не понял инструкцию=I didn't understand the instruction=remembered yesterday;Она объяснила правило ясно=She explained the rule clearly=explains unclear")
];
D.push(...A2_EXTRA);
LV.A1.s.push(
  {n:"Люди и школа",l:[24,25,26]},
  {n:"Тело и окружающий мир",l:[27,28,29]},
  {n:"Город и транспорт",l:[30,31,32]},
  {n:"Досуг и повседневность",l:[33,34,35]},
  {n:"Время и практика",l:[36,37,38]}
);
LV.A2.s.push(
  {n:"Привычки и прошлое",l:[39,40,41]},
  {n:"Сравнения и покупки",l:[42,43,44]},
  {n:"Путешествия и здоровье",l:[45,46,47]},
  {n:"Общение и окружающий мир",l:[48,49,50]}
);

const ALL=D.flatMap(l=>l.w);

  window.CloudyCatalog = Object.freeze({ D, LV, ALL, P });
})();
