const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_PROJECT_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_API_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase 설정이 없습니다. SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_API_KEY를 .env에 설정하세요.")
}

/** 백엔드 전용 Supabase 클라이언트 */
const supabase = createClient(supabaseUrl, supabaseServiceKey)

module.exports = { supabase }