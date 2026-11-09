import { useMemo } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";

const COUNTRY_CODES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ
EC EE EH ER ES ET
FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU
ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ
LA LB LC LI LK LR LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ
OM
PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA
RE RO RS RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM US UY UZ
VA VC VE VG VI VN VU
WF WS
YE YT
ZA ZM ZW
`.trim().split(/\s+/).filter((code) => code !== "RU");

const COPY = {
  back: "Юридические документы", title: "Доступность по странам",
  intro: "Сейчас сервис доступен в странах и территориях, перечисленных ниже. Если вашей страны нет в списке, доступ к обучению из неё ограничен и подключение может быть заблокировано.",
  detail: "Доступность зависит от работы технических поставщиков, местного законодательства и сетевых ограничений и может изменяться.",
  count: "стран и территорий", supportLead: "Если вы считаете, что доступность определена неверно, обратитесь в",
  support: "поддержку Cloudy English", documentTitle: "Доступность по странам — Cloudy English Academy",
  description: "Страны и территории, где доступна Cloudy English Academy.",
};

export function AvailabilityPage() {
  const copy = COPY;
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames(["ru"], { type: "region" });
    return COUNTRY_CODES.map((code) => names.of(code) ?? code).sort((a, b) => a.localeCompare(b, "ru"));
  }, []);

  return (
    <main lang="ru" className="min-h-screen px-4 pb-12 pt-[max(24px,env(safe-area-inset-top))] text-white"
      style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: "linear-gradient(165deg, #050d2b 0%, #0a2a73 48%, #3aa0ff 100%) fixed" }}>
      <div className="mx-auto max-w-3xl">
        <a href="/legal" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#91d8ff] underline-offset-4 hover:underline">
          <ArrowLeft size={16} aria-hidden="true" /> {copy.back}
        </a>
        <header className="py-7">
          <div className="flex items-center gap-3 text-[#75d5ff]">
            <ShieldCheck size={24} aria-hidden="true" />
            <span className="text-sm font-bold tracking-wide">Cloudy English Academy</span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#e8f5ff]">{copy.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c5dcf2]">{copy.intro}</p>
          <p className="mt-2 text-xs leading-5 text-[#9fc5e4]">{copy.detail}</p>
        </header>
        <section className="rounded-2xl border border-white/15 bg-[rgba(6,20,58,0.42)] p-4 shadow-[0_12px_34px_rgba(0,0,0,0.2)] sm:p-6" aria-label={copy.title}>
          <p className="mb-4 text-sm font-semibold text-[#8bdcff]">{countries.length} {copy.count}</p>
          <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            {countries.map((country) => <li key={country} className="border-b border-white/10 py-2.5 text-sm text-[#e0efff]">{country}</li>)}
          </ul>
        </section>
        <p className="mt-6 text-center text-xs leading-5 text-[#a8c9e5]">
          {copy.supportLead}{" "}
          <a href="https://t.me/cloudysupportt_bot" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#91d8ff] underline underline-offset-4">{copy.support}</a>.
        </p>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/availability")({
  staticData: { sitemap: true },
  head: () => ({ meta: [
    { title: "Доступность по странам — Cloudy English Academy" },
    { name: "description", content: "Страны и территории, где доступна Cloudy English Academy." },
    { property: "og:title", content: "Country availability — Cloudy English Academy" },
    { property: "og:description", content: "Текущая доступность Cloudy English Academy по странам." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AvailabilityPage,
});
