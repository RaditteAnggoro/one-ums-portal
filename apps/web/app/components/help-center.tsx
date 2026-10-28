"use client";
import { useEffect, useState } from "react";
import { BookOpen, Search, ArrowRight, Info, CheckCircle2 } from "lucide-react";
import { guideArticles } from "../../../../packages/domain/src/manual";
import { useLanguage, t as tr } from "./i18n";
type Row = Record<string, any>;
export function HelpCenter({
  user,
  navigate,
}: {
  user: Row;
  navigate: (key: string) => void;
}) {
  const { locale } = useLanguage();
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState("start");
  const allowed = guideArticles.filter(
    (article) =>
      (!article.platform || user.platform_admin) &&
      (!article.permission || user.permissions.includes(article.permission)),
  );
  const matches = allowed.filter((article) =>
    JSON.stringify([article.idText, article.enText])
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  useEffect(() => {
    const topic = new URLSearchParams(window.location.search).get("topic");
    if (topic && allowed.some((a) => a.id === topic)) setSelected(topic);
  }, []);
  const article = allowed.find((a) => a.id === selected) ?? allowed[0],
    text = locale === "en" ? article.enText : article.idText;
  return (
    <div className="help-center">
      <aside className="panel guide-index">
        <div className="panel-heading">
          <h3>
            <BookOpen size={17} />
            {tr("Panduan pengguna")}
          </h3>
        </div>
        <label className="search guide-search">
          <Search size={16} />
          <input
            aria-label={tr("Cari panduan")}
            placeholder={tr("Cari menu atau use case…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <nav aria-label={tr("Topik panduan")}>
          {matches.map((item) => (
            <button
              key={item.id}
              aria-current={selected === item.id ? "page" : undefined}
              onClick={() => {
                setSelected(item.id);
                window.history.replaceState(null, "", `/help?topic=${item.id}`);
              }}
            >
              {locale === "en" ? item.enText.title : item.idText.title}
            </button>
          ))}
          {!matches.length && <p>{tr("Tidak ada panduan yang cocok.")}</p>}
        </nav>
      </aside>
      <article className="panel guide-article">
        <div className="guide-article-heading">
          <span className="eyebrow">ONE UMS · {tr("Panduan pengguna")}</span>
          <h2>{text.title}</h2>
          <p>{text.summary}</p>
        </div>
        <ol className="guide-steps">
          {text.steps.map((step, i) => (
            <li key={i}>
              <span>{i + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
        <div className="info-callout">
          <Info size={20} />
          <p>{text.note}</p>
        </div>
        {article.menu !== "help" && (
          <button className="primary" onClick={() => navigate(article.menu)}>
            {tr("Buka menu")}
            <ArrowRight size={16} />
          </button>
        )}
        <div className="guide-footer">
          <CheckCircle2 size={15} />
          {tr(
            "Panduan mengikuti fitur yang sudah tersedia dan menjelaskan batasannya.",
          )}
        </div>
      </article>
    </div>
  );
}
