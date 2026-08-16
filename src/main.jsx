import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Clipboard,
  Heart,
  Info,
  MapPin,
  RotateCcw,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { categoryMeta, recipes, sources } from "./recipes";
import "./styles.css";

const moods = [
  { id: "all", label: "随便来杯", doodle: "✦" },
  { id: "fruit", label: "清爽醒脑", doodle: "⌁" },
  { id: "milk", label: "奶香治愈", doodle: "◡" },
  { id: "cocoa", label: "甜酷充电", doodle: "●" },
  { id: "zero", label: "晚间 0 咖", doodle: "☾" },
];

const pickRandom = (items, currentId) => {
  const available = items.length > 1 ? items.filter((item) => item.id !== currentId) : items;
  return available[Math.floor(Math.random() * available.length)];
};

function Splash({ hiding }) {
  return (
    <div className={`splash ${hiding ? "splash--hide" : ""}`} aria-hidden="true">
      <div className="splash__stamp">喜</div>
      <p>正在摇匀今日灵感</p>
      <div className="splash__dots"><i /><i /><i /></div>
    </div>
  );
}

function App() {
  const [mood, setMood] = useState("all");
  const [recipe, setRecipe] = useState(() => pickRandom(recipes));
  const [rolling, setRolling] = useState(false);
  const [intro, setIntro] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState("");
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("heytea-saved") || "[]");
    } catch {
      return [];
    }
  });
  const toastTimer = useRef(null);

  const meta = categoryMeta[recipe.category];
  const pool = useMemo(
    () => (mood === "all" ? recipes : recipes.filter((item) => item.category === mood)),
    [mood],
  );
  const isSaved = saved.includes(recipe.id);

  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), 980);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("heytea-saved", JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") setSheet(null);
      if (event.key.toLowerCase() === "r" && !sheet) roll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const notify = (message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1900);
  };

  const roll = (nextMood = mood) => {
    if (rolling) return;
    setRolling(true);
    const nextPool = nextMood === "all" ? recipes : recipes.filter((item) => item.category === nextMood);
    window.setTimeout(() => {
      setRecipe(pickRandom(nextPool, recipe.id));
      setRolling(false);
    }, 440);
  };

  const chooseMood = (nextMood) => {
    setMood(nextMood);
    roll(nextMood);
  };

  const copyOrder = async () => {
    await navigator.clipboard.writeText(recipe.orderLine);
    notify("点单口令已复制");
  };

  const shareRecipe = async () => {
    const text = `今天喝「${recipe.name}」：${recipe.orderLine}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "喜点什么？", text });
        return;
      } catch {
        return;
      }
    }
    await navigator.clipboard.writeText(text);
    notify("今日灵感已复制");
  };

  const toggleSaved = () => {
    setSaved((items) => isSaved ? items.filter((id) => id !== recipe.id) : [...items, recipe.id]);
    notify(isSaved ? "已从小本本移除" : "已经记进小本本");
  };

  return (
    <div className="app" style={{ "--accent": meta.color, "--accent-ink": meta.ink }}>
      {intro && <Splash hiding={!intro} />}
      <header className="topbar">
        <a className="brand" href="#top" aria-label="回到顶部">
          <span className="brand__seal">喜</span>
          <span><b>喜点什么？</b><small>随机搭配研究所</small></span>
        </a>
        <div className="topbar__actions">
          <button className="text-button" onClick={() => setSheet("saved")}>
            <Heart size={17} fill={saved.length ? "currentColor" : "none"} />
            <span>小本本</span>
            {saved.length > 0 && <em>{saved.length}</em>}
          </button>
          <button className="round-button" onClick={() => setSheet("sources")} aria-label="资料说明">
            <Info size={19} />
          </button>
        </div>
      </header>

      <main id="top">
        <section className="intro-copy">
          <span className="eyebrow"><Sparkles size={15} /> HEYTEA DIY LUCKY MIX</span>
          <h1>今天的喜茶，<em>交给灵感。</em></h1>
          <p>摇一杯公开菜单可复刻的搭配，带着口令去小程序下单。</p>
        </section>

        <nav className="mood-strip" aria-label="选择此刻心情">
          {moods.map((item) => (
            <button
              key={item.id}
              className={mood === item.id ? "active" : ""}
              onClick={() => chooseMood(item.id)}
            >
              <span>{item.doodle}</span>{item.label}
            </button>
          ))}
        </nav>

        <section className={`result ${rolling ? "result--rolling" : ""}`} aria-live="polite">
          <div className="result__visual">
            <div className="sunburst" aria-hidden="true" />
            <div className="scribble scribble--one" aria-hidden="true">好喝!</div>
            <div className="scribble scribble--two" aria-hidden="true">今日签</div>
            <div className="category-stamp">
              <span>{meta.short}</span>
              <small>{meta.name}</small>
            </div>
            <div className="drink-stage" key={recipe.id}>
              <span className="drink-stage__blob" />
              <img src={meta.image} alt={`${meta.name}手绘饮品插画`} />
              <i className="spark spark--a">✦</i>
              <i className="spark spark--b">✧</i>
              <i className="spark spark--c">·</i>
            </div>
            <div className="visual-caption">
              <span>NO. {String(recipes.findIndex((item) => item.id === recipe.id) + 1).padStart(2, "0")}</span>
              <p>{meta.note}</p>
            </div>
          </div>

          <article className="recipe-card">
            <div className="recipe-card__tape" aria-hidden="true" />
            <div className="recipe-card__head">
              <span className={`source-badge source-badge--${recipe.sourceTone}`}>{recipe.source}</span>
              <div className="card-tools">
                <button onClick={toggleSaved} aria-label={isSaved ? "取消收藏" : "收藏配方"}>
                  <Heart size={19} fill={isSaved ? "currentColor" : "none"} />
                </button>
                <button onClick={shareRecipe} aria-label="分享配方"><Share2 size={18} /></button>
              </div>
            </div>
            <p className="recipe-card__label">你的今日特调</p>
            <h2>{recipe.name}</h2>
            <p className="recipe-card__summary">{recipe.summary}</p>

            <div className="taste-tags">
              {recipe.tags.map((tag) => <span key={tag}>#{tag}</span>)}
            </div>

            <div className="formula">
              <div className="formula__title"><span>搭配小票</span><small>MIX RECIPE</small></div>
              <ol>
                {recipe.layers.map((layer, index) => (
                  <li key={layer}><b>{String(index + 1).padStart(2, "0")}</b><span>{layer}</span></li>
                ))}
              </ol>
              <div className="formula__footer">
                <span><small>甜度</small>{recipe.sweetness}</span>
                <i />
                <span><small>温度</small>{recipe.temperature}</span>
              </div>
            </div>

            <div className="tip"><Sparkles size={16} /><span>{recipe.tip}</span></div>
            <div className="main-actions">
              <button className="roll-button" onClick={() => roll()}>
                <RotateCcw size={19} />再摇一杯 <kbd>R</kbd>
              </button>
              <button className="copy-button" onClick={copyOrder} aria-label="复制点单口令"><Clipboard size={19} /></button>
            </div>
          </article>
        </section>

        <section className="menu-section">
          <div className="section-heading">
            <div><span>FIVE MOODS · FIVE CUPS</span><h2>五种心情菜单</h2></div>
            <p>喜茶 DIY 公开的五大基础方向<br />每种都画了一杯想象中的样子</p>
          </div>
          <div className="category-grid">
            {Object.entries(categoryMeta).map(([id, item], index) => (
              <button
                className={`category-card ${recipe.category === id ? "category-card--active" : ""}`}
                style={{ "--card-color": item.color, "--card-ink": item.ink }}
                key={id}
                onClick={() => chooseMood(id)}
              >
                <span className="category-card__index">0{index + 1}</span>
                <img src={item.image} alt="" />
                <span className="category-card__copy"><b>{item.name}</b><small>{item.mood}</small></span>
                <ChevronRight className="category-card__arrow" size={18} />
              </button>
            ))}
          </div>
        </section>

        <section className="howto">
          <div className="howto__intro">
            <span className="eyebrow">HOW TO ORDER</span>
            <h2>带着这张签，<br />去点一杯。</h2>
          </div>
          <ol>
            <li><b>1</b><span>打开喜茶小程序<small>进入「我的」页面</small></span></li>
            <li><b>2</b><span>找到 DIY 专属喜茶<small>选择对应饮品分类</small></span></li>
            <li><b>3</b><span>按小票逐层添加<small>门店当日可选为准</small></span></li>
          </ol>
          <button onClick={copyOrder}><Clipboard size={18} />复制今日点单口令</button>
        </section>
      </main>

      <footer>
        <div><span className="brand__seal">喜</span><b>今天就喝这一杯吧。</b></div>
        <p>非喜茶官方产品 · 仅作随机搭配灵感<br />菜单与原料会因城市、门店和时段变化</p>
        <button onClick={() => setSheet("sources")}>资料来源与说明 <ArrowUpRight size={16} /></button>
      </footer>

      {sheet && (
        <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSheet(null)}>
          <aside className="sheet" role="dialog" aria-modal="true" aria-label={sheet === "sources" ? "资料来源" : "收藏配方"}>
            <div className="sheet__handle" />
            <button className="sheet__close" onClick={() => setSheet(null)}><X size={20} /></button>
            {sheet === "sources" ? (
              <>
                <span className="eyebrow"><BookOpen size={15} /> RESEARCH NOTES</span>
                <h2>菜单从哪里来？</h2>
                <p className="sheet__lead">资料检索于 2026 年 8 月。官方 DIY 已开放五类饮品与分层原料选择；本工具把官方推荐、公开实测和实验灵感分开标记。</p>
                <div className="source-list">
                  {sources.map((source) => (
                    <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>
                      <span><b>{source.label}</b><small>{source.detail}</small></span><ArrowUpRight size={18} />
                    </a>
                  ))}
                </div>
                <div className="notice"><Info size={18} /><span>配方只使用公开出现的原料名；“灵感实验款”的同类原料不保证在所有门店被系统同时放行。</span></div>
              </>
            ) : (
              <>
                <span className="eyebrow"><Heart size={15} /> SAVED MIXES</span>
                <h2>我的搭配小本本</h2>
                {saved.length ? (
                  <div className="saved-list">
                    {saved.map((id) => {
                      const item = recipes.find((entry) => entry.id === id);
                      const itemMeta = categoryMeta[item.category];
                      return (
                        <button key={id} onClick={() => { setRecipe(item); setMood(item.category); setSheet(null); window.scrollTo({ top: 120, behavior: "smooth" }); }}>
                          <span style={{ background: itemMeta.color }}>{itemMeta.short}</span>
                          <div><b>{item.name}</b><small>{item.layers.slice(0, 3).join(" · ")}</small></div>
                          <ChevronRight size={18} />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state"><Heart size={30} /><b>本本还是空的</b><p>遇到喜欢的搭配，点一下卡片右上角的爱心。</p></div>
                )}
              </>
            )}
          </aside>
        </div>
      )}

      <div className={`toast ${toast ? "toast--show" : ""}`}><Check size={17} />{toast}</div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
