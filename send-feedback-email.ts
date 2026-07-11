import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";

// Initialize Resend safely if key is available
let resendClient: Resend | null = null;
if (process.env.RESEND_API_KEY) {
  try {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  } catch (err) {
    console.error("❌ Failed to initialize Resend:", err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
      return res.status(200).json({ success: true, method: "Resend", emailId: data.data?.id });
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

  return res.status(200).json({
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
}