export type Chain = { id: number; slug: string; description: string | null; is_pinned: boolean; created_datetime_utc: string; modified_datetime_utc: string };
export type Step = { id: number; humor_flavor_id: number; order_by: number; description: string | null; llm_model_id: number | null; llm_system_prompt: string | null; llm_user_prompt: string | null; llm_temperature: number | null; is_hidden: boolean };
export type Model = { id: number; name: string; provider_model_id: string };
export type Run = { id: string; humor_flavor_id: number; input_text: string | null; input_image_url: string | null; output_text: string | null; step_outputs: { step_id: number; description: string; output: string }[]; status: "running" | "completed" | "failed"; error: string | null; created_at: string };
