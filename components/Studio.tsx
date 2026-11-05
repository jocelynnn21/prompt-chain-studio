"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpRight, Check, ChevronRight, CirclePlus, Image as ImageIcon, Moon, Play, Save, Sun, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Chain, Model, Run, Step } from "@/lib/types";

type Props = { initialChains: Chain[]; initialSteps: Step[]; initialRuns: Run[]; models: Model[]; dataError: string | null; runError: string | null; userEmail: string };
type StepDraft = Pick<Step, "description" | "llm_system_prompt" | "llm_user_prompt" | "llm_model_id" | "llm_temperature" | "is_hidden">;
const blankStep: StepDraft = { description: "", llm_system_prompt: "", llm_user_prompt: "", llm_model_id: null, llm_temperature: null, is_hidden: false };

export default function Studio({ initialChains, initialSteps, initialRuns, models, dataError, runError, userEmail }: Props) {
  const [chains, setChains] = useState(initialChains);
  const [steps, setSteps] = useState(initialSteps);
  const [runs, setRuns] = useState(initialRuns);
  const [selectedId, setSelectedId] = useState<number | null>(initialChains[0]?.id ?? null);
  const [chainDraft, setChainDraft] = useState({ slug: initialChains[0]?.slug ?? "", description: initialChains[0]?.description ?? "" });
  const [editingChain, setEditingChain] = useState(false);
  const [creatingChain, setCreatingChain] = useState(false);
  const [stepEditor, setStepEditor] = useState<Step | "new" | null>(null);
  const [stepDraft, setStepDraft] = useState<StepDraft>(blankStep);
  const [stepError, setStepError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(dataError ? `Could not load chain data: ${dataError}` : null);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [activeTab, setActiveTab] = useState<"builder" | "outputs">("builder");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const selected = chains.find(chain => chain.id === selectedId) ?? null;
  const chainSteps = steps.filter(step => step.humor_flavor_id === selectedId).sort((a, b) => a.order_by - b.order_by);
  const chainRuns = runs.filter(run => run.humor_flavor_id === selectedId);

  useEffect(() => {
    const saved = localStorage.getItem("chain-studio-theme");
    if (saved === "light" || saved === "dark" || saved === "system") {
      const timer = window.setTimeout(() => setTheme(saved), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("chain-studio-theme", theme);
  }, [theme]);
  function choose(chain: Chain) {
    setSelectedId(chain.id); setChainDraft({ slug: chain.slug, description: chain.description ?? "" });
    setEditingChain(false); setCreatingChain(false); setStepEditor(null); setNotice(null);
  }
  function errorMessage(error: unknown) {
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
    return String(error);
  }
  function fail(error: unknown) { setNotice(errorMessage(error)); }
  function beginCreateChain() { setCreatingChain(true); setEditingChain(true); setChainDraft({ slug: "", description: "" }); setStepEditor(null); }
  async function saveChain() {
    const slug = chainDraft.slug.trim();
    if (!slug) { setNotice("Give the chain a name."); return; }
    setBusy(true); setNotice(null);
    try {
      const payload = { slug, description: chainDraft.description.trim() || null, modified_datetime_utc: new Date().toISOString() };
      const result = creatingChain
        ? await supabase.from("humor_flavors").insert(payload).select("*").single()
        : await supabase.from("humor_flavors").update(payload).eq("id", selectedId).select("*").single();
      if (result.error) throw result.error;
      const chain = result.data as Chain;
      setChains(previous => creatingChain ? [chain, ...previous] : previous.map(item => item.id === chain.id ? chain : item));
      choose(chain);
      setNotice(creatingChain ? "Chain created." : "Chain updated.");
    } catch (error) { fail(error); } finally { setBusy(false); }
  }
  async function deleteChain() {
    if (!selected || !window.confirm(`Delete “${selected.slug}” and all its steps and run history?`)) return;
    setBusy(true); setNotice(null);
    const { error } = await supabase.from("humor_flavors").delete().eq("id", selected.id);
    if (error) fail(error);
    else {
      const remaining = chains.filter(item => item.id !== selected.id);
      setChains(remaining); setSteps(steps.filter(step => step.humor_flavor_id !== selected.id));
      setRuns(runs.filter(run => run.humor_flavor_id !== selected.id)); setSelectedId(remaining[0]?.id ?? null);
      setChainDraft({ slug: remaining[0]?.slug ?? "", description: remaining[0]?.description ?? "" }); setNotice("Chain deleted.");
    }
    setBusy(false);
  }
  function openStep(step: Step | "new") {
    setStepEditor(step);
    setStepError(null);
    setStepDraft(step === "new" ? blankStep : { description: step.description ?? "", llm_system_prompt: step.llm_system_prompt ?? "", llm_user_prompt: step.llm_user_prompt ?? "", llm_model_id: step.llm_model_id, llm_temperature: step.llm_temperature, is_hidden: step.is_hidden });
  }
  async function saveStep() {
    if (!selected || !stepEditor) return;
    if (!stepDraft.llm_user_prompt?.trim()) { setStepError("Add a prompt instruction before saving this step."); return; }
    setBusy(true); setNotice(null); setStepError(null);
    try {
      const payload = { ...stepDraft, description: stepDraft.description?.trim() || null, llm_system_prompt: stepDraft.llm_system_prompt?.trim() || null, llm_user_prompt: stepDraft.llm_user_prompt.trim(), modified_datetime_utc: new Date().toISOString() };
      const result = stepEditor === "new"
        ? await supabase.from("humor_flavor_steps").insert({ ...payload, humor_flavor_id: selected.id, order_by: Math.max(0, ...chainSteps.map(step => step.order_by)) + 1 }).select("*").single()
        : await supabase.from("humor_flavor_steps").update(payload).eq("id", stepEditor.id).select("*").single();
      if (result.error) throw result.error;
      const step = result.data as Step;
      setSteps(previous => stepEditor === "new" ? [...previous, step] : previous.map(item => item.id === step.id ? step : item));
      setStepEditor(null); setNotice(stepEditor === "new" ? "Step added." : "Step updated.");
    } catch (error) { setStepError(errorMessage(error)); } finally { setBusy(false); }
  }
  async function deleteStep(step: Step) {
    if (!window.confirm(`Delete step ${step.order_by}?`)) return;
    setBusy(true); setNotice(null);
    const { error } = await supabase.from("humor_flavor_steps").delete().eq("id", step.id);
    if (error) fail(error);
    else { setSteps(previous => previous.filter(item => item.id !== step.id)); setNotice("Step deleted."); }
    setBusy(false);
  }
  async function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= chainSteps.length) return;
    setBusy(true); setNotice(null);
    const reordered = [...chainSteps];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      for (const [position, step] of reordered.entries()) {
        const { error } = await supabase.from("humor_flavor_steps").update({ order_by: position + 1, modified_datetime_utc: new Date().toISOString() }).eq("id", step.id);
        if (error) throw error;
      }
      setSteps(previous => previous.map(item => reordered.findIndex(step => step.id === item.id) === -1 ? item : { ...item, order_by: reordered.findIndex(step => step.id === item.id) + 1 }));
      setNotice("Step order saved.");
    } catch (error) { fail(error); const { data } = await supabase.from("humor_flavor_steps").select("*").eq("humor_flavor_id", selectedId).order("order_by"); if (data) setSteps(previous => [...previous.filter(step => step.humor_flavor_id !== selectedId), ...(data as Step[])]); }
    finally { setBusy(false); }
  }
  async function generate() {
    if (!selected || (!textInput.trim() && !imageUrl.trim())) { setNotice("Add text or an image URL to run this chain."); return; }
    setGenerating(true); setNotice(null);
    try {
      const response = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chainId: selected.id, text: textInput, imageUrl }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Generation failed.");
      setRuns(previous => [payload.run as Run, ...previous]); setActiveTab("outputs"); setExpandedRun(payload.run.id); setNotice("Generation complete.");
    } catch (error) { fail(error); } finally { setGenerating(false); }
  }
  async function signOut() { await supabase.auth.signOut(); router.push("/login"); router.refresh(); }

  return <div className="studio-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon">P<span>·</span></span><div><strong>POPUP.NYC</strong><small>CHAIN STUDIO</small></div></div>
      <div className="sidebar-section-head"><span>YOUR CHAINS</span><button title="Create chain" aria-label="Create chain" onClick={beginCreateChain}><CirclePlus size={18} /></button></div>
      <nav className="chain-nav" aria-label="Prompt chains">{chains.map(chain => <button key={chain.id} onClick={() => choose(chain)} className={chain.id === selectedId && !creatingChain ? "selected" : ""}><span className="chain-initial">{chain.slug.charAt(0).toUpperCase()}</span><span><strong>{chain.slug}</strong><small>{steps.filter(step => step.humor_flavor_id === chain.id).length} steps</small></span><ChevronRight size={15}/></button>)}{!chains.length && <p className="side-empty">Create your first chain to begin.</p>}</nav>
      <div className="sidebar-bottom"><div className="theme-switch" aria-label="Appearance"><Sun size={15}/><select value={theme} onChange={event => setTheme(event.target.value as typeof theme)} aria-label="Color mode"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select><Moon size={15}/></div><div className="user-line"><span className="avatar">{userEmail.charAt(0).toUpperCase()}</span><span title={userEmail}>{userEmail}</span><button onClick={signOut}>Sign out</button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><span>WORKSPACE</span><ChevronRight size={14}/><strong>{creatingChain ? "New chain" : selected?.slug ?? "No chain selected"}</strong></div><span className="topbar-private">● SUPERADMIN WORKSPACE</span></header>
      <div className="content"><div className="page-intro"><div><p className="eyebrow">PROMPT OPERATIONS / WORKSPACE</p><h1>Chain studio<span className="period">.</span></h1><p>Build a sequence, pass its output forward, and see what it makes.</p></div><button className="outline new-chain" onClick={beginCreateChain}><CirclePlus size={17}/> New chain</button></div>
      {notice && <div role="status" className="notice"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={16}/></button></div>}
      {creatingChain ? <section className="chain-form panel"><div className="panel-heading"><div><p className="eyebrow">CREATE / CHAIN</p><h2>Start a new chain</h2></div><button className="icon-button" onClick={() => { setCreatingChain(false); setEditingChain(false); if (selected) setChainDraft({ slug: selected.slug, description: selected.description ?? "" }); }}><X size={18}/></button></div><label>Chain name<input autoFocus value={chainDraft.slug} onChange={event => setChainDraft({ ...chainDraft, slug: event.target.value })} placeholder="e.g. Image to captions" maxLength={100}/></label><label>Description<textarea value={chainDraft.description} onChange={event => setChainDraft({ ...chainDraft, description: event.target.value })} placeholder="What does this chain produce?" rows={3}/></label><div className="form-actions"><button className="primary" disabled={busy} onClick={saveChain}><Save size={16}/>{busy ? "Saving…" : "Create chain"}</button></div></section> : selected ? <>
      <section className="chain-hero"><div className="hero-top"><span className="chain-badge">CHAIN {String(selected.id).padStart(3,"0")}</span><span>{chainSteps.length} STEPS · {chainRuns.length} RUNS</span></div>{editingChain ? <div className="hero-edit"><label>Name<input value={chainDraft.slug} onChange={event => setChainDraft({ ...chainDraft, slug: event.target.value })}/></label><label>Description<textarea rows={2} value={chainDraft.description} onChange={event => setChainDraft({ ...chainDraft, description: event.target.value })}/></label><div className="hero-actions"><button className="primary" disabled={busy} onClick={saveChain}><Check size={16}/>Save changes</button><button className="outline" onClick={() => setEditingChain(false)}>Cancel</button></div></div> : <><h2>{selected.slug}</h2><p>{selected.description || "Add a description to explain what this chain creates."}</p><div className="hero-actions"><button className="outline" onClick={() => setEditingChain(true)}>Edit chain</button><button className="text-danger" onClick={deleteChain} disabled={busy}><Trash2 size={15}/> Delete</button></div></>}</section>
      <div className="tabs"><button className={activeTab === "builder" ? "active" : ""} onClick={() => setActiveTab("builder")}>Builder <span>{chainSteps.length}</span></button><button className={activeTab === "outputs" ? "active" : ""} onClick={() => setActiveTab("outputs")}>Generated ideas <span>{chainRuns.length}</span></button></div>
      {activeTab === "builder" ? <div className="workspace-grid"><section className="steps-column"><div className="section-heading"><div><h3>Prompt steps</h3></div><button className="outline" onClick={() => openStep("new")}><CirclePlus size={16}/> Add step</button></div><p className="section-copy">Each step receives the previous step’s result. Use the arrows to change its place in the chain.</p>{chainSteps.map((step, index) => <article className="step-card" key={step.id}><div className="step-rail"><span>{String(index + 1).padStart(2,"0")}</span>{index < chainSteps.length - 1 && <i/>}</div><div className="step-body"><div className="step-top"><div><span className="step-label">STEP {index + 1}{step.is_hidden ? " · PAUSED" : ""}</span><h4>{step.description || `Untitled step ${index + 1}`}</h4></div><div className="step-controls"><button aria-label={`Move step ${index + 1} up`} title="Move up" disabled={busy || index === 0} onClick={() => moveStep(index,-1)}><ArrowUp size={16}/></button><button aria-label={`Move step ${index + 1} down`} title="Move down" disabled={busy || index === chainSteps.length - 1} onClick={() => moveStep(index,1)}><ArrowDown size={16}/></button></div></div><p>{step.llm_user_prompt || "No instruction yet"}</p><div className="step-foot"><span>{models.find(model => model.id === step.llm_model_id)?.name || "Default model"}</span><div><button onClick={() => openStep(step)}>Edit step <ArrowUpRight size={14}/></button><button className="delete-small" aria-label={`Delete step ${index + 1}`} onClick={() => deleteStep(step)}><Trash2 size={14}/></button></div></div></div></article>)}{!chainSteps.length && <div className="empty-card"><div className="empty-icon">01</div><h4>No steps yet</h4><p>Add a prompt step to give this chain its first instruction.</p><button className="primary" onClick={() => openStep("new")}>Add first step →</button></div>}</section><aside className="run-column"><div className="run-card"><h3>Run a generation</h3><p>Enter a starting idea, an image URL, or both. Active steps run in sequence.</p><label>Starting text<textarea rows={4} value={textInput} onChange={event => setTextInput(event.target.value)} placeholder="Describe the input or paste an idea…" maxLength={4000}/></label><label><span><ImageIcon size={15}/> Image URL <em>optional</em></span><input type="url" value={imageUrl} onChange={event => setImageUrl(event.target.value)} placeholder="https://example.com/image.jpg"/></label><button className="primary run-button" disabled={generating || !chainSteps.some(step => !step.is_hidden)} onClick={generate}><Play size={16} fill="currentColor"/>{generating ? "Running steps…" : "Generate idea"}</button><small>Text output is saved with every step’s result.</small></div></aside></div> : <section className="output-section"><div className="section-heading"><div><p className="eyebrow">CHAIN OUTPUT / HISTORY</p><h3>Generated ideas</h3></div><span>{chainRuns.length} RUNS</span></div>{runError && <p className="error-copy">Run history unavailable: {runError}. Apply the run-history SQL migration.</p>}{chainRuns.map(run => <article className="output-card" key={run.id}><button className="output-main" onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}><span className={`status-dot ${run.status}`}/><span><small>{new Date(run.created_at).toLocaleString()} · {run.status.toUpperCase()}</small><strong>{run.output_text || run.error || "Generation in progress"}</strong><em>{run.input_text || run.input_image_url || "Image input"}</em></span><ChevronRight size={18} className={expandedRun === run.id ? "rotated" : ""}/></button>{expandedRun === run.id && <div className="output-detail">{run.input_image_url && <a target="_blank" rel="noreferrer" href={run.input_image_url}>View input image <ArrowUpRight size={14}/></a>}{(run.step_outputs ?? []).map((item,index) => <div key={`${run.id}-${index}`}><small>STEP {index + 1} · {item.description}</small><p>{item.output}</p></div>)}</div>}</article>)}{!chainRuns.length && !runError && <div className="empty-card"><div className="empty-icon">✦</div><h4>No output yet</h4><p>Run this chain to see its results here.</p><button className="primary" onClick={() => setActiveTab("builder")}>Go to builder →</button></div>}</section>}
      </> : <div className="empty-card"><div className="empty-icon">✦</div><h4>Your workspace is ready</h4><p>Create a chain to start building a sequence of prompts.</p><button className="primary" onClick={beginCreateChain}>Create a chain →</button></div>}
      </div>
    </main>
    {stepEditor && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setStepEditor(null); }}><section className="step-modal" role="dialog" aria-modal="true" aria-labelledby="step-modal-title"><div className="modal-header"><div><p className="eyebrow">{stepEditor === "new" ? "CREATE / STEP" : "EDIT / STEP"}</p><h2 id="step-modal-title">{stepEditor === "new" ? "Add a prompt step" : "Edit prompt step"}</h2></div><button className="icon-button" aria-label="Close" onClick={() => setStepEditor(null)}><X size={20}/></button></div><div className="modal-fields"><label>Step name<input autoFocus value={stepDraft.description ?? ""} onChange={event => setStepDraft({ ...stepDraft, description: event.target.value })} placeholder="e.g. Describe the image"/></label><label>System instruction<textarea rows={3} value={stepDraft.llm_system_prompt ?? ""} onChange={event => setStepDraft({ ...stepDraft, llm_system_prompt: event.target.value })} placeholder="Set the role and style for this step…"/></label><label>Prompt instruction <span className="required">*</span><textarea rows={5} value={stepDraft.llm_user_prompt ?? ""} onChange={event => { setStepDraft({ ...stepDraft, llm_user_prompt: event.target.value }); setStepError(null); }} placeholder="What should this step do with the input?"/></label><div className="field-row"><label>Model reference<select value={stepDraft.llm_model_id ?? ""} onChange={event => setStepDraft({ ...stepDraft, llm_model_id: event.target.value ? Number(event.target.value) : null })}><option value="">Default model</option>{models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label><label>Temperature<input type="number" min="0" max="2" step="0.1" value={stepDraft.llm_temperature ?? ""} onChange={event => setStepDraft({ ...stepDraft, llm_temperature: event.target.value ? Number(event.target.value) : null })} placeholder="Default"/></label></div><label className="checkbox-label"><input type="checkbox" checked={stepDraft.is_hidden} onChange={event => setStepDraft({ ...stepDraft, is_hidden: event.target.checked })}/><span>Pause this step during generation</span></label></div><div className="modal-footer">{stepError && <p className="step-feedback" role="alert">{stepError}</p>}<button className="outline" onClick={() => setStepEditor(null)}>Cancel</button><button className="primary" disabled={busy} onClick={saveStep}><Save size={16}/>{busy ? "Saving…" : "Save step"}</button></div></section></div>}
  </div>;
}
