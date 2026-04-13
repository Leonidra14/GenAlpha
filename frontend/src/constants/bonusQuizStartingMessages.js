export const BONUS_QUIZ_STARTING_MESSAGES = [
  "Chvilku počkej! Připravuji kvíz jenom pro tebe.",
  "Píp… skládám otázky přesně podle tvého posledního pokusu.",
  "Bzzt! Ještě chvilku, ladím bonus jen pro tebe.",
  "Načítám tvoje poznámky a výsledky — hned to pošlu.",
  "Robot v pohotovosti: generuju kvíz na míru.",
  "Chvilka strpení, připravuji procvičování šité na míru.",
  "Skoro hotovo… ještě doladím poslední otázku.",
  "Píp píp! Tvůj osobní bonus se právě „peče“.",
  "Analyzuju hlavní kvíz a skládám bonus — moment prosím.",
  "Za okamžik startuješ; do té doby si dej krátkou pauzu.",
];

export function pickBonusQuizStartingMessage() {
  const list = BONUS_QUIZ_STARTING_MESSAGES;
  if (!list.length) return "";
  const i = Math.floor(Math.random() * list.length);
  return list[i] ?? "";
}
