// Teksty przewodników po polsku. Budowa taka sama jak w guide-ru.js.
window.KV_GUIDE_PL = {

  manager: {
    title: 'Przewodnik menedżera',
    sub: 'Zamówienia, rezerwacje i towar: wszystko, czego trzeba na zmianie',
    sections: [
      { id: 'start', h2: 'Od czego zacząć', lead: 'Logowanie i co widać na stronie głównej.',
        blocks: [
          ['p', 'Panel otwiera się z linku od właściciela albo przyciskiem w bocie: napisz do niego «/admin».'],
          ['p', 'Zalogować się można na dwa sposoby: loginem i hasłem sklepu albo przez Telegram. Jeśli dostęp przyznano na twój Telegram, przycisk logowania pojawi się sam.'],
          ['p', 'U góry zawsze widać liczby dnia: nowe zamówienia, wszystkie zamówienia, aktywne rezerwacje, ile osób czeka na dostawę, ilu jest klientów i opinii. Liczba się podświetla, gdy jest tam coś do zrobienia.'],
          ['note', 'tip', 'Pracujesz tylko ze swoim miastem.', 'Cudze zamówienia, rezerwacje i towary po prostu nie są ci pokazywane, a bot pisze tylko o twoim mieście. Przełącznika miast nie masz i tak ma być.'],
          ['p', 'Sekcji o pieniądzach, magazynie i procentach też nie masz. Widzi je tylko właściciel.']
        ] },

      { id: 'orders', h2: 'Zamówienia', lead: 'Główna sekcja. Trafia tu wszystko, co ktoś zamówił w sklepie.',
        blocks: [
          ['p', 'Zamówienie przechodzi przez kilka stanów. Zmieniaj je listą w wierszu zamówienia: klient od razu dostaje wiadomość na Telegramie, osobno pisać nie trzeba.'],
          ['table', ['Stan', 'Kiedy ustawiać', 'Co dostanie klient'], [
            ['nowe', 'Ustawia się samo, gdy ktoś złoży zamówienie', '«Zamówienie przyjęte»'],
            ['w realizacji', 'Towar jest, wziąłeś zamówienie do pracy', '«Kompletujemy, damy znać, kiedy odebrać»'],
            ['skompletowane', 'Zamówienie spakowane i czeka', 'Nic, to znacznik dla ciebie'],
            ['wysłane', 'Tylko przy dostawie: paczka poszła', '«Zamówienie w drodze»'],
            ['wydane', 'Klient odebrał zamówienie i pieniądze są', 'Podziękowanie i przycisk «Zostaw opinię»'],
            ['anulowane', 'Klient zmienił zdanie albo towaru nie ma', '«Zamówienie anulowane, skontaktuj się z menedżerem»']
          ]],
          ['p', 'Pomyliłeś się — cofnij stan, to dozwolone. Odmowa jest osobnym czerwonym przyciskiem: pyta o powód, a bez powodu anulować się nie da.'],
          ['note', 'warn', '«Wydane» zdejmuje towar z magazynu.', 'Ustawiaj je, gdy klient naprawdę odebrał zamówienie. Ustawisz wcześniej — z witryny zniknie towar, który wciąż u ciebie leży.'],
          ['p', 'Jeśli zamówienie wisi jako nowe dłużej niż godzinę, obok numeru zapala się, ile już czeka. To podpowiedź dla ciebie, klient jej nie widzi.'],
          ['h3', 'Co jest w zamówieniu'],
          ['p', 'Skład ze smakami i ilością, kwota, sposób odbioru, komentarz i kontakt do klienta. Jeśli użyto kodu rabatowego, pod kwotą napisano jaki i o ile obniżył cenę.'],
          ['note', 'warn', 'Najpierw spójrz na płatność, potem wydaj towar.', 'Napisano «płatność przy odbiorze» — bierzesz pieniądze na miejscu. Napisano «opłacone» — pieniądze są już w sklepie, drugi raz brać nie trzeba.']
        ] },

      { id: 'res', h2: 'Rezerwacje', lead: 'Klient odłożył towar i po niego przyjdzie.',
        blocks: [
          ['ul', [
            'Rezerwacja: towar odłożony na konkretny dzień i godzinę. Z witryny znika od razu, żeby nie sprzedać go dwa razy.',
            'Czeka na dostawę: towaru nie ma, klient prosi o wiadomość, gdy się pojawi. Taka prośba nie ma daty.'
          ]],
          ['p', 'Odebrał — naciśnij «Wydana». Nie przyszedł albo zmienił zdanie — «Anuluj», a towar sam wróci na witrynę.'],
          ['note', 'tip', 'Przypomnienia przychodzą same.', 'Rano w dniu odbioru klient dostaje przypomnienie, a do ciebie przychodzi wiadomość na godzinę przed umówionym czasem. Przeterminowaną rezerwację bot zamyka sam, towar wraca.'],
          ['p', 'Więcej niż trzy rezerwacje na osobę system nie pozwala. Kto trzy razy w miesiącu nie odebrał rezerwacji, chwilowo nie może rezerwować. Działa to samo z siebie.']
        ] },

      { id: 'products', h2: 'Asortyment', lead: 'Ceny, stany i smaki twojego miasta.',
        blocks: [
          ['p', 'Towary zebrane są po modelach, w każdym wiersze smaków ze stanami. Poprawiaj wprost w polach. Zmienione się podświetla, a na dole pojawia się przycisk «Zastosuj». Dopóki go nie naciśniesz, nic nie jest zapisane, a przeglądarka ostrzeże przy próbie zamknięcia karty.'],
          ['p', 'Wyszukiwanie u góry chowa zbędne karty na miejscu i nie kasuje tego, co już zacząłeś poprawiać.'],
          ['h3', 'Ceny za trzy, pięć i dziesięć sztuk'],
          ['p', 'Obok zwykłej ceny są trzy pola. To cena za jedną sztukę, gdy klient bierze tyle samo albo więcej. Wypełniać wszystkich trzech nie trzeba: puste pole znaczy, że takiej ceny nie ma.'],
          ['note', 'tip', 'Cena hurtowa liczy się po modelu, nie po smaku.', 'Trzy truskawki, dwa mango i pięć coli to dziesięć sztuk jednego modelu i cały koszyk pójdzie po cenie dziesiątki. Różne modele się nie sumują.'],
          ['h3', 'Smaki'],
          ['p', 'Przycisk «Dodaj smak» tworzy nowy wiersz przy tym samym modelu. Nowy smak bierze cenę i etykiety towaru. Usunąć można pojedynczy smak albo cały towar.'],
          ['p', 'Przycisk «Ustaw» przy smaku rozwija jego kartę: kolor, profil smaku i opis. Cyfra na przycisku mówi, ile z trzech jest już wypełnione. Ustawienia są wspólne dla wszystkich miast: smak wszędzie jest ten sam, różni się tylko stan na półce. Kolor bierze się z palety albo wpisuje kodem w rodzaju #FF5F7D, drugi koniec gradientu liczy się sam. Profil to trzy paski, które klient widzi jako skalę do dziesięciu. Opis pisze się w trzech językach osobnymi zakładkami, pusty język podstawi rosyjski. Każde puste pole znaczy «jak wcześniej»: sklep dobierze kolor i tekst wg nazwy smaku.'],
          ['note', 'warn', 'Stan to jest to, co naprawdę leży na półce.', 'Witryna pokazuje te liczby od razu. Wpiszesz zero — towar idzie do «brak w magazynie», a u klienta pojawia się przycisk «powiadom o dostawie». Wpiszesz od jednego do trzech — zapala się «zostało mało».'],
          ['h3', 'Odpisanie'],
          ['p', 'Przycisk «Odpisz» zdejmuje towar z półki bez sprzedaży: wada, zniszczenie, niedobór albo wzięliśmy sobie. Zapyta o ilość i powód.'],
          ['note', '', '', 'Odpisanie trafia do raportu właściciela osobnym wierszem. Dlatego nie naginaj nim stanu «żeby się zgadzało»: jeśli towaru po prostu jest mniej, popraw liczbę w polu, a odpisanie zostaw na prawdziwą wadę.']
        ] },

      { id: 'labels', h2: 'Etykiety towaru', lead: 'Jak wyróżnić towar w katalogu.',
        blocks: [
          ['p', 'W wierszu towaru, po prawej od pól z cenami, są trzy pola wyboru. Zaznacz potrzebne i naciśnij «Zastosuj». Można zaznaczyć kilka naraz.'],
          ['table', ['Etykieta', 'Co robi'], [
            ['Hit', 'Towar staje pierwszy w katalogu: i na stronie, i w aplikacji, i w wyszukiwaniu'],
            ['Unikalny', 'Oznacza to, czego nie mają inni. Kolejności w katalogu nie zmienia'],
            ['Czekamy na dostawę', 'Towaru teraz nie ma, ale jedzie. Klient widzi, że za wcześnie go skreślać']
          ]],
          ['note', '', '', 'Towar, którego nie ma w magazynie, nie idzie na górę, nawet z etykietą. Najpierw uzupełnij stan.'],
          ['p', 'Etykiety «zostało mało» ustawiać nie trzeba: pojawia się sama przy trzech sztukach i znika, gdy magazyn się uzupełni.']
        ] },

      { id: 'promo', h2: 'Kody rabatowe', lead: 'Rabat, który klient wpisuje w koszyku.',
        blocks: [
          ['p', 'Kod tworzy się formularzem na dole sekcji. Co znaczą pola:'],
          ['table', ['Pole', 'Co znaczy'], [
            ['Kod', 'Litery łacińskie i cyfry, od 3 do 24 znaków. Wielkie i małe litery liczą się jako różne'],
            ['Rodzaj i wielkość', 'Procent od kwoty towarów albo rabat w złotych'],
            ['Miasto', 'Puste — działa wszędzie, inaczej tylko w wybranym mieście'],
            ['Kategoria', 'Puste — na cały asortyment, inaczej tylko gdy w koszyku jest ta kategoria'],
            ['Kwota minimalna', 'Poniżej tej kwoty kod nie zadziała'],
            ['Ile razy łącznie', 'Puste — bez ograniczeń'],
            ['Razy na osobę', 'Zwykle jeden. Liczy się po koncie klienta'],
            ['Działa od i do', 'Kod można utworzyć wcześniej, włączy się sam']
          ]],
          ['p', 'Procent liczy się od kwoty towarów, dostawa nie wchodzi do rabatu, a rabat nie może przekroczyć samego koszyka. Kod można chwilowo wyłączyć bez usuwania.'],
          ['note', 'bad', 'Rabat liczy sklep, a nie przeglądarka klienta.', 'Zgadnąć cudzego kodu ani podkręcić procentu po swojej stronie się nie da. Dlatego lista kodów jest widoczna tylko w panelu.']
        ] },

      { id: 'broadcast', h2: 'Wysyłka', lead: 'Wiadomość do wszystkich, którzy uruchomili bota.',
        blocks: [
          ['steps', [
            'Napisz tekst.',
            'Wybierz miasto. Dostępne masz tylko swoje.',
            'Jeśli chcesz, dołącz zdjęcie, zmniejszy się samo.',
            'Naciśnij wysyłkę: na przycisku napisano, do ilu osób pójdzie wiadomość.'
          ]],
          ['p', 'Wysyłka staje w kolejce, bot rozbiera ją mniej więcej w minutę. Wynik pojawi się sam: ile doszło i ile nie.'],
          ['note', 'warn', 'Wysłanego nie da się cofnąć.', 'Przeczytaj tekst przed naciśnięciem. Kto zablokował bota, trafi do «nie doszło», to normalne.'],
          ['p', 'Kto bota nie uruchamiał, wysyłki nie dostanie. Pisać na prywatne ręcznie panel nie umie.']
        ] },

      { id: 'tasks', h2: 'Przypomnienia', lead: 'Żeby nie trzymać w głowie.',
        blocks: [
          ['p', 'Formularz na dole sekcji tworzy zadanie: co zrobić, którego i o której, dla jakiego miasta i, jeśli trzeba, do jakiego zamówienia. Gdy przyjdzie termin, bot napisze o tym na Telegramie.'],
          ['p', 'Przełącznik u góry pokazuje otwarte albo już zrobione. Przeterminowane są podświetlone, a obok pozycji w menu świeci licznik, dopóki są niezamknięte.'],
          ['note', 'tip', 'Rodzaj potrzebny jest tylko do podpisu.', '«Zadzwonić», «dopytać o adres», «odezwać się ponownie» i «inne» zachowują się tak samo. Różnica jest tylko w tym, jak zadanie wygląda na liście.']
        ] },

      { id: 'customers', h2: 'Klienci', lead: 'Kto u ciebie kupuje.',
        blocks: [
          ['p', 'Karta tworzy się sama dla każdego, kto zamawiał, rezerwował, zakładał konto albo pisał do bota. Widać kontakt, ile zamówień i na jaką kwotę oraz całą historię.'],
          ['p', 'Do karty można dodać notatkę i etykietę, na przykład «stały». Notatkę widzisz ty i właściciel, innym menedżerom nie jest pokazywana.'],
          ['note', 'warn', 'Czarna lista.', 'Tak oznaczona osoba nie złoży już zamówienia ani rezerwacji. Zdjęcie oznaczenia też trzeba zrobić ręcznie.'],
          ['p', 'Przycisk «Usuń klienta» kasuje kartę i notatki. Zamówienia zostają w historii sklepu, a karta powstanie na nowo przy kolejnym zamówieniu.'],
          ['h3', 'Popyt'],
          ['p', 'Licznik tego, co częściej otwierają i rezerwują. Przydaje się przed zakupami: jeśli pozycję często oglądają, a jej nie ma, powiedz właścicielowi.']
        ] },

      { id: 'bot', h2: 'Bot w telefonie', lead: 'Co da się zrobić bez otwierania panelu.',
        blocks: [
          ['table', ['Co napisać botowi', 'Co pokaże'], [
            ['/orders', 'Aktywne zamówienia listą, kartę i przyciski stanów'],
            ['/reserves', 'Aktywne rezerwacje, «wydana» i anulowanie'],
            ['/admin', 'Przycisk, który otworzy panel']
          ]],
          ['p', 'Bot sam pisze o każdym nowym zamówieniu w twoim mieście i przypomina o rezerwacji na godzinę wcześniej. Asortymentu z bota się nie poprawia, tylko przez panel.']
        ] },

      { id: 'trouble', h2: 'Gdy coś poszło nie tak', lead: 'Częste sytuacje i co z nimi zrobić.',
        blocks: [
          ['h3', 'Nie zapisują się zmiany w asortymencie'],
          ['p', 'Sprawdź, czy nacisnąłeś «Zastosuj» na dole ekranu. Podświetlenie wiersza znaczy «zmienione», ale jeszcze nie zapisane.'],
          ['h3', 'Etykieta zniknęła sama'],
          ['p', 'Etykieta jest przy całym towarze, a nie przy pojedynczym smaku. Jeśli smak był dodawany osobnym wierszem, etykieta mogła na niego nie przejść. Zaznacz ponownie.'],
          ['h3', 'Klient mówi, że cena w koszyku jest inna'],
          ['p', 'Witryna bierze ceny z panelu od razu, ale klient mógł mieć otwartą starą kartę. Poproś o odświeżenie strony. Jeśli dalej się nie zgadza, sprawdź ceny za trzy, pięć i dziesięć sztuk.'],
          ['h3', 'Stan nie zgadza się z półką'],
          ['p', 'Najpierw pomyśl o rezerwacjach: odłożony towar już zniknął z witryny, choć leży u ciebie. Potem sprawdź zamówienia, które dziś oznaczono jako wydane. Jeśli nadal się nie zgadza, popraw liczbę i powiedz właścicielowi.'],
          ['h3', 'Nie przychodzą wiadomości o zamówieniach'],
          ['p', 'Przychodzą tylko dla twojego miasta i tylko na ten Telegram, na który przyznano dostęp. Sprawdź, czy nie zablokowałeś bota i czy choć raz nacisnąłeś w nim «Start».'],
          ['h3', 'Panel wygląda staro'],
          ['p', 'Sam się sprawdza i raz przeładowuje, gdy wychodzi aktualizacja. Jeśli nie pomogło, odśwież stronę z czyszczeniem: na komputerze Ctrl i F5 razem, w telefonie zamknij i otwórz aplikację od nowa.'],
          ['h3', 'Właściciel mówi o sekcji, której nie mam'],
          ['p', 'Znaczy, że ta sekcja jest tylko dla niego. Pieniądze, magazyn i procenty nie są pokazywane menedżerowi. To nie awaria.']
        ] }
    ]
  },

  owner: {
    title: 'Przewodnik właściciela',
    sub: 'Pieniądze, magazyn i dostęp: to, czego nie widzą menedżerowie',
    sections: [
      { id: 'start', h2: 'Co widzisz tylko ty', lead: 'Czym twój dostęp różni się od pozostałych.',
        blocks: [
          ['p', 'Wszystko o codziennej pracy — zamówienia, rezerwacje, asortyment, kody, wysyłka, przypomnienia, klienci — jest w przewodniku menedżera. Masz do tego dostęp i dodatkowo to, co zebrano tutaj.'],
          ['table', ['Kto', 'Co może'], [
            ['Właściciel', 'Wszystko, łącznie z przyznawaniem dostępu. Widzi wszystkie miasta'],
            ['Kierownik', 'To samo, poza przyznawaniem dostępu'],
            ['Deweloper', 'To samo co kierownik plus liczby techniczne'],
            ['Menedżer', 'Tylko swoje miasto i tylko codzienna praca']
          ]],
          ['note', 'tip', 'Zamknięte naprawdę.', 'Dostaw, cen zakupu, odpisań, wydatków i procentów menedżer nie zobaczy w żaden sposób: jest to zabronione po stronie sklepu, a nie tylko schowane w menu.'],
          ['p', 'Przełącznik miast masz tylko ty. Zamówienia, stany i pieniądze są rozdzielone po miastach, więc prawie wszędzie można patrzeć albo na jedno miasto, albo na całość.']
        ] },

      { id: 'dash', h2: 'Strona główna', lead: 'Co dzieje się ze sklepem w wybranym okresie.',
        blocks: [
          ['p', 'U góry przyciski: dziś, wczoraj, tydzień, miesiąc, kwartał, rok, cały czas i własne daty. Wszystko poniżej przelicza się pod wybór. Wybór zapamiętuje się do następnego razu.'],
          ['p', 'Pierwszy wiersz odpowiada na pytanie «co teraz»: przychód za dziś, nowe zamówienia, aktywne rezerwacje i ile osób czeka na dostawę. Dalej idą grupy.'],
          ['table', ['Grupa', 'Co w niej jest'], [
            ['Pieniądze', 'Przychód, zakup sprzedanego, zysk przed i po udziale sprzedawców, wydatki, średni koszyk, suma rabatów'],
            ['Zamówienia', 'Ile było, wydano, anulowano, jaka część rezerwacji została odebrana'],
            ['Klienci', 'Nowi, kupujący, opinie i średnia ocena'],
            ['Łącznie od początku', 'Przychód za tydzień, miesiąc, rok i za cały czas. Od wybranego okresu nie zależy']
          ]],
          ['note', '', '', 'Procent obok liczby to porównanie z takim samym poprzednim okresem. Wybrałeś miesiąc — porównanie z poprzednim miesiącem. Jeśli nie ma z czym porównywać, procentu nie będzie wcale.'],
          ['p', 'Niżej chowają się zwijane sekcje: wykresy, towary, ruch towaru, klienci, menedżerowie i dziennik. Otwórz potrzebną.'],
          ['p', 'Dziennik na dole odpowiada na pytanie «kto to zrobił»: zmiana stanu zamówienia, przyjęcie towaru, odpisanie. Widać osobę, czas i co dokładnie zmieniała.']
        ] },

      { id: 'stock', h2: 'Przyjęcie towaru', lead: 'Jak towar trafia na półkę.',
        blocks: [
          ['p', 'Towar przychodzi dostawą, a nie poprawką liczby w karcie. Dopóki dostawa jest szkicem, magazyn się nie zmienia, a listę można składać choćby cały dzień. Przycisk «Zaksięguj» naraz podnosi stan i zapamiętuje, po ile ten towar wziąłeś.'],
          ['steps', [
            'Wybierz miasto, ewentualnie dostawcę, naciśnij «Utwórz szkic».',
            'Dodaj pozycje: po jednej albo od razu listą.',
            'Sprawdź kwotę końcową i naciśnij «Zaksięguj dostawę».'
          ]],
          ['h3', 'Wklej listą'],
          ['p', 'Setki wierszy po jednym wpisywać nie ma sensu. Otwórz «Wklej listą» i skopiuj tam kawałek ze swojego arkusza.'],
          ['table', ['Kolumna', 'Co wpisać'], [
            ['Towar', 'Jego krótka nazwa, jak w sekcji «Asortyment»'],
            ['Smak', 'Dokładnie jak w asortymencie. Przy towarze bez smaków kolumnę się pomija'],
            ['Sztuk', 'Liczba całkowita większa od zera'],
            ['Zakup', 'Ile zapłaciłeś za sztukę. Grosze po przecinku']
          ]],
          ['p', 'Lista z Excela albo Arkuszy Google wkleja się bez zmian. Przycisk «Rozpoznaj» porówna ją z asortymentem i pokaże wiersz po wierszu, co wyszło. Zielone się doda, czerwone nie. Na żółto oznaczono to, czego w mieście jeszcze nie ma: przejdzie, ale utworzy nową pozycję, więc sprawdź, czy to nie literówka.'],
          ['note', 'warn', 'Smak musi zgadzać się litera w literę.', '«Sour Aple» zamiast «Sour Apple» to już inny smak. Taki wiersz sklep zatrzyma i powie, jakie smaki towar ma. Jeśli smak naprawdę jest nowy, najpierw dodaj go w asortymencie.'],
          ['h3', 'Dlaczego to ważne'],
          ['p', 'Każda dostawa zapamiętuje swoją cenę zakupu. Gdy zamówienie oznacza się jako wydane, schodzi najstarsze przyjęcie. Dlatego zysk liczy się po cenie, za którą towar naprawdę kupiono, a nie po średniej.'],
          ['p', 'Zaksięgowanej dostawy nie da się zmienić. Pomyliłeś ilość — popraw stan w karcie towaru. Pomyliłeś cenę — zaksięguj kolejną, korygującą.']
        ] },

      { id: 'move', h2: 'Ruch towaru', lead: 'Przyjęcia, rozchód i stan po dniach.',
        blocks: [
          ['p', 'Każda zmiana stanu zostawia ślad z powodem: dostawa, sprzedaż, odpisanie, rezerwacja, zwrot rezerwacji albo poprawka ręczna. Z tych śladów składa się cała sekcja.'],
          ['table', ['Wskaźnik', 'Co znaczy'], [
            ['Stan teraz', 'Ile sztuk leży we wszystkich miastach w tej chwili'],
            ['Magazyn w zakupie', 'Ile ten stan cię kosztował'],
            ['Przyjęto', 'Zaksięgowane dostawy w okresie, w sztukach i pieniądzu'],
            ['Sprzedano', 'Ile poszło wydanymi zamówieniami i ile cię to kosztowało'],
            ['Odpisano', 'Wada, zniszczenie, niedobór, wzięliśmy sobie'],
            ['Poszło w rezerwacje', 'Rezerwacja zdejmuje towar z witryny, anulowanie zwraca'],
            ['Poprawek ręcznych', 'Ile razy stan zmieniano w karcie i o ile sztuk']
          ]],
          ['p', 'Wykres pokazuje, jaki stan był na koniec każdego dnia, a nie tylko dziś. Niżej ostatnie ruchy: czas, towar, miasto, powód.'],
          ['note', 'tip', 'Tu warto zajrzeć najpierw, gdy coś się nie zgadza.', 'Widać, kto i kiedy ruszał stan. Wiele poprawek ręcznych pod rząd znaczy, że ktoś nagina liczby zamiast zaksięgować dostawę albo odpisanie.']
        ] },

      { id: 'cost', h2: 'Ceny zakupu', lead: 'Bez nich zysk w raportach równa się przychodowi.',
        blocks: [
          ['p', 'Są dwie drogi i wcale sobie nie przeszkadzają.'],
          ['ul', [
            'Przez dostawę. Podstawowa. Cena przyjeżdża razem z towarem, osobno nic wypełniać nie trzeba.',
            'Polem w karcie towaru. Obok ceny sprzedaży jest «Zakup». To dla tego, co leżało na półce, zanim zaczęto prowadzić ewidencję.'
          ]],
          ['p', 'Działa tak: przy wydaniu zamówienia najpierw schodzą przyjęcia po swoich cenach, a jeśli przyjęć zabrakło, resztę liczy się po cenie z karty. Dlatego warto raz wpisać ją dla obecnych stanów, a dalej po prostu księgować dostawy.'],
          ['note', 'warn', 'Dopóki zakup nie jest wypełniony, zysk jest zawyżony.', 'Taki towar liczy się jako darmowy, a zysk zrównuje się z przychodem. Widać to na stronie głównej: wiersz o zakupie jest podejrzanie mały przy przychodzie.']
        ] },

      { id: 'finance', h2: 'Pieniądze', lead: 'Co zarobiono i co zostało.',
        blocks: [
          ['p', 'Wybierasz dwie daty i dostajesz podsumowanie: przychód, zakup sprzedanego, zysk przed udziałem sprzedawców, sam udział, wydatki, odpisania i to, co zostaje tobie. Niżej ten sam podział po miastach.'],
          ['note', 'tip', 'Przychód to wydane zamówienia.', 'Nowe, skompletowane i anulowane do niego nie wchodzą, inaczej liczba rosłaby od zamówień, których nikt jeszcze nie opłacił. Gotówka i karta liczą się razem.'],
          ['h3', 'Wydatki'],
          ['p', 'Formularz na dole: kwota, za co, data, miasto i notatka. Wydatek bez miasta liczy się jako wspólny i odejmuje się od sumy osobno, więc reklama na cały sklep nie psuje obrazu jednego punktu.'],
          ['h3', 'Jak składa się zysk'],
          ['p', 'Przychód minus zakup sprzedanego daje zysk przed potrąceniami. Z niego schodzą udział sprzedawców, wydatki i odpisania. Reszta to twój zysk w ostatniej kolumnie.']
        ] },

      { id: 'rates', h2: 'Procenty dla sprzedawców', lead: 'Ile człowiek dostaje ze sprzedaży.',
        blocks: [
          ['p', 'W karcie osoby najpierw wybierz, od czego liczyć, potem wpisz procenty.'],
          ['table', ['Od czego liczyć', 'Co to znaczy'], [
            ['Od zysku', 'Kwota zamówienia minus zakup towaru. Wydatki miasta się przy tym nie odejmują'],
            ['Od całej kwoty', 'Cała kwota zamówienia, zakup nie jest brany pod uwagę']
          ]],
          ['p', 'Procent ustawia się dla pięciu kategorii: liquidy, jednorazowe, woreczki, kartridże i vape. Obok każdej napisano, ile w niej pozycji w mieście tej osoby, żeby było widać, na co procent w ogóle wpływa.'],
          ['note', 'warn', 'Dopóki procent nie jest ustawiony, udział liczy się jako zero.', 'Zysk w raportach jest wtedy zawyżony dokładnie o to, co naprawdę oddajesz sprzedawcom. Warto to wypełnić przed pierwszą prawdziwą sprzedażą.'],
          ['h3', 'Dlaczego poprzedni procent się nie kasuje'],
          ['p', 'Nowy zaczyna działać od dzisiaj, a poprzedni zostaje w historii. Zamówienia liczą się po procencie, który obowiązywał w dniu zamówienia. Inaczej raport za poprzedni miesiąc przeliczyłby się jutro i rozjechał z tym, co już wypłacono.'],
          ['note', '', '', 'Procent jest powiązany z Telegramem. Osobie, która wchodzi loginem i hasłem, nie da się go ustawić: przyznaj jej dostęp przez Telegram.']
        ] },

      { id: 'access', h2: 'Kto wchodzi do panelu', lead: 'Sekcję widzisz tylko ty.',
        blocks: [
          ['p', 'Dostęp przyznaje się na dwa sposoby. Po loginie — jeśli osoba ma już konto z hasłem w sklepie. Przez Telegram — z wyprzedzeniem: dostęp włączy się sam, gdy osoba pierwszy raz otworzy sklep przez bota.'],
          ['p', 'Menedżerowi miasto jest obowiązkowe. Pozostali miasta nie mają, widzą wszystkie. Ponowne przyznanie tej samej osobie po prostu zmienia jej rolę i miasto.'],
          ['p', 'Przycisk «Zabierz» odbiera dostęp od razu.'],
          ['note', 'warn', 'Dostęp przyznajesz tylko ty.', 'Kierownik i deweloper tej sekcji nie widzą. Zrobiono to celowo: to jedyna rzecz, którą twoja rola różni się od kierownika.'],
          ['p', 'Wiadomości o nowych zamówieniach idą do osoby przypisanej do tego miasta. Jeśli w mieście nikt nic nie dostaje, zacznij od sprawdzenia, czy dostęp na nie przyznano.']
        ] },

      { id: 'trouble', h2: 'Gdy coś poszło nie tak', lead: 'Częste sytuacje i co z nimi zrobić.',
        blocks: [
          ['h3', 'Zysk podejrzanie równa się przychodowi'],
          ['p', 'Sprzedany towar nie ma ceny zakupu. Zajrzyj do sekcji o cenach zakupu wyżej. Wstecz to się nie przeliczy: przy wydanych zamówieniach cena zakupu jest zapisana w chwili wydania.'],
          ['h3', 'Udział sprzedawców wynosi zero'],
          ['p', 'Procent nie jest ustawiony. Sekcja «Menedżerowie», karta osoby. Poprzednie zamówienia po nowym procencie się nie przeliczą.'],
          ['h3', 'Dostawa się nie księguje, protestuje przy smaku'],
          ['p', 'W wierszu jest smak, którego ten towar w mieście nie ma: najczęściej literówka albo zbędna spacja. W komunikacie wypisano, jakie smaki są.'],
          ['h3', 'Stan rozjechał się z półką'],
          ['p', 'Otwórz «Ruch towaru» i zobacz ostatnie ruchy. Pamiętaj o rezerwacjach: odłożony towar już zniknął z witryny, choć leży na miejscu. Jeśli nie da się tego wytłumaczyć, popraw liczbę w karcie — ta poprawka też zostanie widoczna.'],
          ['h3', 'W katalogu pojawił się towar, którego nie dodawałeś'],
          ['p', 'Kiedyś zdarzało się to przez literówkę w dostawie. Teraz sklep to wyłapuje, ale stara taka pozycja mogła zostać. Znajdź ją po dziwnej nazwie i usuń.'],
          ['h3', 'Coś działa inaczej, niż tu napisano'],
          ['p', 'Napisz do dewelopera. Wszystkim, co dotyczy ustawień sklepu od środka, kopii bazy i aktualizacji, zajmuje się on.']
        ] }
    ]
  }
};
