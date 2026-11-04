import { getSuperadmin } from "@/lib/auth";
import type { Step } from "@/lib/types";

export const maxDuration = 300;

function outputText(payload: { output_text?: string; output?: { content?: { type?: string; text?: string }[] }[] }) {
  return payload.output_text?.trim() || payload.output?.flatMap(item => item.content ?? []).filter(item => item.type === "output_text").map(item => item.text ?? "").join("\n").trim() || "";
}

export async function POST(request: Request) {
  const { supabase, user, authorized } = await getSuperadmin();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!authorized) return Response.json({ error: "Superadmin access required." }, { status: 403 });
  let input: { chainId?: number; text?: string; imageUrl?: string };
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const chainId = Number(input.chainId);
  const text = String(input.text ?? "").trim();
  const imageUrl = String(input.imageUrl ?? "").trim();
  if (!Number.isSafeInteger(chainId) || chainId < 1 || (!text && !imageUrl) || text.length > 4000 || imageUrl.length > 2048 || (imageUrl && !/^https:\/\//i.test(imageUrl))) {
    return Response.json({ error: "Provide text or an HTTPS image URL." }, { status: 400 });
  }
  const { data: chain } = await supabase.from("humor_flavors").select("id,slug").eq("id", chainId).single();
  if (!chain) return Response.json({ error: "Chain not found." }, { status: 404 });
  const { data: rawSteps, error: stepsError } = await supabase.from("humor_flavor_steps").select("*").eq("humor_flavor_id", chainId).eq("is_hidden", false).order("order_by");
  if (stepsError) return Response.json({ error: stepsError.message }, { status: 500 });
  const steps = (rawSteps ?? []) as Step[];
  if (!steps.length || steps.length > 12) return Response.json({ error: "A chain needs between 1 and 12 active steps." }, { status: 400 });
  const modelIds = steps.map(step => step.llm_model_id).filter((id): id is number => id !== null);
  const { data: models } = modelIds.length
    ? await supabase.from("llm_models").select("id,provider_model_id").in("id", modelIds)
    : { data: [] as { id: number; provider_model_id: string }[] };
  const gatewayToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!gatewayToken) return Response.json({ error: "AI Gateway authentication is not configured on this deployment." }, { status: 503 });
  const { data: run, error: runError } = await supabase.from("prompt_chain_runs").insert({ humor_flavor_id: chainId, profile_id: user.id, input_text: text || null, input_image_url: imageUrl || null }).select("id").single();
  if (runError || !run) return Response.json({ error: runError?.message ?? "Could not create run." }, { status: 500 });
  const outputs: { step_id: number; description: string; output: string }[] = [];
  let previous = text;
  try {
    for (const [index, step] of steps.entries()) {
      const content: ({ type: "input_text"; text: string } | { type: "input_image"; image_url: string })[] = [
        { type: "input_text", text: `${step.llm_user_prompt || "Complete this step using the input."}\n\n${index ? "Previous step output" : "Initial input"}:\n${previous || "See attached image."}` },
      ];
      if (index === 0 && imageUrl) content.push({ type: "input_image", image_url: imageUrl });
      const selectedModel = models?.find(model => model.id === step.llm_model_id)?.provider_model_id;
      const model = selectedModel?.includes("/") ? selectedModel
        : selectedModel?.startsWith("gpt-") ? `openai/${selectedModel}`
        : selectedModel?.startsWith("gemini-") ? `google/${selectedModel}`
        : process.env.AI_GATEWAY_MODEL || "google/gemini-3.6-flash";
      const result = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${gatewayToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, instructions: step.llm_system_prompt || "Follow the user's instructions precisely. Return only the requested result.", input: [{ role: "user", content }], max_output_tokens: 1000, ...(step.llm_temperature !== null && /^gpt-/i.test(model) ? { temperature: step.llm_temperature } : {}) }),
        signal: AbortSignal.timeout(45000),
      });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error?.message || `Generation failed at step ${index + 1}.`);
      previous = outputText(payload);
      if (!previous) throw new Error(`Step ${index + 1} returned no text.`);
      outputs.push({ step_id: step.id, description: step.description || `Step ${index + 1}`, output: previous });
    }
    const { data: completed, error } = await supabase.from("prompt_chain_runs").update({ status: "completed", output_text: previous, step_outputs: outputs, completed_at: new Date().toISOString() }).eq("id", run.id).select("*").single();
    if (error) throw error;
    return Response.json({ run: completed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    await supabase.from("prompt_chain_runs").update({ status: "failed", error: message, step_outputs: outputs, completed_at: new Date().toISOString() }).eq("id", run.id);
    return Response.json({ error: message }, { status: 500 });
  }
}
