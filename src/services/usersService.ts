const { supabase } = require("../lib/supabase");

export async function getAllUsers() {
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, email, name, profile_image_url, email_notification, created_at, updated_at",
    );

  if (error as Error) {
    throw new Error(error.message);
  } else {
    return data ?? [];
  }
}
