"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type SweatLevel = "low" | "medium" | "high";
type PlanStatus = "planned" | "done";
type Plan = {
  id: string;
  sport: string;
  duration: number;
  weight: number;
  temperature: number;
  sweat: SweatLevel;
  water: number;
  electrolyte: number;
  before: number;
  during: number;
  after: number;
  status: PlanStatus;
  createdAt: string;
};
type ChatMessage = { id: string; content: string; createdAt: string };

const PLAN_KEY = "hydro-pace-plans";
const MESSAGE_KEY = "hydro-pace-messages";
const sweatLabels: Record<SweatLevel, string> = { low: "적게 흘려요", medium: "보통이에요", high: "많이 흘려요" };

function calculatePlan(input: Omit<Plan, "id" | "water" | "electrolyte" | "before" | "during" | "after" | "status" | "createdAt">) {
  const sweatRate = input.sweat === "high" ? 0.8 : input.sweat === "medium" ? 0.6 : 0.4;
  const heatBonus = input.temperature >= 28 ? 0.1 : input.temperature <= 12 ? -0.05 : 0;
  const bodyBonus = input.weight >= 80 ? 0.05 : input.weight < 55 ? -0.05 : 0;
  const hourlyLitres = Math.min(0.9, Math.max(0.35, sweatRate + heatBonus + bodyBonus));
  const water = Math.round(hourlyLitres * (input.duration / 60) * 1000 / 10) * 10;
  const electrolyte = input.duration >= 60 || input.sweat === "high" || input.temperature >= 28 ? Math.round(water * 0.6) : 0;
  return { water, electrolyte, before: Math.round(water * 0.2 / 10) * 10, during: Math.round(water * 0.6 / 10) * 10, after: Math.round(water * 0.2 / 10) * 10 };
}

function normalizePlan(plan: Plan): Plan {
  const { water, electrolyte, before, during, after } = calculatePlan(plan);
  return { ...plan, water, electrolyte, before, during, after };
}

export default function Home() {
  const [tab, setTab] = useState<"plan" | "history" | "chat">("plan");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ sport: "러닝", duration: "60", weight: "65", temperature: "22", sweat: "medium" as SweatLevel });
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([fetch("/api/plans"), fetch("/api/messages")])
        .then(async ([planResponse, messageResponse]) => {
          if (!planResponse.ok || !messageResponse.ok) throw new Error();
          const [remotePlans, remoteMessages] = await Promise.all([planResponse.json(), messageResponse.json()]);
          const storedPlans: Plan[] = JSON.parse(localStorage.getItem(PLAN_KEY) || "[]");
          const normalizedPlans = (remotePlans.length ? remotePlans : storedPlans).map(normalizePlan);
          setPlans(normalizedPlans);
          localStorage.setItem(PLAN_KEY, JSON.stringify(normalizedPlans));
          setMessages(remoteMessages.length ? remoteMessages : JSON.parse(localStorage.getItem(MESSAGE_KEY) || "[]"));
        })
        .catch(() => setError("저장된 정보를 불러오지 못했습니다. 다시 시도해 주세요."))
        .finally(() => setLoading(false));
    }, 550);
    return () => window.clearTimeout(timer);
  }, []);

  const isValid = useMemo(() => form.sport.trim().length > 0 && Number(form.duration) >= 15 && Number(form.weight) >= 30 && Number(form.temperature) >= -10 && Number(form.temperature) <= 50, [form]);
  const updatePlanStorage = (next: Plan[]) => { setPlans(next); localStorage.setItem(PLAN_KEY, JSON.stringify(next)); };

  async function createPlan(event: FormEvent) {
    event.preventDefault();
    if (!isValid) { setError("입력값을 확인해 주세요. 운동은 15분 이상, 체중은 30kg 이상 입력해야 합니다."); return; }
    setSubmitting(true); setError("");
    const input = { sport: form.sport.trim(), duration: Number(form.duration), weight: Number(form.weight), temperature: Number(form.temperature), sweat: form.sweat };
    const plan = { id: crypto.randomUUID(), ...input, ...calculatePlan(input), status: "planned" as PlanStatus, createdAt: new Date().toISOString() };
    try {
      const response = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan) });
      if (!response.ok) throw new Error();
      updatePlanStorage([plan, ...plans]);
      setSelected(plan); setTab("history");
    } catch { setError("추천 계획을 만들지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요."); }
    finally { setSubmitting(false); }
  }

  function markDone(plan: Plan) {
    const next = plans.map((item) => item.id === plan.id ? { ...item, status: "done" as PlanStatus } : item);
    updatePlanStorage(next); setSelected(next.find((item) => item.id === plan.id) || null);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    const draft = { id: crypto.randomUUID(), content: message.trim(), createdAt: new Date().toISOString() };
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      if (!response.ok) throw new Error();
      const next = [...messages, draft]; setMessages(next); localStorage.setItem(MESSAGE_KEY, JSON.stringify(next)); setMessage("");
    } catch { setError("메시지를 보내지 못했습니다. 입력한 내용은 그대로 유지했습니다."); }
  }

  const retry = () => { setError(""); window.location.reload(); };
  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">💧</div><div><p className="eyebrow">HYDRO PACE</p><h1>나만의 수분 페이스</h1></div><span className="status-dot">오늘도 준비 완료</span></header>
    <section className="hero"><div className="runner-art" aria-hidden="true"><div className="runner-shadow" /><div className="runner-figure"><i className="runner-head" /><i className="runner-torso" /><i className="runner-arm arm-back" /><i className="runner-arm arm-front" /><i className="runner-leg leg-back" /><i className="runner-leg leg-front" /></div></div><p>운동 전에, 딱 맞게.</p><h2>흘릴 땀을 미리<br /><em>채워볼까요?</em></h2><span>운동 조건을 바탕으로 오늘의 수분 페이스를 제안해요.</span></section>
    <nav className="tabs" aria-label="서비스 메뉴">
      <button className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")}>추천 만들기</button>
      <button className={tab === "history" ? "active" : ""} onClick={() => { setTab("history"); setSelected(null); }}>내 기록 <b>{plans.length}</b></button>
      <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>문의하기</button>
    </nav>
    {error && <div className="notice error" role="alert"><span>{error}</span><button onClick={retry}>다시 시도</button></div>}
    {loading ? <Loading /> : tab === "plan" ? <PlanForm form={form} setForm={setForm} isValid={isValid} submitting={submitting} createPlan={createPlan} /> : tab === "history" ? <History plans={plans} selected={selected} setSelected={setSelected} markDone={markDone} /> : <Chat messages={messages} message={message} setMessage={setMessage} sendMessage={sendMessage} />}
    <footer>의료 조언이 아닌 운동 수분 관리 참고용 안내입니다. 질환·복용 약물이 있거나 어지럼증 등 이상 증상이 있으면 전문가와 상담하세요.</footer>
  </main>;
}

function PlanForm({ form, setForm, isValid, submitting, createPlan }: { form: { sport: string; duration: string; weight: string; temperature: string; sweat: SweatLevel }; setForm: React.Dispatch<React.SetStateAction<{ sport: string; duration: string; weight: string; temperature: string; sweat: SweatLevel }>>; isValid: boolean; submitting: boolean; createPlan: (e: FormEvent) => Promise<void> }) {
  const field = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <section className="card form-card"><div className="section-heading"><span className="step">01</span><div><h2>오늘의 운동 조건</h2><p>정확할수록 더 나은 페이스를 만들 수 있어요.</p></div></div><form onSubmit={createPlan} noValidate>
    <label>운동 종목<input value={form.sport} maxLength={20} onChange={(e) => field("sport", e.target.value)} placeholder="예: 러닝" /></label>
    <div className="two-col"><label>운동 시간 (분)<input type="number" inputMode="numeric" min="15" value={form.duration} onChange={(e) => field("duration", e.target.value)} /></label><label>체중 (kg)<input type="number" inputMode="decimal" min="30" value={form.weight} onChange={(e) => field("weight", e.target.value)} /></label></div>
    <label>예상 기온 (°C)<input type="number" inputMode="numeric" min="-10" max="50" value={form.temperature} onChange={(e) => field("temperature", e.target.value)} /></label>
    <fieldset><legend>평소 땀 배출량</legend><div className="segmented">{(["low", "medium", "high"] as SweatLevel[]).map((level) => <button type="button" key={level} className={form.sweat === level ? "selected" : ""} onClick={() => field("sweat", level)}>{sweatLabels[level]}</button>)}</div></fieldset>
    {!isValid && <p className="form-help">운동 시간 15분 이상, 체중 30kg 이상을 입력해 주세요.</p>}
    <button className="primary" disabled={!isValid || submitting} type="submit">{submitting ? "페이스 계산 중…" : "내 수분 페이스 만들기"}<span>→</span></button>
  </form></section>;
}

function History({ plans, selected, setSelected, markDone }: { plans: Plan[]; selected: Plan | null; setSelected: (plan: Plan | null) => void; markDone: (plan: Plan) => void }) {
  if (selected) return <PlanDetail plan={selected} onBack={() => setSelected(null)} onDone={() => markDone(selected)} />;
  if (!plans.length) return <section className="empty card"><div>◌</div><h2>아직 만든 페이스가 없어요</h2><p>첫 운동의 수분 계획을 만들어 보세요.</p><button className="text-button" onClick={() => document.querySelector<HTMLButtonElement>(".tabs button")?.click()}>추천 만들기 →</button></section>;
  return <section className="history"><div className="section-heading"><span className="step">02</span><div><h2>내 수분 페이스</h2><p>저장된 계획은 새로고침해도 유지돼요.</p></div></div>{plans.map((plan) => <button className="plan-row" key={plan.id} onClick={() => setSelected(plan)}><div className="sport-icon">{plan.sport === "러닝" ? "🏃" : "⚡"}</div><div><strong>{plan.sport} · {plan.duration}분</strong><span>{new Date(plan.createdAt).toLocaleDateString("ko-KR")} · {plan.water.toLocaleString()}mL</span></div><i className={plan.status}>{plan.status === "done" ? "완료" : "예정"}</i><b>›</b></button>)}</section>;
}

function PlanDetail({ plan, onBack, onDone }: { plan: Plan; onBack: () => void; onDone: () => void }) {
  return <section className="detail"><button className="back" onClick={onBack}>← 기록으로</button><div className="detail-hero"><p>{plan.sport} · {plan.duration}분 · {plan.temperature}°C</p><h2>오늘, <em>{plan.water.toLocaleString()}mL</em>를<br />나눠 마셔요.</h2><span>{sweatLabels[plan.sweat]} 기준으로 계산한 참고용 계획이에요.</span></div><div className="metric"><span>💧 권장 수분</span><strong>{plan.water.toLocaleString()} <small>mL</small></strong><p>운동 전후·중간에 나눠 섭취해 보세요.</p></div><div className="timeline"><h3>이렇게 나눠 드세요</h3><div><span>운동 전</span><b>{plan.before}mL</b><p>시작 30~60분 전</p></div><div><span>운동 중</span><b>{plan.during}mL</b><p>15~20분 간격으로</p></div><div><span>운동 후</span><b>{plan.after}mL</b><p>천천히 보충하기</p></div></div>{plan.electrolyte > 0 && <div className="electrolyte"><span>⚡ 전해질도 함께</span><b>약 {plan.electrolyte}mg 나트륨</b><p>1시간 이상 운동·더운 날·땀을 많이 흘릴 때는 전해질 음료를 고려해 보세요.</p></div>}<a className="source" href="https://pubmed.ncbi.nlm.nih.gov/17277604/" target="_blank" rel="noreferrer">수분 섭취 참고 자료: ACSM 운동 수분 보충 가이드 ↗</a>{plan.status === "done" ? <div className="complete">✓ 오늘의 수분 보충을 기록했어요. 수고했어요!</div> : <button className="primary" onClick={onDone}>섭취 완료로 기록하기 <span>✓</span></button>}</section>;
}

function Chat({ messages, message, setMessage, sendMessage }: { messages: ChatMessage[]; message: string; setMessage: (value: string) => void; sendMessage: (event: FormEvent) => Promise<void> }) {
  return <section className="chat card"><div className="section-heading"><span className="step">03</span><div><h2>궁금한 점이 있나요?</h2><p>Hydro Pace 팀에게 메시지를 남겨 주세요.</p></div></div><div className="messages">{messages.length ? messages.map((item) => <div className="bubble" key={item.id}><p>{item.content}</p><span>{new Date(item.createdAt).toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span></div>) : <div className="empty-chat"><span>💬</span><p>아직 대화가 없습니다.<br />먼저 말을 건네보세요.</p></div>}</div><form className="message-form" onSubmit={sendMessage}><input value={message} maxLength={300} onChange={(event) => setMessage(event.target.value)} placeholder="예: 운동 중 물을 얼마나 마셔야 하나요?" /><button aria-label="메시지 보내기" disabled={!message.trim()}>↑</button></form></section>;
}

function Loading() { return <section className="card skeleton"><div /><div /><div /><div /></section>; }




