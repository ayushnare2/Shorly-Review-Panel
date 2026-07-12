import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK safely if key is available
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
    console.log("✅ Gemini AI SDK initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize Gemini AI SDK:", err);
  }
} else {
  console.log("ℹ️ No GEMINI_API_KEY found in env. Running review generator with premium local fallbacks.");
}

// Initialize Resend safely if key is available
let resendClient: Resend | null = null;
if (process.env.RESEND_API_KEY) {
  try {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log("✅ Resend Email Service initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize Resend:", err);
  }
} else {
  console.log("ℹ️ No RESEND_API_KEY found in env. Running email alerts in simulation mode (printed to logs).");
}

// Initialize Supabase server-side client for the AI Business Audit route.
// Reuses the same VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY vars already
// used by the frontend and health.ts (Vite's VITE_ prefix only matters for
// client bundling, process.env still has these values on the server).
const auditSupabaseUrl = process.env.VITE_SUPABASE_URL;
const auditSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const isAuditSupabaseConfigured = !!(auditSupabaseUrl && auditSupabaseAnonKey);
const auditSupabase = isAuditSupabaseConfigured
  ? createClient(auditSupabaseUrl as string, auditSupabaseAnonKey as string)
  : null;

// Rate Limiting & Spam Protection State
const ipRequestLog: Record<string, number[]> = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 15; // 15 requests per minute

const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  if (!ipRequestLog[ip]) {
    ipRequestLog[ip] = [];
  }
  // Filter out expired timestamps
  ipRequestLog[ip] = ipRequestLog[ip].filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (ipRequestLog[ip].length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  ipRequestLog[ip].push(now);
  return true;
};

// ==========================================
// API ENDPOINTS
// ==========================================

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    resendConfigured: !!process.env.RESEND_API_KEY,
    supabaseConfigured: !!process.env.VITE_SUPABASE_URL,
    timestamp: new Date().toISOString()
  });
});

// MULTILINGUAL AI REVIEW ENGINE ENDPOINT
app.post("/api/generate-review", async (req, res) => {
  const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown") as string;
  
  // Rate limiting check
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: "Rate limit exceeded. Please wait a moment before requesting another generation." });
  }

  const {
    businessName,
    businessType,
    location,
    service,
    likedAspect,
    staffName,
    additionalComments,
    style // short, detailed, professional, friendly, local
  } = req.body;

  if (!businessName) {
    return res.status(400).json({ error: "Business name is required for generation." });
  }

  // 1. If Gemini API is configured, run AI generation
  if (aiClient) {
    try {
      const prompt = `
Generate a natural, authentic Google review for the business: "${businessName}".
Business Type: ${businessType || "Establishment"}
Location: ${location || "Local area"}
Service used: ${service || "General services"}
What the customer liked most: ${likedAspect || "Excellent quality, service, and attention to detail"}
Staff member name (optional, mention only if provided): ${staffName || ""}
Additional thoughts / raw comments from the customer: "${additionalComments || ""}"
Review Style: ${style || "friendly"} (choices: short, detailed, professional, friendly, local)

CRITICAL INSTRUCTIONS:
1. LANGUAGE DETECTION: Analyze the raw comment "${additionalComments || ""}" and detect if the customer has written in Hinglish, Hindi, Marathi, or English. Generate the entire review in THAT SAME DETECTED LANGUAGE/DIALECT naturally.
2. If Hinglish is detected (e.g. "service mast tha", "accha laga", "bohot sahi place hai"), write the entire review in Hinglish using the Latin/English alphabet (e.g. "Shorly badhiya place hai! Main hair cut ke liye gaya tha, staff is very polite and friendly. Location is super convenient. Bilkul value for money hai!").
3. Avoid robotic phrases like "As a valued customer...", "This establishment...", "I highly recommend...", or repetitive marketing SEO spam. It must sound 100% like a real local customer.
4. Keep paragraphing natural. If style is "short", generate 1-2 powerful sentences. If "detailed", write 3-4 descriptive sentences outlining the service and atmosphere.
5. Return ONLY the final generated review string. No preamble, no post-text, no surrounding quotation marks.
`;

      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 1.0,
          systemInstruction: "You are a master of local restaurant, salon, and retail reviews. Your reviews sound perfectly authentic, human, slightly casual, and never spammy or written by AI. You seamlessly adopt Hinglish, Hindi, Marathi, or English based on the input text.",
        }
      });

      const generatedText = response.text?.trim() || "";
      return res.json({ review: generatedText, provider: "Gemini AI" });
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      // Fallback on error so application flow never breaks for the user
    }
  }

  // 2. High-Quality Local Mock Fallback if Gemini is not available or failed
  // This ensures a beautiful user experience without keys!
  const isHinglish = /mili|tha|accha|bohot|badhiya|place|mast|sahi|hai|gaya|karvaya|hai/i.test(additionalComments || "");
  const isMarathi = /चांगली|उत्कृष्ट|मस्त|आवडले|होती|होते|केले/i.test(additionalComments || "");
  const isHindi = /अच्छा|बहुत|बढ़िया|उत्कृष्ट|सेवा|गया/i.test(additionalComments || "");

  let review = "";
  if (isMarathi) {
    if (style === "short") {
      review = `${businessName} मधील अनुभव खूपच छान होता! त्यांची सेवा अतिशय जलद आणि उत्कृष्ट आहे. नक्कीच भेट द्या.`;
    } else if (style === "detailed") {
      review = `${businessName} मध्ये गेलो होतो आणि मला तिथली ${service || "सेवा"} खूप आवडली. विशेषतः ${likedAspect || "तिथले वातावरण आणि नम्र वागणूक"} मनाला भिडली. सर्व कर्मचारी अत्यंत काळजीपूर्वक काम करतात. ${location ? `ही ${location} मधील सर्वोत्तम जागा आहे!` : "नक्कीच शिफारस करेन!"}`;
    } else if (style === "professional") {
      review = `${businessName} ची सेवा अत्यंत व्यावसायिक आणि शिस्तबद्ध आहे. वेळेचे अचूक नियोजन आणि उच्च दर्जाचे काम ही त्यांची वैशिष्ट्ये आहेत. अत्यंत समाधानी.`;
    } else {
      review = `${businessName} मध्ये एकदम घरगुती आणि मस्त वातावरण असते! ${staffName ? `${staffName} ने खूप छान सर्व्हिस दिली, धन्यवाद!` : "कर्मचारी खूप मनमोकळे आहेत."} माझी ${service || "सेवा"} अतिशय सुंदर झाली. पुन्हा नक्की येणार!`;
    }
  } else if (isHinglish) {
    if (style === "short") {
      review = `${businessName} is simply amazing! Service bahut fast aur sahi thi. Highly recommend!`;
    } else if (style === "detailed") {
      review = `Bohot hi badhiya experience raha ${businessName} mein. Maine yahan ${service || "unki service"} try ki aur quality ekdum top-notch thi. ${staffName ? `${staffName} ne bohot ache se handle kiya.` : "Staff ka behavior bohot polite tha."} ${location ? `${location} ki best jagah hai boss!` : ""} Value for money!`;
    } else if (style === "professional") {
      review = `${businessName} stands out for their absolute professionalism. The process was highly structured and execution was flawless. Definitely 5 stars.`;
    } else {
      review = `${businessName} jaake maza aa gaya! Atmosphere bohot cool hai aur log bhi bohot friendly hain. ${service || "Work"} ekdum perfect hua. Must visit place guys!`;
    }
  } else if (isHindi) {
    if (style === "short") {
      review = `${businessName} की सर्विस वाकई बहुत लाजवाब है! स्टाफ बहुत अच्छा है। जरूर जाएं।`;
    } else if (style === "detailed") {
      review = `${businessName} में मेरा अनुभव बेहद शानदार रहा। मैंने यहाँ ${service || "सर्विस"} ली और गुणवत्ता उत्कृष्ट थी। ${staffName ? `${staffName} का व्यवहार बेहद सराहनीय था।` : "सबका बर्ताव काफी दोस्ताना था।"} ${location ? `${location} में इससे अच्छी जगह नहीं मिलेगी।` : "मैं इसे पूरी तरह से रेकमेंड करूँगा।"}`;
    } else if (style === "professional") {
      review = `${businessName} पर दी जाने वाली सेवा पूरी तरह से पेशेवर और उत्कृष्ट है। समय की पाबंदी और उच्च स्तरीय तकनीक का तालमेल शानदार है।`;
    } else {
      review = `${businessName} में आकर दिल खुश हो गया! माहौल बहुत प्यारा है और सर्विस भी कमाल की है। ${service || "काम"} एकदम बढ़िया तरीके से किया। अगली बार फिर आऊंगा।`;
    }
  } else {
    // English default
    if (style === "short") {
      review = `Absolutely loved my experience at ${businessName}! The ${service || "service"} was top-notch and super quick.`;
    } else if (style === "detailed") {
      review = `Had an incredible visit to ${businessName}. I tried their ${service || "service"} and was thoroughly impressed by the attention to detail. ${staffName ? `Special thanks to ${staffName} for the amazing support.` : "The entire staff was incredibly polite and helpful."} ${location ? `Easily the finest establishment in ${location}.` : ""} Definitely coming back!`;
    } else if (style === "professional") {
      review = `${businessName} provides an exceptionally professional and seamless experience. High standards of cleanliness, skilled staff, and pristine execution. Highly recommended for premium service.`;
    } else if (style === "local") {
      review = `Super glad I found ${businessName}. It has a great neighborhood vibe and the quality is outstanding. ${service || "Everything"} was done perfectly, and the price is very fair. Support local businesses!`;
    } else {
      review = `Such a warm and friendly atmosphere at ${businessName}! They did a fantastic job with my ${service || "request"}. ${likedAspect ? `Really appreciated the ${likedAspect}.` : ""} Definitely check them out!`;
    }
  }

  // Return generated review with simulated indicator
  return res.json({ review, provider: "Shorly Local Engine (Simulated Fallback)" });
});

// MONTHLY AI REVIEW & OPERATIONS AUDIT ENDPOINT
app.post("/api/generate-audit", async (req, res) => {
  const { businessId } = req.body;

  if (!businessId) {
    return res.status(400).json({ error: "businessId is required to generate an audit." });
  }

  if (!isAuditSupabaseConfigured || !auditSupabase) {
    return res.status(503).json({ error: "Supabase is not configured on the server. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY." });
  }

  try {
    const DAYS_IN_WINDOW = 30;
    const windowStart = new Date(Date.now() - DAYS_IN_WINDOW * 24 * 60 * 60 * 1000).toISOString();

    const { data: business, error: bizError } = await auditSupabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (bizError) throw bizError;
    if (!business) {
      return res.status(404).json({ error: "Business not found." });
    }

    const { data: feedbackRows, error: feedbackError } = await auditSupabase
      .from("feedback")
      .select("*")
      .eq("business_id", businessId)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false });

    if (feedbackError) throw feedbackError;
    const blockedFeedback = feedbackRows || [];

    const { data: logRows, error: logError } = await auditSupabase
      .from("review_logs")
      .select("*")
      .eq("business_id", businessId)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false });

    if (logError) throw logError;
    const publishedLogs = logRows || [];

    const { data: genRows, error: genError } = await auditSupabase
      .from("ai_generations")
      .select("*")
      .eq("business_id", businessId)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false });

    if (genError) throw genError;
    const publishedReviewTexts = (genRows || []).map((g: any) => g.generated_text).filter(Boolean);

    const blockedCount = blockedFeedback.length;
    const publishedCount = publishedLogs.length;
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
          return res.json({ reportText, provider: "Gemini AI" });
        }
      } catch (err: any) {
        console.error("Gemini API Error (audit):", err);
      }
    }

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

    return res.json({ reportText: fallbackReport, provider: "Shorly Local Engine (Simulated Fallback)" });

  } catch (err: any) {
    console.error("Audit generation failed:", err);
    return res.status(500).json({ error: err.message || "Failed to generate audit report." });
  }
});

// PRIVATE FEEDBACK EMAIL NOTIFICATION ENDPOINT
app.post("/api/send-feedback-email", async (req, res) => {
  const {
    businessName,
    rating,
    feedbackText,
    category,
    customerName,
    customerPhone,
    ownerEmail,
    previewMode
  } = req.body;

  if (!ownerEmail || !feedbackText) {
    return res.status(400).json({ error: "Missing required details to send email alerts." });
  }

  const timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  
  // Dynamic HTML Template inspired by Linear/Stripe style
  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Shorly Alert - Urgent Feedback</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px; color: #111827; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; }
          .header { background-color: #000000; padding: 32px; color: #ffffff; display: flex; align-items: center; justify-content: space-between; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em; }
          .header .tag { background-color: #fcd34d; color: #111827; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; }
          .content { padding: 40px; }
          .rating-bar { display: flex; align-items: center; margin-bottom: 24px; }
          .rating-stars { color: #f59e0b; font-size: 24px; margin-right: 12px; font-weight: bold; }
          .rating-label { font-size: 14px; color: #6b7280; font-weight: 500; }
          .feedback-quote { background-color: #f9fafb; border-left: 4px solid #111827; padding: 20px; margin-bottom: 32px; border-radius: 0 8px 8px 0; }
          .feedback-quote p { margin: 0; font-size: 16px; line-height: 1.6; color: #374151; font-style: italic; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
          .meta-table th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; padding-bottom: 8px; font-weight: 600; width: 40%; }
          .meta-table td { font-size: 14px; color: #111827; padding-bottom: 16px; font-weight: 500; }
          .meta-table tr:last-child td, .meta-table tr:last-child th { padding-bottom: 0; }
          .footer { background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center; }
          .footer p { margin: 0; font-size: 12px; color: #9ca3af; }
          .footer a { color: #111827; text-decoration: underline; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Shorly Smart Funnel</h1>
            <div class="tag">Urgent Feedback</div>
          </div>
          <div class="content">
            <h2 style="font-size: 22px; font-weight: 700; letter-spacing: -0.025em; margin-top: 0; margin-bottom: 8px;">
              New Customer Alert: ${businessName}
            </h2>
            <p style="font-size: 15px; color: #4b5563; margin-top: 0; margin-bottom: 32px;">
              A customer left negative private feedback through your NFC review card/QR portal. It has been captured privately to prevent public ratings on Google.
            </p>

            <div class="rating-bar">
              <div class="rating-stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
              <div class="rating-label">${rating} Out of 5 Stars (Category: ${category.toUpperCase()})</div>
            </div>

            <div class="feedback-quote">
              <p>"${feedbackText}"</p>
            </div>

            <table class="meta-table">
              <tr>
                <th>Customer Name</th>
                <td>${customerName}</td>
              </tr>
              <tr>
                <th>Customer Phone</th>
                <td>${customerPhone}</td>
              </tr>
              <tr>
                <th>Submission Time</th>
                <td>${timestamp} IST</td>
              </tr>
              <tr>
                <th>Action Required</th>
                <td style="color: #b91c1c; font-weight: bold;">Reach out to recover this customer!</td>
              </tr>
            </table>
          </div>
          <div class="footer">
            <p>Sent automatically by <a href="https://shorly.co">Shorly Smart Review Funnel</a>.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  // 1. Send via Resend if credentials are set
  if (resendClient) {
    try {
      const data = await resendClient.emails.send({
        from: "Shorly Alerts <alerts@shorly.co>",
        to: [ownerEmail],
        subject: `🚨 Urgent: ${rating}-Star Customer Feedback for ${businessName}`,
        html: emailHtml,
      });
      console.log(`✉️ Real Email sent to ${ownerEmail} via Resend. ID:`, data.data?.id);
      return res.json({ success: true, method: "Resend", emailId: data.data?.id });
    } catch (err: any) {
      console.error("Resend API Error:", err);
      // Fallback to logs if email delivery fails
    }
  }

  // 2. Beautiful developer logs simulation (No Keys fallback)
  console.log("\n==========================================================");
  console.log(`✉️  SIMULATED EMAIL NOTIFICATION FOR ${businessName.toUpperCase()}`);
  console.log("==========================================================");
  console.log(`To:         ${ownerEmail}`);
  console.log(`Subject:    🚨 Urgent: ${rating}-Star Customer Feedback for ${businessName}`);
  console.log(`Rating:     ${rating} Stars / 5`);
  console.log(`Category:   ${category}`);
  console.log(`Customer:   ${customerName} (${customerPhone})`);
  console.log(`Feedback:   "${feedbackText}"`);
  console.log("==========================================================\n");

  return res.json({
    success: true,
    method: "Simulation (No Resend Key)",
    simulationLog: {
      to: ownerEmail,
      subject: `🚨 Urgent: ${rating}-Star Customer Feedback for ${businessName}`,
      rating,
      category,
      customerName,
      customerPhone,
      feedback: feedbackText,
      timestamp
    }
  });
});

// ==========================================
// VITE AND STATIC ASSETS SERVING MIDDLEWARE
// ==========================================

const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    // Development mode: mount Vite dev server as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("🚀 Vite Dev Middleware mounted.");
  } else {
    // Production mode: serve compiled static assets
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("📦 Production static assets mounted.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌍 Shorly Smart Review Funnel running at http://0.0.0.0:${PORT}`);
  });
};

startServer().catch(err => {
  console.error("Fatal Server Startup Error:", err);
});