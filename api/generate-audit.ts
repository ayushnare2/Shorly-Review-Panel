import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

// Initialize Gemini SDK safely if key is available (same pattern as generate-review.ts)
let aiClient: any = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  } catch (err) {
    console.error("❌ Failed to initialize Gemini AI SDK:", err);
  }
}

// Server-side Supabase client. Vercel exposes ALL env vars to serverless
// functions via process.env (the VITE_ prefix only matters for client bundling),
// so we reuse the exact same variable names already used in health.ts.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
const supabase = isSupabaseConfigured ? createClient(supabaseUrl as string, supabaseAnonKey as string) : null;

const DAYS_IN_WINDOW = 30;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { businessId } = req.body;

  if (!businessId) {
    return res.status(400).json({ error: "businessId is required to generate an audit." });
  }

  if (!isSupabaseConfigured || !supabase) {
    return res.status(503).json({ error: "Supabase is not configured on the server. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY." });
  }

  try {
    const windowStart = new Date(Date.now() - DAYS_IN_WINDOW * 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch the business profile
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (bizError) throw bizError;
    if (!business) {
      return res.status(404).json({ error: "Business not found." });
    }

    // 2. Fetch blocked/private feedback (1-3 star, existing "feedback" table)
    const { data: feedbackRows, error: feedbackError } = await supabase
      .from("feedback")
      .select("*")
      .eq("business_id", businessId)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false });

    if (feedbackError) throw feedbackError;
    const blockedFeedback = feedbackRows || [];

    // 3. Fetch public conversion events (4-5 star, existing "review_logs" table)
    const { data: logRows, error: logError } = await supabase
      .from("review_logs")
      .select("*")
      .eq("business_id", businessId)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false });

    if (logError) throw logError;
    const publishedLogs = logRows || [];

    // 4. Fetch AI-generated positive review text (existing "ai_generations" table)
    const { data: genRows, error: genError } = await supabase
      .from("ai_generations")
      .select("*")
      .eq("business_id", businessId)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false });

    if (genError) throw genError;
    const publishedReviewTexts = (genRows || []).map((g: any) => g.generated_text).filter(Boolean);

    const blockedCount = blockedFeedback.length;
    const publishedCount = publishedLogs.length;

    // Rough estimated star-rating impact avoided: assume every blocked 1-3★
    // review would otherwise have landed on Google's public average.
    const estimatedRatingDelta = blockedCount > 0
      ? (blockedCount / Math.max(publishedCount + blockedCount, 1) * 5).toFixed(2)
      : "0.00";

    const blockedReviewsText = blockedFeedback
      .map((f: any) => `- [${f.rating}★, ${f.category || "general"}] "${f.feedback}"`)
      .join("\n") || "No blocked reviews in this period.";

    const publishedReviewsText = publishedReviewTexts.length > 0
      ? publishedReviewTexts.map((t: string) => `- "${t}"`).join("\n")
      : "No AI-generated public review text captured in this period.";

    const reportingPeriod = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Build the structured audit system prompt
    const systemPrompt = `You are an expert SaaS product strategist and data analyst producing a premium,
paid monthly consulting report ($500/month tier quality) for a business client
who subscribes to a review-funnel platform. The platform blocks 1-3 star reviews
from going public and routes them privately to the owner, while 4-5 star reviews
are polished and published to Google.

Client name: ${business.name}
Reporting period: ${reportingPeriod}
Blocked (private) reviews count: ${blockedCount}
Published (public) reviews count: ${publishedCount}
Estimated star-rating impact avoided: ${estimatedRatingDelta}

Blocked (private) review text:
${blockedReviewsText}

Published (public) review text:
${publishedReviewsText}

Produce a report with exactly these four sections, in this order:

1. DAMAGE PREVENTED
   - State ${blockedCount} reviews were intercepted before going public.
   - Estimate the Google star-rating impact avoided.
   - Frame this explicitly as ROI proof for the subscription cost.

2. HIDDEN VULNERABILITY ANALYSIS
   - Read all blocked review text. Identify and rank the top 3 recurring
     operational themes (e.g. staffing, wait times, order accuracy, quality issues, cleanliness).
   - For each theme: give a one-line description and cite how many complaints relate to it.
   - If there is not enough blocked review text to identify themes, say so plainly instead of inventing patterns.

3. CORE BRAND STRENGTHS
   - Read all published review text. Identify the top 3 things customers praise most,
     with a representative paraphrased theme for each (do not quote reviews verbatim).
   - If there is not enough published review text, say so plainly instead of inventing patterns.

4. THIS MONTH'S 3-STEP ACTION PLAN
   - Give exactly 3 concrete, practical, low-cost actions the owner can take in the next 30 days,
     each tied to a vulnerability found in section 2 where possible.
   - Each action should have: what to do, who owns it, and how to know it worked.

Formatting rules:
- Write like a professional consultant, not a chatbot. No filler, no hedging.
- Use clear section headers and short paragraphs or bullet points.
- Never fabricate numbers — only use the data provided above.
- Keep total length to roughly 400-600 words so it's skimmable by a busy owner.`;

    // 5. Generate the report with Gemini if configured
    if (aiClient) {
      try {
        const response = await aiClient.models.generateContent({
          model: "gemini-3.5-flash",
          contents: systemPrompt,
          config: {
            temperature: 0.6,
          }
        });

        const reportText = response.text?.trim() || "";
        if (reportText) {
          return res.status(200).json({ reportText, provider: "Gemini AI" });
        }
      } catch (err: any) {
        console.error("Gemini API Error (audit):", err);
        // Fall through to local fallback so the feature never fully breaks
      }
    }

    // 6. Local fallback report if Gemini is not configured or failed
    const fallbackReport = `MONTHLY AI REVIEW & OPERATIONS AUDIT
Client: ${business.name}
Period: ${reportingPeriod}

1. DAMAGE PREVENTED
${blockedCount} review(s) were intercepted before reaching Google this period, protecting your public rating from an estimated ${estimatedRatingDelta}-star impact.

2. HIDDEN VULNERABILITY ANALYSIS
${blockedReviewsText}

3. CORE BRAND STRENGTHS
${publishedReviewsText}

4. THIS MONTH'S 3-STEP ACTION PLAN
- Review the private feedback above with your team this week.
- Follow up personally with any customer who left contact details.
- Re-check this audit next month to track whether recurring issues are improving.

(Generated by Shorly Local Engine — Gemini API key not configured or unavailable.)`;

    return res.status(200).json({ reportText: fallbackReport, provider: "Shorly Local Engine (Simulated Fallback)" });

  } catch (err: any) {
    console.error("Audit generation failed:", err);
    return res.status(500).json({ error: err.message || "Failed to generate audit report." });
  }
}