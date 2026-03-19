import { supabase } from "../lib/supabase";

export async function getAllUsers() {
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, email, name, profile_image_url, email_notification, created_at, updated_at",
    );

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function withdraw(userId: string) {
  const { error } = await supabase.rpc("withdraw_user_hard_delete", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }
  return { ok: true as const };
}
