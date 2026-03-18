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
