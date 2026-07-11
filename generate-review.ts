import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

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
  } catch (err) {
    console.error("❌ Failed to initialize Gemini AI SDK:", err);
  }
}

// Rate Limiting & Spam Protection State
// NOTE: Vercel serverless functions are stateless between cold starts, so this
// in-memory limiter only protects within a single warm instance. For robust
// rate limiting across all instances, use a shared store (e.g. Upstash/Redis).
const ipRequestLog: Record<string, number[]> = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 15; // 15 requests per minute

const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  if (!ipRequestLog[ip]) {
    ipRequestLog[ip] = [];
  }
  ipRequestLog[ip] = ipRequestLog[ip].filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);

  if (ipRequestLog[ip].length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  ipRequestLog[ip].push(now);
  return true;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientIp = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown") as string;

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
      return res.status(200).json({ review: generatedText, provider: "Gemini AI" });
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      // Fallback on error so application flow never breaks for the user
    }
  }

  // 2. High-Quality Local Mock Fallback if Gemini is not available or failed
  const isHinglish = /mili|tha|accha|bohot|badhiya|place|mast|sahi|hai|gaya|karvaya|hai/i.test(additionalComments || "");
  const isMarathi = /चांगली|उत्कृष्ट|मस्त|आवडले|होती|होते|केले/i.test(additionalComments || "");
  const isHindi = /अच्छा|बहुत|बढ़िया|उत्कृष्ट|सेवा|गया/i.test(additionalComments || "");

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

  return res.status(200).json({ review, provider: "Shorly Local Engine (Simulated Fallback)" });
}