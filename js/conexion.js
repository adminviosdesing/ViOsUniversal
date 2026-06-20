// js/conexion.js
const SUPABASE_URL = "https://lxaqeuzxluhrzblzxcmj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Z6xScqkE_UKWp5cwybd_0g_t31WCrTT"; // REEMPLAZA CON TU KEY REAL

window.db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);