/* Cloudy English lesson catalog. Data and ordering are preserved from the legacy runtime. */
(() => {
  "use strict";
const D=[
{t:"Привет",w:[["hello","привет"],["goodbye","пока"],["thanks","спасибо"],["please","пожалуйста"],["yes","да"],["no","нет"]],s:[["Привет, меня зовут Анна","Hello my name is Anna","you the"],["Да, пожалуйста","Yes please","no thanks"]]},
{t:"Семья",w:[["mother","мама"],["father","папа"],["brother","брат"],["sister","сестра"],["son","сын"],["daughter","дочь"]],s:[["У меня есть брат","I have a brother","sister the"],["Это моя мама","This is my mother","father your"]]},
{t:"Числа",w:[["one","один"],["two","два"],["three","три"],["four","четыре"],["five","пять"],["six","шесть"]],s:[["Это число шесть","This is number six","four the"],["У меня три книги","I have three books","two a"]]},
{t:"Еда",w:[["apple","яблоко"],["water","вода"],["bread","хлеб"],["milk","молоко"],["coffee","кофе"],["cheese","сыр"]],s:[["Я люблю кофе","I like coffee","water the"],["Мне нужна вода","I need water","bread a"]]},
{t:"Дом",w:[["house","дом"],["door","дверь"],["window","окно"],["table","стол"],["bed","кровать"],["book","книга"]],s:[["Это мой дом","This is my house","your a"],["У меня есть книга","I have a book","table the"]]},
{t:"Цвета",w:[["red","красный"],["blue","синий"],["green","зелёный"],["yellow","жёлтый"],["black","чёрный"],["white","белый"]],s:[["Это красное яблоко","This is a red apple","blue the"],["Небо синее","The sky is blue","red green"]]}
];
D.push(
{t:"Город",w:[["bank","банк"],["street","улица"],["station","вокзал"],["market","рынок"],["park","парк"],["bridge","мост"]],s:[["Я иду в парк","I go to the park","market a"],["Где находится вокзал","Where is the station","street a"]]},
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
const ALL=D.flatMap(l=>l.w);

  window.CloudyCatalog = Object.freeze({ D, LV, ALL, P });
})();
