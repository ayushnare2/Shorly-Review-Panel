import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: "ok",
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    resendConfigured: !!process.env.RESEND_API_KEY,
    supabaseConfigured: !!process.env.VITE_SUPABASE_URL,
    timestamp: new Date().toISOString()
  });
}