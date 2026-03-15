const { supabase } = require('../lib/supabase')

async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, profile_image_url, email_notification, created_at, updated_at')

  if (error) {
    const e = new Error(error.message)
    e.code = error.code
    throw e
  }
  else {
    return data ?? []
  }
}

module.exports = {
  getAllUsers,
}