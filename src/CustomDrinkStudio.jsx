import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  Eraser,
  ExternalLink,
  Film,
  Image as ImageIcon,
  LoaderCircle,
  LockKeyhole,
  Pause,
  Play,
  RefreshCw,
  Shuffle,
  Sparkles,
  TicketCheck,
  Volume2,
  WandSparkles,
} from "lucide-react";
import {
  createCustomDrink,
  createCustomSpeech,
  createDrinkImageTask,
  createDrinkVideoTask,
  createVideoFrameTask,
  waitForMediaTask,
  waitForVideoTask,
  suggestCustomIngredients,
} from "./custom-drink-api";
import {
  customDrinkGroups,
  getSelectionIssue,
  makeEmptySelection,
  randomSelection,
  selectionToPayload,
  sweetnessOptions,
  temperatureOptions,
} from "./custom-drink-data";

const initialMedia = { status: "idle", progress: 0, url: "", message: "" };

const mediaUrl = (payload) => payload.url || payload.resultUrl || payload.results?.[0] || payload.output?.url || payload.result?.url || "";

function LockedPreview({ onLogin, mediaEnabled }) {
  return (
    <section className="custom-lock" aria-labelledby="custom-lock-title">
      <div className="custom-lock__preview" aria-hidden="true">
        <span className="custom-lock__tape" />
        <div className="locked-receipt">
          <small>AI CONCEPT BLEND · 仅作灵感</small>
          <h2>月光青提云</h2>
          <p>一张只属于你的风味签笺，将在登录后慢慢显影。</p>
          <div><i /> <i /> <i /> <i /></div>
        </div>
        <div className="locked-cup"><span>喜</span><i /></div>
        <div className="locked-media">
          <button disabled aria-label="登录后听祝福"><Volume2 size={16} />听祝福</button>
          <button disabled aria-label="登录后生成饮品图"><ImageIcon size={16} />饮品图</button>
          <button disabled aria-label="登录后制作宣传片"><Film size={16} />宣传片</button>
        </div>
      </div>
      <div className="custom-lock__copy">
        <span className="lock-seal"><LockKeyhole size={25} /></span>
        <span className="eyebrow">MEMBERS' RECIPE DESK</span>
        <h2 id="custom-lock-title">这张配方纸，<br />等你签名。</h2>
        <p>登录后自由挑选茶底、鲜果、香气与口感，让 AI 为此刻命名{mediaEnabled ? "，并制作专属饮品图和 5 秒宣传片" : "。线上演示版暂不生成媒体作品"}。</p>
        <button type="button" onClick={onLogin}><LockKeyhole size={17} />登录，开始自创</button>
        <small>你的心情仅用于本次创作 · 媒体作品 24 小时有效</small>
      </div>
    </section>
  );
}

function ProgressTicket({ icon, title, detail, progress, status, onRetry }) {
  return (
    <div className={`media-progress media-progress--${status}`} role="status">
      <span className="media-progress__icon">{status === "loading" ? <LoaderCircle className="spin" size={20} /> : icon}</span>
      <div>
        <b>{title}</b>
        <small>{detail}</small>
        {status === "loading" && <span className="progress-track"><i style={{ width: `${progress}%` }} /></span>}
      </div>
      {status === "error" && <button type="button" onClick={onRetry}><RefreshCw size={14} />重试</button>}
    </div>
  );
}

export default function CustomDrinkStudio({ user, getSession, onLogin, mediaEnabled = true }) {
  const [selection, setSelection] = useState(makeEmptySelection);
  const [sweetness, setSweetness] = useState("微微甜");
  const [temperature, setTemperature] = useState("少冰");
  const [note, setNote] = useState("");
  const [recipeMode, setRecipeMode] = useState("manual");
  const [suggestion, setSuggestion] = useState({ status: "idle", reason: "", message: "" });
  const [notice, setNotice] = useState("");
  const [creation, setCreation] = useState({ status: "idle", data: null, message: "" });
  const [image, setImage] = useState(initialMedia);
  const [frame, setFrame] = useState(initialMedia);
  const [video, setVideo] = useState(initialMedia);
  const [speech, setSpeech] = useState({ status: "idle", url: "", message: "" });
  const runRef = useRef(0);
  const controllersRef = useRef(new Set());
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const noticeTimer = useRef(null);

  const selectedCount = useMemo(
    () => Object.values(selection).reduce((total, values) => total + values.length, 0),
    [selection],
  );
  const noteLength = Array.from(note).length;
  const canCreate = Boolean(selection.base.length && selectedCount >= 2 && creation.status !== "loading");

  const stopAll = (reset = false) => {
    runRef.current += 1;
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    audioRef.current?.pause();
    videoRef.current?.pause();
    if (reset) {
      setCreation({ status: "idle", data: null, message: "" });
      setImage(initialMedia);
      setFrame(initialMedia);
      setVideo(initialMedia);
      setSpeech({ status: "idle", url: "", message: "" });
    }
  };

  useEffect(() => () => {
    stopAll();
    window.clearTimeout(noticeTimer.current);
  }, []);

  useEffect(() => {
    if (!user) stopAll(true);
  }, [user?.id]);

  const flash = (message) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2600);
  };

  const reopenLoginIfNeeded = (error) => {
    if (error?.code === "AUTH_REQUIRED" || error?.statusCode === 401) {
      onLogin();
      return true;
    }
    return false;
  };

  const withController = () => {
    const controller = new AbortController();
    controllersRef.current.add(controller);
    return controller;
  };

  const toggleOption = (groupId, optionId) => {
    const current = selection[groupId] || [];
    if (current.includes(optionId)) {
      const group = customDrinkGroups.find((entry) => entry.id === groupId);
      if (group.min && current.length <= group.min) return flash(`${group.title}至少保留一项`);
      setSelection((value) => ({ ...value, [groupId]: current.filter((id) => id !== optionId) }));
      return;
    }
    const issue = getSelectionIssue(selection, groupId, optionId);
    if (issue) return flash(issue);
    const group = customDrinkGroups.find((entry) => entry.id === groupId);
    setSelection((value) => ({
      ...value,
      [groupId]: group.max === 1 ? [optionId] : [...current, optionId],
    }));
  };

  const chooseTemperature = (value) => {
    if (["热", "温"].includes(value) && selection.fruit.length > 1) {
      flash("热饮最多保留一种水果，请先精简水果选择");
      return;
    }
    setTemperature(value);
  };

  const clearDesk = () => {
    stopAll(true);
    setSelection(makeEmptySelection());
    setSweetness("微微甜");
    setTemperature("少冰");
    setNote("");
    setSuggestion({ status: "idle", reason: "", message: "" });
    flash("配方桌已经清空");
  };

  const shuffleDesk = () => {
    stopAll(true);
    setRecipeMode("manual");
    setSuggestion({ status: "idle", reason: "", message: "" });
    setSelection(randomSelection());
    setSweetness(sweetnessOptions[Math.floor(Math.random() * sweetnessOptions.length)]);
    setTemperature(temperatureOptions.slice(2)[Math.floor(Math.random() * 4)]);
    flash("灵感替你抓好一把配料");
  };

  const suggestFromMood = async () => {
    if (!user) return onLogin();
    const mood = note.trim();
    if (Array.from(mood).length < 2) return flash("先写下一点此刻的心情");
    stopAll(true);
    const run = runRef.current;
    const controller = withController();
    setSuggestion({ status: "loading", reason: "", message: "AI 正在从风味抽屉里挑选回应此刻的配料…" });
    try {
      const result = await suggestCustomIngredients(mood, getSession, controller.signal);
      if (run !== runRef.current) return;
      setSelection(result.groups);
      setSweetness(result.sweetness);
      setTemperature(result.temperature);
      setSuggestion({ status: "ready", reason: result.reason, message: "" });
      flash("AI 已经配好一套，你还可以继续微调");
    } catch (error) {
      if (error.name !== "AbortError" && run === runRef.current) {
        reopenLoginIfNeeded(error);
        setSuggestion({ status: "error", reason: "", message: error.message || "这一杯暂时没有配好" });
      }
    } finally {
      controllersRef.current.delete(controller);
    }
  };

  const generateImage = async (drink, moodNote, creationId, run) => {
    const controller = withController();
    setImage({ status: "loading", progress: 7, url: "", message: "正在画杯身与风味层次" });
    try {
      const started = await createDrinkImageTask({ drink, moodNote, creationId }, getSession, controller.signal);
      if (!started.taskId) throw new Error("图片任务没有返回编号");
      const finished = await waitForMediaTask(started, getSession, controller.signal, (progress) => {
        if (run === runRef.current) setImage((value) => ({ ...value, progress, message: progress > 64 ? "正在收拾高光与杯壁水汽" : "正在画杯身与风味层次" }));
      });
      const url = mediaUrl(finished);
      if (!url) throw new Error("图片任务完成，但没有收到作品地址");
      if (run !== runRef.current) return;
      setImage({ status: "ready", progress: 100, url, message: "饮品图已完成" });
    } catch (error) {
      if (error.name !== "AbortError" && run === runRef.current) {
        reopenLoginIfNeeded(error);
        setImage({ status: "error", progress: 0, url: "", message: error.message || "饮品图没有画完" });
      }
    } finally {
      controllersRef.current.delete(controller);
    }
  };

  const beginCreation = async () => {
    if (!user) return onLogin();
    if (!canCreate) return flash("至少选好一项基底和一项搭配配料");
    stopAll(true);
    const run = runRef.current;
    const controller = withController();
    setCreation({ status: "loading", data: null, message: "AI 正在读配方，也在读你写下的这一刻…" });
    try {
      const creationNote = note.trim();
      const ingredients = selectionToPayload(selection, sweetness, temperature);
      const data = await createCustomDrink({ ingredients, note: creationNote }, getSession, controller.signal);
      if (run !== runRef.current) return;
      if (!data.drink?.name || !data.blessing) throw new Error("饮品签笺内容不完整，请重新创作");
      const creationData = { ...data, moodNote: creationNote };
      setCreation({ status: "ready", data: creationData, message: "" });
      setSpeech({ status: "idle", url: "", message: "" });
      if (mediaEnabled) {
        await generateImage(data.drink, creationNote, data.creationId, run);
      } else {
        setImage({ status: "disabled", progress: 0, url: "", message: "线上演示版暂不生成饮品图" });
      }
    } catch (error) {
      if (error.name !== "AbortError" && run === runRef.current) {
        reopenLoginIfNeeded(error);
        setCreation({ status: "error", data: null, message: error.message || "配方没有写完，请再试一次" });
      }
    } finally {
      controllersRef.current.delete(controller);
    }
  };

  const retryImage = async () => {
    if (!mediaEnabled) return flash("线上演示版暂不生成图片");
    if (!user || !creation.data?.drink) return onLogin();
    const run = runRef.current;
    await generateImage(creation.data.drink, creation.data.moodNote || "", creation.data.creationId, run);
  };

  const toggleSpeech = async () => {
    if (!mediaEnabled) return flash("线上演示版暂不生成音频");
    if (!user) return onLogin();
    if (speech.status === "playing") return audioRef.current?.pause();
    if (speech.url) {
      if (audioRef.current?.ended) audioRef.current.currentTime = 0;
      return audioRef.current?.play();
    }
    if (!creation.data?.blessing || !creation.data?.speechTicket) return;
    const controller = withController();
    const run = runRef.current;
    setSpeech({ status: "loading", url: "", message: "正在请温柔女声读签…" });
    try {
      const result = await createCustomSpeech({ text: creation.data.blessing, token: creation.data.speechTicket, creationId: creation.data.creationId }, getSession, controller.signal);
      if (run !== runRef.current || !result.audio) return;
      setSpeech({ status: "ready", url: result.audio, message: "" });
      audioRef.current.src = result.audio;
      audioRef.current.load();
      await audioRef.current.play();
    } catch (error) {
      if (error.name !== "AbortError" && run === runRef.current) {
        reopenLoginIfNeeded(error);
        setSpeech({ status: "error", url: "", message: error.message || "祝福暂时读不出来" });
      }
    } finally {
      controllersRef.current.delete(controller);
    }
  };

  const createVideo = async () => {
    if (!mediaEnabled) return flash("线上演示版暂不生成视频");
    if (!user) return onLogin();
    if (!image.url || !creation.data?.drink) return;
    stopAll(false);
    const run = runRef.current;
    const frameController = withController();
    let videoController;
    let stage = "frame";
    setFrame({ status: "loading", progress: 5, url: "", message: "阶段 1 / 2 · 正在扩展 16:9 广告首帧" });
    setVideo(initialMedia);
    try {
      const videoDrink = {
        name: creation.data.drink.name,
        category: "自创饮品",
        summary: creation.data.drink.summary || "",
        layers: creation.data.drink.receipt || creation.data.drink.ingredients || [],
      };
      const frameTask = await createVideoFrameTask({ imageUrl: image.url, drink: videoDrink, moodNote: creation.data.moodNote || "", creationId: creation.data.creationId }, getSession, frameController.signal);
      const frameResult = frameTask.resultUrl ? frameTask : await waitForVideoTask(frameTask, getSession, frameController.signal, (progress) => {
        if (run === runRef.current) setFrame((value) => ({ ...value, progress }));
      });
      const frameUrl = mediaUrl(frameResult);
      if (!frameUrl) throw new Error("广告首帧没有生成成功");
      if (run !== runRef.current) return;
      setFrame({ status: "ready", progress: 100, url: frameUrl, message: "16:9 广告首帧已就位" });
      controllersRef.current.delete(frameController);

      videoController = withController();
      stage = "video";
      setVideo({ status: "loading", progress: 6, url: "", message: "阶段 2 / 2 · 正在生成 720p · 5 秒宣传片" });
      const videoTask = await createDrinkVideoTask({ frameUrl, drink: videoDrink, moodNote: creation.data.moodNote || "", creationId: creation.data.creationId }, getSession, videoController.signal);
      const videoResult = videoTask.resultUrl ? videoTask : await waitForVideoTask(videoTask, getSession, videoController.signal, (progress) => {
        if (run === runRef.current) setVideo((value) => ({ ...value, progress }));
      });
      const url = mediaUrl(videoResult);
      if (!url) throw new Error("视频任务完成，但没有收到作品地址");
      if (run === runRef.current) setVideo({ status: "ready", progress: 100, url, message: "5 秒宣传片已完成" });
    } catch (error) {
      if (error.name !== "AbortError" && run === runRef.current) {
        reopenLoginIfNeeded(error);
        if (stage === "video") setVideo({ status: "error", progress: 0, url: "", message: error.message });
        else setFrame({ status: "error", progress: 0, url: "", message: error.message || "宣传片制作中断" });
      }
    } finally {
      controllersRef.current.delete(frameController);
      if (videoController) controllersRef.current.delete(videoController);
    }
  };

  if (!user) return <LockedPreview onLogin={onLogin} mediaEnabled={mediaEnabled} />;

  const drink = creation.data?.drink;
  const receipt = drink?.receipt || drink?.ingredients || [];

  return (
    <section className="custom-studio" aria-label="自创饮品工作台">
      <div className="custom-studio__heading">
        <div>
          <span className="eyebrow"><TicketCheck size={15} /> CUSTOM RECIPE DESK</span>
          <h1>把此刻，<em>调成一杯。</em></h1>
          <p>这是一杯 AI 概念特调，不代表门店一定可售；{mediaEnabled ? "尽管大胆，别忘了给风味留白。" : "线上版保留 DeepSeek 文案创作，媒体生成暂时冻结。"}</p>
        </div>
        <div className="desk-tools">
          <button type="button" onClick={clearDesk}><Eraser size={16} />清空</button>
          <button type="button" onClick={shuffleDesk}><Shuffle size={16} />随机配料</button>
        </div>
      </div>

      <div className="recipe-mode-switch" role="tablist" aria-label="选择配料方式">
        <button type="button" role="tab" aria-selected={recipeMode === "manual"} className={recipeMode === "manual" ? "active" : ""} onClick={() => setRecipeMode("manual")}>
          <span><b>01</b><Shuffle size={18} /></span>
          <strong>自己挑配料</strong>
          <small>从茶底、鲜果和小料开始，亲手写一张配方</small>
        </button>
        <button type="button" role="tab" aria-selected={recipeMode === "mood"} className={recipeMode === "mood" ? "active" : ""} onClick={() => setRecipeMode("mood")}>
          <span><b>02</b><WandSparkles size={18} /></span>
          <strong>AI 按心情搭配</strong>
          <small>先说说今天怎么了，让风味主动来回应你</small>
        </button>
      </div>

      <div className="custom-workbench">
        <div className="ingredient-drawers">
          {recipeMode === "mood" && (
            <section className={`mood-recipe-oracle mood-recipe-oracle--${suggestion.status}`} aria-labelledby="mood-recipe-title">
              <div className="mood-recipe-oracle__head">
                <span><WandSparkles size={17} /></span>
                <div><small>MOOD-FIRST BLENDING</small><h2 id="mood-recipe-title">先说心情，再挑味道。</h2></div>
              </div>
              <p>AI 只会从下方真实配料目录中选择，并自动避开 0 咖、酸乳和热饮冲突。搭配后仍然可以自己调整。</p>
              <div className="mood-recipe-oracle__field">
                <textarea aria-label="写下心情让 AI 自动搭配配料" rows={4} maxLength={120} value={note} onChange={(event) => setNote(Array.from(event.target.value).slice(0, 120).join(""))} placeholder="例如：今天终于把一个很难的项目做完，想要一杯明亮、有庆祝感但不要太甜的饮品…" />
                <span>{noteLength} / 120</span>
              </div>
              <button type="button" onClick={suggestFromMood} disabled={suggestion.status === "loading" || noteLength < 2}>
                {suggestion.status === "loading" ? <LoaderCircle className="spin" size={18} /> : <WandSparkles size={18} />}
                {suggestion.status === "loading" ? "正在听心情、翻配料抽屉…" : suggestion.status === "ready" ? "按这个心情再配一套" : "让 AI 替我搭配"}
              </button>
              {suggestion.status === "loading" && <p className="mood-recipe-oracle__status">{suggestion.message}</p>}
              {suggestion.status === "error" && <p className="mood-recipe-oracle__status mood-recipe-oracle__status--error">{suggestion.message}</p>}
              {suggestion.status === "ready" && <blockquote><Sparkles size={15} /><span><b>这套搭配为什么适合此刻</b>{suggestion.reason}</span></blockquote>}
            </section>
          )}
          {customDrinkGroups.map((group) => (
            <fieldset className="ingredient-group" key={group.id}>
              <legend><b>{group.step}</b><span>{group.title}<small>{group.hint}</small></span><em>{selection[group.id].length}/{group.max}</em></legend>
              <div className="ingredient-options">
                {group.options.map((option) => {
                  const active = selection[group.id].includes(option.id);
                  return (
                    <button
                      type="button"
                      key={option.id}
                      className={active ? "active" : ""}
                      aria-pressed={active}
                      onClick={() => toggleOption(group.id, option.id)}
                    >
                      <span>{active && <Check size={13} />}{option.name}</span>
                      <small>{option.notes.join(" · ")}</small>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <fieldset className="ingredient-group ingredient-group--finish">
            <legend><b>07</b><span>甜度与温度<small>最后校准这杯的体感</small></span></legend>
            <div className="finish-row">
              <div><label>甜度</label>{sweetnessOptions.map((item) => <button type="button" aria-pressed={sweetness === item} className={sweetness === item ? "active" : ""} key={item} onClick={() => setSweetness(item)}>{item}</button>)}</div>
              <div><label>温度</label>{temperatureOptions.map((item) => <button type="button" aria-pressed={temperature === item} className={temperature === item ? "active" : ""} key={item} onClick={() => chooseTemperature(item)}>{item}</button>)}</div>
            </div>
          </fieldset>

          {recipeMode === "manual" && <div className="custom-note">
            <label htmlFor="custom-drink-note">这杯想说的话 / 此刻心情</label>
            <p>它会影响饮品命名、描述与祝福{mediaEnabled ? "，也会进入图片和视频的创意描述" : "；本地完整版还会影响图片与视频"}。</p>
            <textarea id="custom-drink-note" rows={4} maxLength={120} value={note} onChange={(event) => setNote(Array.from(event.target.value).slice(0, 120).join(""))} placeholder="例如：终于结束忙碌的一周，想把晚风和松弛都装进杯子里…" />
            <small className={noteLength >= 108 ? "near-limit" : ""}>{noteLength} / 120</small>
          </div>}

          {notice && <div className="constraint-notice" role="status"><AlertTriangle size={16} />{notice}</div>}
          <button type="button" className="create-drink-button" disabled={!canCreate} onClick={beginCreation}>
            {creation.status === "loading" ? <LoaderCircle className="spin" size={20} /> : <Sparkles size={20} />}
            {creation.status === "loading" ? "正在写你的饮品签笺…" : creation.data ? "重新创作这杯" : recipeMode === "mood" ? "用这套心情配方创作" : "创造我的喜茶"}
            <small>{selectedCount} 项配料</small>
          </button>
        </div>

        <aside className={`creation-board creation-board--${creation.status}`} aria-live="polite">
          {creation.status === "idle" && (
            <div className="creation-empty">
              <div className="creation-empty__cup"><span>喜</span><i /></div>
              <span className="eyebrow">WAITING FOR YOUR RECIPE</span>
              <h2>配方纸还是空白</h2>
              <p>左边挑好基底和至少一项搭配，属于你的饮品签就会在这里显影。</p>
            </div>
          )}
          {creation.status === "loading" && (
            <div className="creation-loading">
              <span className="loading-seal"><LoaderCircle className="spin" size={28} /></span>
              <span className="eyebrow">DEEPSEEK IS WRITING</span>
              <h2>正在听这杯说话</h2>
              <p>{creation.message}</p>
              <div><i /><i /><i /><i /><i /></div>
            </div>
          )}
          {creation.status === "error" && (
            <div className="creation-error">
              <AlertTriangle size={32} />
              <h2>这张签被风吹走了</h2>
              <p>{creation.message}</p>
              <button type="button" onClick={beginCreation}><RefreshCw size={16} />重新创作</button>
            </div>
          )}
          {creation.status === "ready" && drink && (
            <div className="creation-result">
              <div className="concept-ribbon">AI 概念特调 · 非门店在售承诺</div>
              <div className={`generated-visual generated-visual--${image.status}`}>
                {image.url ? <img src={image.url} alt={`${drink.name} AI 概念饮品图`} /> : mediaEnabled ? <div className="image-skeleton"><span /><i /><b>正在显影</b></div> : <div className="image-skeleton image-skeleton--disabled"><LockKeyhole size={24} /><b>线上版不生成图片</b><small>本地配置模型后可解锁</small></div>}
                <span className="visual-seal">自<br />创</span>
              </div>
              {image.status === "loading" && <ProgressTicket icon={<ImageIcon size={20} />} title="饮品图正在显影" detail={image.message} progress={image.progress} status="loading" />}
              {image.status === "error" && <ProgressTicket icon={<AlertTriangle size={20} />} title="饮品图没有画完" detail={image.message} progress={0} status="error" onRetry={retryImage} />}
              <div className="creation-copy">
                <small>YOUR ORIGINAL CUP</small>
                <h2>{drink.name}</h2>
                <p>{drink.summary}</p>
                <div className="taste-tags">{(drink.tags || []).map((tag) => <span key={tag}>#{tag}</span>)}</div>
              </div>
              <div className="custom-blessing">
                <span><Sparkles size={14} />写给此刻的签</span>
                <p>{creation.data.blessing}</p>
                {mediaEnabled ? <>
                  <audio ref={audioRef} preload="none" onPlay={() => setSpeech((value) => ({ ...value, status: "playing", message: "" }))} onPause={() => setSpeech((value) => value.status === "playing" ? { ...value, status: "paused" } : value)} onEnded={() => setSpeech((value) => ({ ...value, status: "ended" }))} />
                  <button type="button" className="custom-speech-button" disabled={speech.status === "loading"} onClick={toggleSpeech} aria-label={speech.status === "playing" ? "暂停自创祝福" : speech.url ? "播放自创祝福" : "生成并播放自创祝福"}>
                    {speech.status === "loading" ? <LoaderCircle className="spin" size={15} /> : speech.status === "playing" ? <Pause size={15} /> : speech.url ? <Play size={15} /> : <Volume2 size={15} />}
                    {speech.status === "loading" ? "正在生成语音" : speech.status === "playing" ? "暂停" : speech.url ? "播放祝福" : "听听这张签"}
                  </button>
                </> : <small className="media-disabled-note"><LockKeyhole size={13} />线上演示版暂不生成语音</small>}
                {speech.message && <small className="speech-message">{speech.message}</small>}
              </div>
              <div className="custom-receipt">
                <div><b>配料小票</b><small>MIX RECEIPT</small></div>
                <ol>{receipt.map((item, index) => <li key={`${typeof item === "string" ? item : item.name}-${index}`}><em>{String(index + 1).padStart(2, "0")}</em><span>{typeof item === "string" ? item : item.name}</span></li>)}</ol>
                <footer><span><small>甜度</small>{drink.sweetness || sweetness}</span><span><small>温度</small>{drink.temperature || temperature}</span></footer>
              </div>

              {mediaEnabled && image.status === "ready" && (
                <div className="media-lab">
                  <div className="temporary-note"><Check size={15} /><span><b>作品已跟随账号保存</b><small>生成完成的图片、声音和视频会自动归档到 R2</small></span></div>
                  <div className="asset-links">
                    <a href={image.url} download={`${drink.name}.png`} target="_blank" rel="noreferrer"><Download size={15} />保存饮品图</a>
                    {!video.url && <button type="button" onClick={createVideo}><Film size={16} />制作 5 秒宣传片</button>}
                  </div>
                  {frame.status !== "idle" && <ProgressTicket icon={<Check size={20} />} title={frame.status === "ready" ? "广告首帧已扩展" : frame.status === "error" ? "首帧扩展失败" : "扩展 16:9 广告首帧"} detail={frame.message} progress={frame.progress} status={frame.status} onRetry={createVideo} />}
                  {video.status !== "idle" && <ProgressTicket icon={<Film size={20} />} title={video.status === "ready" ? "宣传片制作完成" : video.status === "error" ? "宣传片制作失败" : "生成 720p · 5 秒视频"} detail={video.message} progress={video.progress} status={video.status} onRetry={createVideo} />}
                  {video.url && (
                    <div className="video-result">
                      <video ref={videoRef} src={video.url} controls playsInline aria-label={`${drink.name} 5秒宣传片`} />
                      <div><a href={video.url} target="_blank" rel="noreferrer"><ExternalLink size={15} />打开视频</a><a href={video.url} download={`${drink.name}.mp4`}><Download size={15} />下载视频</a></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
