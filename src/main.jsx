import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  Beaker,
  BookOpen,
  Check,
  ChevronRight,
  Clipboard,
  Cloud,
  CloudOff,
  Heart,
  Info,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircleHeart,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Shuffle,
  Sparkles,
  UserRound,
  Volume2,
  WandSparkles,
  X,
} from "lucide-react";
import CustomDrinkStudio from "./CustomDrinkStudio";
import {
  addFavorite,
  deleteFavorite,
  fetchFavoriteIds,
  mergeGuestFavorites,
  neonClient,
  neonConfigured,
} from "./neon";
import { authFetch, AuthRequiredError } from "./auth-fetch";
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

const GUEST_FAVORITES_KEY = "heytea-saved-guest";
const LEGACY_FAVORITES_KEY = "heytea-saved";
const RECENT_BLESSINGS_KEY = "heytea-ai-blessings";

const readGuestFavorites = () => {
  try {
    return JSON.parse(
      localStorage.getItem(GUEST_FAVORITES_KEY)
      || localStorage.getItem(LEGACY_FAVORITES_KEY)
      || "[]",
    );
  } catch {
    return [];
  }
};

const readRecentBlessings = () => {
  try {
    const values = JSON.parse(localStorage.getItem(RECENT_BLESSINGS_KEY) || "[]");
    return Array.isArray(values) ? values.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const getLocalMoment = () => {
  const now = new Date();
  return {
    localTime: new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  };
};

const friendlyAuthError = (error) => {
  const code = error?.code || "";
  if (code.includes("INVALID") || code.includes("PASSWORD")) return "邮箱或密码不正确，请再试一次。";
  if (code.includes("EXISTS")) return "这个邮箱已经注册，可以直接登录。";
  if (code.includes("RATE") || code.includes("MANY")) return "尝试次数太多，请稍后再试。";
  return error?.message || "认证没有成功，请稍后再试。";
};

function AuthPanel({ user, syncing, onAuthenticated, onSignedOut }) {
  const [mode, setMode] = useState("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!neonConfigured) {
    return (
      <div className="auth-setup">
        <div className="auth-setup__cloud"><CloudOff size={30} /></div>
        <h2>还差两根连接线</h2>
        <p>登录界面已经做好。请先在 Neon 项目中开启 Auth 与 Data API，再把两个公开 URL 放进本地环境变量。</p>
        <code>VITE_NEON_AUTH_URL</code>
        <code>VITE_NEON_DATA_API_URL</code>
        <div className="notice"><Info size={18} /><span>数据库密码只用于本地迁移的 <b>DATABASE_URL</b>，不会进入浏览器代码。</span></div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="account-panel">
        <div className="account-panel__avatar">{(user.name || user.email || "喜").slice(0, 1).toUpperCase()}</div>
        <span className="eyebrow"><Cloud size={15} /> CLOUD NOTEBOOK</span>
        <h2>{user.name || "灵感收藏家"}</h2>
        <p>{user.email}</p>
        <div className="sync-status">
          {syncing ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
          <span><b>{syncing ? "正在同步收藏" : "收藏已跟随账号保存"}</b><small>换一台设备登录，也能看到同一本小本本</small></span>
        </div>
        <button className="signout-button" onClick={async () => {
          await neonClient.auth.signOut();
          onSignedOut();
        }}><LogOut size={17} />退出登录</button>
      </div>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = mode === "sign-up"
        ? await neonClient.auth.signUp.email({ email, password, name })
        : await neonClient.auth.signIn.email({ email, password });

      if (response?.error) throw response.error;
      const current = await neonClient.auth.getSession();
      if (current.data) {
        onAuthenticated();
      } else {
        setSuccess("账号已创建，请按邮件提示完成验证后再登录。");
        setMode("sign-in");
      }
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-panel">
      <span className="eyebrow"><Cloud size={15} /> SYNC YOUR PICKS</span>
      <h2>{mode === "sign-in" ? "欢迎回来，喝点什么？" : "领一本云端小本本"}</h2>
      <p className="sheet__lead">登录后，收藏会安全地保存在你的 Neon 账号中，并自动合并这台设备上的临时收藏。</p>
      <div className="auth-tabs">
        <button className={mode === "sign-in" ? "active" : ""} onClick={() => { setMode("sign-in"); setError(""); }}>登录</button>
        <button className={mode === "sign-up" ? "active" : ""} onClick={() => { setMode("sign-up"); setError(""); }}>注册</button>
      </div>
      <form onSubmit={submit}>
        {mode === "sign-up" && (
          <label><span><UserRound size={15} />昵称</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="怎么称呼你" autoComplete="name" /></label>
        )}
        <label><span><Mail size={15} />邮箱</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
        <label><span><LockKeyhole size={15} />密码</span><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} /></label>
        {error && <p className="auth-message auth-message--error">{error}</p>}
        {success && <p className="auth-message auth-message--success">{success}</p>}
        <button className="auth-submit" disabled={loading} type="submit">
          {loading ? <LoaderCircle className="spin" size={18} /> : <Cloud size={18} />}
          {loading ? "稍等，正在确认…" : mode === "sign-in" ? "登录并同步收藏" : "创建我的小本本"}
        </button>
      </form>
      <p className="auth-fineprint">由 Neon Auth 提供账号与会话服务 · 密码不会经过本应用数据库表</p>
    </div>
  );
}

function Splash({ hiding }) {
  return (
    <div className={`splash ${hiding ? "splash--hide" : ""}`} aria-hidden="true">
      <div className="splash__stamp">喜</div>
      <p>正在摇匀今日灵感</p>
      <div className="splash__dots"><i /><i /><i /></div>
    </div>
  );
}

function App({ auth }) {
  const [mode, setMode] = useState("random");
  const [mood, setMood] = useState("all");
  const [recipe, setRecipe] = useState(() => pickRandom(recipes));
  const [rolling, setRolling] = useState(false);
  const [intro, setIntro] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState("");
  const [saved, setSaved] = useState(readGuestFavorites);
  const [syncing, setSyncing] = useState(false);
  const [moodNote, setMoodNote] = useState("");
  const [selectionPath, setSelectionPath] = useState("manual");
  const [aiBlessing, setAiBlessing] = useState({ status: "idle", text: "摇一杯，让 AI 为此刻写下一张签。" });
  const [speech, setSpeech] = useState({ status: "idle", url: "", message: "" });
  const toastTimer = useRef(null);
  const blessingController = useRef(null);
  const blessingGeneration = useRef(0);
  const speechController = useRef(null);
  const speechGeneration = useRef(0);
  const audioRef = useRef(null);
  const currentBlessing = useRef("");
  const recentBlessings = useRef(readRecentBlessings());
  const user = auth.session?.user || null;

  const meta = categoryMeta[recipe.category];
  const pool = useMemo(
    () => (mood === "all" ? recipes : recipes.filter((item) => item.category === mood)),
    [mood],
  );
  const isSaved = saved.includes(recipe.id);
  const moodNoteLength = Array.from(moodNote).length;

  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), 980);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => {
    blessingController.current?.abort();
    speechController.current?.abort();
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    if (!user && !auth.isPending) {
      localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(saved));
      localStorage.removeItem(LEGACY_FAVORITES_KEY);
    }
  }, [saved, user, auth.isPending]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") setSheet(null);
      if (event.key.toLowerCase() === "r" && !sheet && mode === "random") repeatSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    blessingGeneration.current += 1;
    blessingController.current?.abort();
    resetSpeech();
    setMode(nextMode);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getLatestSession = () => auth.qaToken
    ? Promise.resolve({ data: { session: { token: auth.qaToken } } })
    : neonClient.auth.getSession();

  const notify = (message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1900);
  };

  useEffect(() => {
    if (auth.isPending) return undefined;

    if (auth.qaToken) {
      setSyncing(false);
      return undefined;
    }

    if (!user) {
      setSaved(readGuestFavorites());
      setSyncing(false);
      return undefined;
    }

    let cancelled = false;
    const syncFavorites = async () => {
      setSyncing(true);
      const guestFavorites = readGuestFavorites();
      try {
        const remoteFavorites = guestFavorites.length
          ? await mergeGuestFavorites(guestFavorites)
          : await fetchFavoriteIds();
        if (!cancelled) {
          setSaved(remoteFavorites);
          localStorage.removeItem(GUEST_FAVORITES_KEY);
          localStorage.removeItem(LEGACY_FAVORITES_KEY);
          if (guestFavorites.length) notify("本机收藏已经合并到云端");
        }
      } catch (syncError) {
        console.error("Failed to sync Neon favorites", syncError);
        if (!cancelled) notify("云端小本本暂时连不上，请检查 Neon 配置");
      } finally {
        if (!cancelled) setSyncing(false);
      }
    };

    syncFavorites();
    return () => { cancelled = true; };
  }, [user?.id, auth.isPending]);

  const resetSpeech = () => {
    speechGeneration.current += 1;
    speechController.current?.abort();
    speechController.current = null;
    currentBlessing.current = "";
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    setSpeech({ status: "idle", url: "", message: "" });
  };

  const requestBlessing = async (nextRecipe, noteForRequest) => {
    blessingController.current?.abort();
    const controller = new AbortController();
    blessingController.current = controller;
    const generation = blessingGeneration.current + 1;
    blessingGeneration.current = generation;
    const moment = getLocalMoment();
    const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    setAiBlessing({ status: "loading", text: "正在听这一杯和此刻说话…", time: moment.localTime });

    try {
      let payload = {};
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const recentForRequest = recentBlessings.current.slice(-79);
        if (payload.blessing && !recentForRequest.includes(payload.blessing)) recentForRequest.push(payload.blessing);
        const response = await fetch("/api/blessing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipe: {
              name: nextRecipe.name,
              category: categoryMeta[nextRecipe.category]?.name,
              summary: nextRecipe.summary,
              layers: nextRecipe.layers,
            },
            ...moment,
            moodNote: noteForRequest,
            recent: recentForRequest,
            requestId: `${requestId}-${attempt}`,
          }),
          signal: controller.signal,
        });
        payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "AI 签语暂时没有摇出来");
        if (!recentBlessings.current.includes(payload.blessing)) break;
      }
      if (!payload.blessing || recentBlessings.current.includes(payload.blessing)) {
        throw new Error("这次撞签了，请再摇一次。");
      }
      if (generation !== blessingGeneration.current) return;

      const nextRecent = [...recentBlessings.current, payload.blessing];
      recentBlessings.current = nextRecent;
      localStorage.setItem(RECENT_BLESSINGS_KEY, JSON.stringify(nextRecent));
      currentBlessing.current = payload.blessing;
      setAiBlessing({
        status: "ready",
        text: payload.blessing,
        time: moment.localTime,
        speechToken: payload.speechToken || "",
      });
    } catch (error) {
      if (error.name === "AbortError" || generation !== blessingGeneration.current) return;
      console.error("Failed to generate AI blessing", error);
      setAiBlessing({ status: "error", text: error.message || "AI 签语暂时没有摇出来，请再摇一次。", time: moment.localTime });
    }
  };

  const roll = (nextMood = mood) => {
    if (rolling) return;
    blessingGeneration.current += 1;
    blessingController.current?.abort();
    resetSpeech();
    setAiBlessing({ status: "loading", text: "正在摇匀这一杯和此刻…" });
    setRolling(true);
    const nextPool = nextMood === "all" ? recipes : recipes.filter((item) => item.category === nextMood);
    window.setTimeout(() => {
      const nextRecipe = pickRandom(nextPool, recipe.id);
      setRecipe(nextRecipe);
      setRolling(false);
      requestBlessing(nextRecipe, "");
    }, 440);
  };

  const recommendFromMood = async () => {
    const noteForRequest = moodNote.trim();
    if (!noteForRequest || rolling) return;

    blessingController.current?.abort();
    const controller = new AbortController();
    blessingController.current = controller;
    const generation = blessingGeneration.current + 1;
    blessingGeneration.current = generation;
    resetSpeech();
    setSelectionPath("mood");
    setMood("all");
    setRolling(true);
    const moment = getLocalMoment();
    const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    setAiBlessing({ status: "loading", text: "AI 正在读你的心情，为此刻挑一杯…", time: moment.localTime });

    try {
      const [response] = await Promise.all([
        fetch("/api/recommendation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...moment,
            moodNote: noteForRequest,
            candidates: recipes.map((item) => ({
              id: item.id,
              name: item.name,
              category: categoryMeta[item.category]?.name,
              summary: item.summary,
              tags: item.tags,
            })),
            recent: recentBlessings.current.slice(-80),
            requestId,
          }),
          signal: controller.signal,
        }),
        new Promise((resolve) => window.setTimeout(resolve, 440)),
      ]);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "AI 暂时没挑出合适的一杯");
      const nextRecipe = recipes.find((item) => item.id === payload.recipeId);
      if (!nextRecipe || !payload.blessing) throw new Error("AI 推荐结果不完整，请再试一次。");
      if (generation !== blessingGeneration.current) return;

      const nextRecent = [...recentBlessings.current, payload.blessing];
      recentBlessings.current = nextRecent;
      localStorage.setItem(RECENT_BLESSINGS_KEY, JSON.stringify(nextRecent));
      setRecipe(nextRecipe);
      currentBlessing.current = payload.blessing;
      setAiBlessing({
        status: "ready",
        text: payload.blessing,
        time: moment.localTime,
        speechToken: payload.speechToken || "",
      });
    } catch (error) {
      if (error.name === "AbortError" || generation !== blessingGeneration.current) return;
      console.error("Failed to recommend a drink from mood", error);
      setAiBlessing({ status: "error", text: error.message || "AI 暂时没挑出合适的一杯，请稍后再试。", time: moment.localTime });
    } finally {
      if (generation === blessingGeneration.current) setRolling(false);
    }
  };

  const playCachedSpeech = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.ended) audio.currentTime = 0;
    try {
      await audio.play();
    } catch (error) {
      if (error.name === "AbortError") return;
      setSpeech((current) => ({
        ...current,
        status: "ready",
        message: "语音已生成，请再点一次播放。",
      }));
    }
  };

  const toggleSpeech = async () => {
    const audio = audioRef.current;
    if (speech.status === "playing") {
      audio?.pause();
      return;
    }
    if (speech.url) {
      await playCachedSpeech();
      return;
    }
    if (aiBlessing.status !== "ready") return;
    if (!user) {
      setSheet("auth");
      notify("登录后就能听这张签");
      return;
    }
    if (!aiBlessing.speechToken) {
      setSpeech({ status: "error", url: "", message: "语音服务尚未配置，请稍后再试。" });
      return;
    }

    speechController.current?.abort();
    const controller = new AbortController();
    speechController.current = controller;
    const generation = speechGeneration.current;
    const blessingText = aiBlessing.text;
    setSpeech({ status: "loading", url: "", message: "温柔女声正在读这张签…" });

    try {
      const response = await authFetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: blessingText, token: aiBlessing.speechToken }),
        signal: controller.signal,
      }, {
        session: auth.session,
        getSession: getLatestSession,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const requestError = new Error(payload.error || "签语语音暂时生成不了");
        requestError.code = payload.code;
        requestError.statusCode = response.status;
        throw requestError;
      }
      if (!payload.audio) throw new Error("没有收到可以播放的语音");
      if (generation !== speechGeneration.current || currentBlessing.current !== blessingText) return;

      setSpeech({ status: "ready", url: payload.audio, message: "" });
      if (audioRef.current) {
        audioRef.current.src = payload.audio;
        audioRef.current.load();
        await playCachedSpeech();
      }
    } catch (error) {
      if (error.name === "AbortError" || generation !== speechGeneration.current) return;
      if (error instanceof AuthRequiredError || error.code === "AUTH_REQUIRED" || error.statusCode === 401) {
        setSheet("auth");
      }
      console.error("Failed to generate blessing speech", error);
      setSpeech({ status: "error", url: "", message: error.message || "签语语音暂时生成不了，请稍后再试。" });
    } finally {
      if (speechController.current === controller) speechController.current = null;
    }
  };

  const chooseMood = (nextMood) => {
    setSelectionPath("manual");
    setMood(nextMood);
    roll(nextMood);
  };

  const repeatSelection = () => {
    if (selectionPath === "mood" && moodNote.trim()) {
      recommendFromMood();
      return;
    }
    setSelectionPath("manual");
    roll();
  };

  const copyOrder = async () => {
    await navigator.clipboard.writeText(recipe.orderLine);
    notify("点单口令已复制");
  };

  const shareRecipe = async () => {
    const blessingText = aiBlessing.status === "ready" ? `\n今日签：${aiBlessing.text}` : "";
    const text = `今天喝「${recipe.name}」：${recipe.orderLine}${blessingText}`;
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

  const toggleSaved = async () => {
    const previous = saved;
    const next = isSaved
      ? saved.filter((id) => id !== recipe.id)
      : [...saved, recipe.id];
    setSaved(next);

    if (!user) {
      localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(next));
      notify(isSaved ? "已从临时小本本移除" : "已暂存，登录后可以跨设备同步");
      if (!isSaved) window.setTimeout(() => setSheet("auth"), 320);
      return;
    }

    try {
      if (isSaved) await deleteFavorite(recipe.id);
      else await addFavorite(recipe.id);
      notify(isSaved ? "已从云端小本本移除" : "已经同步到云端小本本");
    } catch (favoriteError) {
      console.error("Failed to update Neon favorite", favoriteError);
      setSaved(previous);
      notify("收藏没有同步成功，请稍后再试");
    }
  };

  return (
    <div className="app" style={{ "--accent": meta.color, "--accent-ink": meta.ink }}>
      {intro && <Splash hiding={!intro} />}
      <header className="topbar">
        <a className="brand" href="#top" aria-label="回到顶部">
          <span className="brand__seal">喜</span>
          <span><b>喜点什么？</b><small>{mode === "custom" ? "自创饮品工作台" : "随机搭配研究所"}</small></span>
        </a>
        <div className="topbar__actions">
          <button className={`account-button ${user ? "account-button--signed" : ""}`} onClick={() => setSheet("auth")} aria-label={user ? "账号与同步" : "登录同步收藏"}>
            {auth.isPending ? <LoaderCircle className="spin" size={17} /> : user ? <span>{(user.name || user.email).slice(0, 1).toUpperCase()}</span> : <UserRound size={17} />}
            <b>{auth.isPending ? "确认账号" : user ? (user.name || "已登录") : "登录同步"}</b>
            {user && !syncing && <i><Check size={10} /></i>}
          </button>
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
        <nav className="mode-switch" aria-label="选择创作模式">
          <button type="button" className={mode === "random" ? "active" : ""} onClick={() => switchMode("random")}><Shuffle size={16} />随机灵感<small>替我摇一杯</small></button>
          <button type="button" className={mode === "custom" ? "active" : ""} onClick={() => switchMode("custom")}><Beaker size={16} />自创一杯<small>{user ? "我的配方桌" : "登录后解锁"}</small>{!user && <LockKeyhole size={13} />}</button>
        </nav>
        {mode === "random" ? (
          <>
        <section className="intro-copy">
          <span className="eyebrow"><Sparkles size={15} /> HEYTEA DIY LUCKY MIX</span>
          <h1>今天的喜茶，<em>交给灵感。</em></h1>
          <p>摇一杯公开菜单可复刻的搭配，带着口令去小程序下单。</p>
        </section>

        <section className="mood-note" aria-labelledby="mood-note-title">
          <span className="mood-note__pin" aria-hidden="true" />
          <div className="mood-note__copy">
            <span className="eyebrow"><MessageCircleHeart size={15} /> OPTIONAL · 只在本次摇签使用</span>
            <label id="mood-note-title" htmlFor="mood-note-input">今天发生了什么？</label>
            <p id="mood-note-help">写下一点此刻的心情，让 AI 直接替你挑一杯。</p>
          </div>
          <div className="mood-note__field">
            <textarea
              id="mood-note-input"
              value={moodNote}
              maxLength={120}
              rows={3}
              aria-describedby="mood-note-help"
              placeholder="比如：刚结束一段关系、有点丧，或是今天终于升职啦…"
              onChange={(event) => setMoodNote(Array.from(event.target.value).slice(0, 120).join(""))}
            />
            <div className="mood-note__actions">
              <span className={moodNoteLength >= 108 ? "near-limit" : ""}>{moodNoteLength} / 120</span>
              <button type="button" onClick={recommendFromMood} disabled={!moodNote.trim() || rolling}>
                {rolling && selectionPath === "mood" ? <LoaderCircle className="spin" size={16} /> : <WandSparkles size={16} />}
                {rolling && selectionPath === "mood" ? "正在为你选杯" : "按我的心情推荐"}
              </button>
            </div>
          </div>
        </section>

        <div className="choice-divider" aria-hidden="true"><span>OR</span><p>不想写心情？也可以自己选饮品方向</p></div>

        <nav className="mood-strip" aria-label="自己选择饮品方向">
          {moods.map((item) => (
            <button
              key={item.id}
              className={selectionPath === "manual" && mood === item.id ? "active" : ""}
              onClick={() => chooseMood(item.id)}
              disabled={rolling}
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
            <p className="recipe-card__label">{selectionPath === "mood" ? "AI 按此刻心情推荐" : "你的今日特调"}</p>
            <h2>{recipe.name}</h2>
            <p className="recipe-card__summary">{recipe.summary}</p>

            <div className="taste-tags">
              {recipe.tags.map((tag) => <span key={tag}>#{tag}</span>)}
            </div>

            <div className={`ai-blessing ai-blessing--${aiBlessing.status}`}>
              <div className="ai-blessing__head">
                <span>{aiBlessing.status === "loading" ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />} AI 此刻签</span>
                <small>{aiBlessing.status === "ready" ? "DEEPSEEK V4 PRO" : "LOCAL TIME"}</small>
              </div>
              <p>{aiBlessing.text}</p>
              {aiBlessing.time && <time>{aiBlessing.time}</time>}
              {aiBlessing.status === "ready" && currentBlessing.current === aiBlessing.text && (
                <div className="speech-player">
                  <audio
                    ref={audioRef}
                    preload="none"
                    onPlay={() => setSpeech((current) => ({ ...current, status: "playing", message: "" }))}
                    onPause={() => setSpeech((current) => current.status === "playing" ? { ...current, status: "paused" } : current)}
                    onEnded={() => setSpeech((current) => ({ ...current, status: "ended", message: "已播完，再听一次也可以。" }))}
                    onError={() => setSpeech((current) => current.url ? { status: "error", url: "", message: "音频加载失败，请重新生成。" } : current)}
                  />
                  <button
                    type="button"
                    className={`speech-button speech-button--${speech.status}`}
                    onClick={user ? toggleSpeech : () => setSheet("auth")}
                    disabled={speech.status === "loading"}
                    aria-label={!user ? "登录后播放签语" : speech.status === "playing" ? "暂停签语" : speech.url ? "播放签语" : "生成并播放签语"}
                  >
                    {speech.status === "loading" ? <LoaderCircle className="spin" size={16} />
                      : speech.status === "playing" ? <Pause size={16} fill="currentColor" />
                        : speech.url ? <Play size={16} fill="currentColor" /> : <Volume2 size={16} />}
                    <span>{speech.status === "loading" ? "正在生成语音"
                      : speech.status === "playing" ? "暂停"
                        : speech.status === "paused" ? "继续播放"
                          : speech.status === "ended" ? "重新播放"
                            : speech.url ? "播放" : speech.status === "error" ? "重新生成" : "听听这张签"}</span>
                  </button>
                  {speech.message && <small className={`speech-player__status speech-player__status--${speech.status}`} role="status">{speech.message}</small>}
                </div>
              )}
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
              <button className="roll-button" onClick={repeatSelection} disabled={rolling}>
                <RotateCcw size={19} />{selectionPath === "mood" ? "按心情再配一杯" : "再摇一杯"} <kbd>R</kbd>
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
                disabled={rolling}
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
          </>
        ) : (
          <CustomDrinkStudio user={user} getSession={getLatestSession} onLogin={() => setSheet("auth")} />
        )}
      </main>

      <footer>
        <div><span className="brand__seal">喜</span><b>今天就喝这一杯吧。</b></div>
        <p>非喜茶官方产品 · 仅作随机搭配灵感<br />菜单与原料会因城市、门店和时段变化</p>
        <button onClick={() => setSheet("sources")}>资料来源与说明 <ArrowUpRight size={16} /></button>
      </footer>

      {sheet && (
        <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSheet(null)}>
          <aside className="sheet" role="dialog" aria-modal="true" aria-label={sheet === "sources" ? "资料来源" : sheet === "saved" ? "收藏配方" : "账号登录与同步"}>
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
            ) : sheet === "saved" ? (
              <>
                <span className="eyebrow"><Heart size={15} /> SAVED MIXES</span>
                <h2>我的搭配小本本</h2>
                <div className={`cloud-banner ${user ? "cloud-banner--online" : ""}`}>
                  {syncing ? <LoaderCircle className="spin" size={20} /> : user ? <Cloud size={20} /> : <CloudOff size={20} />}
                  <span>
                    <b>{syncing ? "正在对齐云端收藏" : user ? `已同步至 ${user.email}` : "当前收藏只在这台设备"}</b>
                    <small>{user ? "退出后不会向下一位访客展示" : "登录后自动合并，并可跨设备查看"}</small>
                  </span>
                  {!user && <button onClick={() => setSheet("auth")}>去登录</button>}
                </div>
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
            ) : (
              <AuthPanel
                user={user}
                syncing={syncing}
                onAuthenticated={() => { setSheet(null); notify("登录成功，正在同步小本本"); }}
                onSignedOut={() => { setSheet(null); notify("已经安全退出账号"); }}
              />
            )}
          </aside>
        </div>
      )}

      <div className={`toast ${toast ? "toast--show" : ""}`}><Check size={17} />{toast}</div>
    </div>
  );
}

function ConnectedApp() {
  const session = neonClient.auth.useSession();
  return <App auth={{ session: session.data, isPending: session.isPending, configured: true }} />;
}

function Root() {
  const qaEnabled = import.meta.env.DEV || import.meta.env.VITE_QA_SESSION === "true";
  const qaUser = qaEnabled ? globalThis.__HEY_TEA_QA_USER__ : null;
  if (qaUser) return <App auth={{ session: { user: qaUser }, isPending: false, configured: false, qaToken: "qa-session-token" }} />;
  if (neonConfigured) return <ConnectedApp />;
  return <App auth={{ session: null, isPending: false, configured: false }} />;
}

createRoot(document.getElementById("root")).render(<Root />);
