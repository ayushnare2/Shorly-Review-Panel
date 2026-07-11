import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Star, 
  ArrowRight, 
  Sparkles, 
  MessageSquare, 
  Copy, 
  Check, 
  RefreshCw, 
  MapPin, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Smile, 
  Frown, 
  Briefcase, 
  Heart, 
  User, 
  AlertCircle 
} from "lucide-react";
import { Business, Feedback, ReviewLog, AIGeneration } from "../types";
import { api } from "../lib/supabase";

interface ReviewFunnelProps {
  business: Business;
  onBackToAdmin?: () => void;
}

type FunnelStep = 'rating' | 'feedback_form' | 'feedback_success' | 'positive_options' | 'ai_config' | 'ai_generation' | 'ai_result';

export default function ReviewFunnel({ business, onBackToAdmin }: ReviewFunnelProps) {
  // Navigation & State
  const [step, setStep] = useState<FunnelStep>('rating');
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);

  // Private Feedback States
  const [feedbackCategory, setFeedbackCategory] = useState<Feedback['category']>('service');
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [honeypot, setHoneypot] = useState(""); // Spam protection
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Review Customization States
  const [selectedStyle, setSelectedStyle] = useState<'short' | 'detailed' | 'professional' | 'friendly' | 'local'>('friendly');
  const [serviceUsed, setServiceUsed] = useState("");
  const [likedMost, setLikedMost] = useState("");
  const [staffName, setStaffName] = useState("");
  const [additionalComments, setAdditionalComments] = useState("");
  const [aiReviewResult, setAiReviewResult] = useState("");
  const [aiProvider, setAiProvider] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Anti-Spam / Rate Limiting (Session count of AI reviews generated)
  const [aiGenerationCount, setAiGenerationCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  // Quick select items based on business type
  const defaultServices = business.services && business.services.length > 0 
    ? business.services 
    : ["General Service", "Customer Support", "Standard Consultation"];

  const defaultLikedAspects = [
    "Amazing Customer Service",
    "Extremely Professional Staff",
    "Clean & Beautiful Ambience",
    "Outstanding Value for Money",
    "Prompt & Quick Delivery"
  ];

  // Handle Initial Rating Tap
  const handleRatingSelect = (selectedRating: number) => {
    setRating(selectedRating);
    setErrorMsg("");
    
    // Smooth navigation delay
    setTimeout(() => {
      if (selectedRating >= 4) {
        setStep('positive_options');
      } else {
        setStep('feedback_form');
      }
    }, 450);
  };

  // Submit Private Feedback (1-3 Stars)
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) {
      setErrorMsg("Feedback message is required.");
      return;
    }

    // Spam honeypot trigger
    if (honeypot) {
      console.warn("Spam honeypot triggered.");
      setStep('feedback_success'); // Pretend success to fool spammers
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      // 1. Log Feedback to Supabase
      await api.submitFeedback({
        business_id: business.id,
        rating,
        name: customerName.trim() || undefined,
        phone: customerPhone.trim() || undefined,
        feedback: feedbackMessage,
        category: feedbackCategory
      });

      // 2. Log conversion type to audit logs
      await api.logReview({
        business_id: business.id,
        rating,
        review_type: 'direct',
        language: 'en'
      });

      setStep('feedback_success');
    } catch (err: any) {
      console.error("Feedback submit error:", err);
      setErrorMsg("Could not submit feedback. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate AI Review (4-5 Stars)
  const generateAIReview = async () => {
    // Session-based rate limit
    if (aiGenerationCount >= 5) {
      setErrorMsg("Maximum of 5 AI generations per session exceeded.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg("");
    setStep('ai_generation');

    try {
      const response = await fetch("/api/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: business.name,
          businessType: business.business_type,
          location: business.location,
          service: serviceUsed || undefined,
          likedAspect: likedMost || undefined,
          staffName: staffName || undefined,
          additionalComments: additionalComments || undefined,
          style: selectedStyle
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Generation failed.");
      }

      setAiReviewResult(data.review);
      setAiProvider(data.provider);
      setAiGenerationCount(prev => prev + 1);
      
      // Save AI generation log to database
      await api.logAIGeneration({
        business_id: business.id,
        prompt: JSON.stringify({ style: selectedStyle, service: serviceUsed, comments: additionalComments }),
        generated_text: data.review,
        style: selectedStyle
      });

      setStep('ai_result');
    } catch (err: any) {
      console.error("AI Review error:", err);
      setErrorMsg("Failed to generate AI review. Please write manually or try again.");
      setStep('ai_config');
    } finally {
      setIsGenerating(false);
    }
  };

  // Logging Direct Click on Google Review Link
  const handleDirectReviewClick = async () => {
    try {
      await api.logReview({
        business_id: business.id,
        rating,
        review_type: 'direct',
        language: 'en'
      });
    } catch (e) {
      console.error("Logging direct click failed:", e);
    }
    window.open(business.google_review_link, "_blank", "noopener,noreferrer");
  };

  // Logging AI-Generated Review Click on Google
  const handleAIClickToGoog = async () => {
    try {
      await api.logReview({
        business_id: business.id,
        rating,
        review_type: 'ai',
        language: 'en'
      });
    } catch (e) {
      console.error("Logging AI click failed:", e);
    }
    // Copy automatically on redirect to maximize conversion
    handleCopyToClipboard();
    window.open(business.google_review_link, "_blank", "noopener,noreferrer");
  };

  // Copy Review to Clipboard
  const handleCopyToClipboard = () => {
    if (!aiReviewResult) return;
    navigator.clipboard.writeText(aiReviewResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="review-funnel-container" className="min-h-screen bg-[#0A0A0A] flex flex-col justify-between p-4 sm:p-6 md:p-8 select-none font-sans antialiased text-white">
      
      {/* Top Floating Logo & Controls */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between pb-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center text-black font-mono font-bold text-sm tracking-tighter shadow-[0_0_12px_rgba(250,204,21,0.25)]">S</div>
          <span className="text-sm font-bold tracking-tight text-white">Shorly <span className="text-yellow-400">Smart Funnel</span></span>
        </div>
        {onBackToAdmin && (
          <button 
            id="back-to-admin-btn"
            onClick={onBackToAdmin}
            className="text-[10px] uppercase tracking-wider font-mono px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all font-medium flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            Exit Preview
          </button>
        )}
      </div>

      {/* Main Funnel Card Frame (Apple/Linear inspired mobile layout) */}
      <div className="flex-grow flex items-center justify-center py-4">
        <div id="funnel-card" className="w-full max-w-md bg-[#121214]/60 border border-white/10 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden relative flex flex-col min-h-[500px] justify-between">
          
          <AnimatePresence mode="wait">
            
            {/* STEP 1: INITIAL STAR RATING */}
            {step === 'rating' && (
              <motion.div
                key="step-rating"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="p-6 sm:p-8 flex-grow flex flex-col justify-center items-center text-center space-y-8 animate-fade-in"
              >
                {/* Business Info Header */}
                <div className="space-y-4">
                  {business.logo_url ? (
                    <img 
                      src={business.logo_url} 
                      alt={business.name} 
                      className="w-20 h-20 mx-auto rounded-2xl object-cover border border-white/10 shadow-sm bg-neutral-900"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl font-bold text-gray-400">
                      {business.name.substring(0, 1)}
                    </div>
                  )}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono tracking-widest text-yellow-400 uppercase font-bold">{business.business_type}</span>
                    <h2 className="text-2xl font-bold tracking-tight text-white px-4">{business.name}</h2>
                    {business.location && (
                      <div className="flex items-center justify-center text-xs text-gray-400 gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-500" />
                        <span>{business.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Star Selector Panel */}
                <div className="space-y-4 w-full">
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-gray-400">How was your experience today?</p>
                    <p className="text-lg font-bold text-white">Rate your experience</p>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 py-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        id={`star-btn-${star}`}
                        type="button"
                        onClick={() => handleRatingSelect(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="p-1 sm:p-1.5 focus:outline-none focus:scale-110 active:scale-95 transition-all transform hover:scale-110 duration-150 cursor-pointer"
                        aria-label={`Rate ${star} star`}
                      >
                        <Star 
                          className={`w-10 h-10 transition-colors duration-200 ${
                            star <= (hoveredRating || rating) 
                              ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]" 
                              : "text-white/20"
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  {/* Micro-text description based on rating */}
                  <div className="h-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {hoveredRating === 5 || rating === 5 ? <span className="text-yellow-400 flex items-center justify-center gap-1"><Smile className="w-3.5 h-3.5" /> Perfect Experience!</span> : ""}
                    {hoveredRating === 4 || rating === 4 ? <span className="text-yellow-400 flex items-center justify-center gap-1"><Smile className="w-3.5 h-3.5" /> Good Experience</span> : ""}
                    {hoveredRating === 3 || rating === 3 ? <span className="text-gray-400 flex items-center justify-center gap-1"><Frown className="w-3.5 h-3.5 text-gray-400" /> Average</span> : ""}
                    {hoveredRating === 2 || rating === 2 ? <span className="text-red-400 flex items-center justify-center gap-1"><Frown className="w-3.5 h-3.5 text-red-400" /> Disappointed</span> : ""}
                    {hoveredRating === 1 || rating === 1 ? <span className="text-red-400 flex items-center justify-center gap-1"><Frown className="w-3.5 h-3.5 text-red-400" /> Terrible experience</span> : ""}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2A: PRIVATE FEEDBACK FORM (1-3 STARS) */}
            {step === 'feedback_form' && (
              <motion.div
                key="step-feedback"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="p-6 sm:p-8 flex-grow flex flex-col justify-between"
              >
                <div className="space-y-6">
                  {/* Warning Header */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono tracking-widest uppercase font-bold px-2.5 py-1.5 rounded-full bg-white/10 text-gray-300 inline-block">Private Feedback Channel</span>
                    <h3 className="text-2xl font-bold tracking-tight text-white">We are sorry your experience wasn't great.</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">Your message will go directly to the owner privately so we can immediately address and resolve the issue.</p>
                  </div>

                  <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                    {/* Category Selector */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">What went wrong?</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { key: 'service', label: 'Service' },
                          { key: 'staff', label: 'Staff' },
                          { key: 'product', label: 'Product' },
                          { key: 'cleanliness', label: 'Cleanliness' },
                          { key: 'pricing', label: 'Pricing' },
                          { key: 'other', label: 'Other' }
                        ] as const).map((cat) => (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => setFeedbackCategory(cat.key)}
                            className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-all text-center cursor-pointer ${
                              feedbackCategory === cat.key 
                                ? "bg-yellow-400 border-yellow-400 text-black shadow-[0_0_10px_rgba(250,204,21,0.25)]" 
                                : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Feedback Message */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Your Feedback *</label>
                      <textarea
                        id="feedback-message-input"
                        rows={3}
                        required
                        placeholder="Tell us what happened so we can make it right..."
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        className="w-full text-sm p-3 rounded-2xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 resize-none font-medium text-white placeholder-gray-500"
                      />
                    </div>

                    {/* Contact details (Optional) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Name (Optional)</label>
                        <input
                          id="feedback-name-input"
                          type="text"
                          placeholder="Your Name"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full text-xs p-3 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 font-medium text-white placeholder-gray-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Phone (Optional)</label>
                        <input
                          id="feedback-phone-input"
                          type="tel"
                          placeholder="Your Phone"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full text-xs p-3 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 font-medium text-white placeholder-gray-500"
                        />
                      </div>
                    </div>

                    {/* Honeypot field (invisible to users to prevent automated bot spam) */}
                    <input 
                      type="text" 
                      name="website" 
                      value={honeypot} 
                      onChange={(e) => setHoneypot(e.target.value)} 
                      className="hidden" 
                      tabIndex={-1} 
                      autoComplete="off" 
                    />

                    {errorMsg && (
                      <div className="p-3 rounded-xl bg-red-500/10 text-red-400 text-xs font-medium flex items-center gap-2 border border-red-500/20">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}
                  </form>
                </div>

                {/* Form Navigation Buttons */}
                <div className="pt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('rating')}
                    className="flex-1 py-3.5 text-sm font-semibold rounded-2xl border border-white/10 text-gray-300 hover:bg-white/10 active:scale-95 transition-all cursor-pointer bg-white/5"
                  >
                    Back
                  </button>
                  <button
                    id="submit-feedback-btn"
                    type="button"
                    onClick={handleFeedbackSubmit}
                    disabled={isSubmitting}
                    className="flex-1 py-3.5 text-sm font-semibold rounded-2xl bg-yellow-400 text-black hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(250,204,21,0.25)] cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Feedback
                        <ArrowRight className="w-4 h-4 text-black stroke-[3px]" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2B: FEEDBACK SUCCESS SCREEN */}
            {step === 'feedback_success' && (
              <motion.div
                key="step-feedback-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="p-8 flex-grow flex flex-col justify-center items-center text-center space-y-6"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)] animate-bounce">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold tracking-tight text-white">Feedback Submitted!</h3>
                  <p className="text-sm text-gray-400 leading-relaxed max-w-[280px] mx-auto">
                    Thank you. Your feedback has been logged privately and the management team has been notified to look into this urgently.
                  </p>
                </div>
                
                <div className="pt-4 w-full">
                  <button
                    id="finish-btn"
                    onClick={() => {
                      setRating(0);
                      setStep('rating');
                      setFeedbackMessage("");
                      setCustomerName("");
                      setCustomerPhone("");
                    }}
                    className="w-full py-3.5 text-sm font-semibold rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors shadow-sm cursor-pointer"
                  >
                    Finish
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: POSITIVE REVIEW SELECTION (4-5 STARS) */}
            {step === 'positive_options' && (
              <motion.div
                key="step-positive-options"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="p-6 sm:p-8 flex-grow flex flex-col justify-center space-y-6"
              >
                <div className="space-y-2 text-center pb-4">
                  <span className="text-[10px] font-mono tracking-widest font-bold uppercase px-2.5 py-1.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 inline-block shadow-[0_0_10px_rgba(250,204,21,0.05)]">Awesome Experience!</span>
                  <h3 className="text-2xl font-bold tracking-tight text-white">We are glad you enjoyed your experience!</h3>
                  <p className="text-sm text-gray-400 leading-relaxed px-4">Your support helps other local customers find us. Choose how you want to leave a review:</p>
                </div>

                <div className="space-y-3">
                  {/* Option B: AI Generation (Primary) */}
                  <button
                    id="ai-review-btn"
                    onClick={() => setStep('ai_config')}
                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-between group shadow-sm cursor-pointer text-left backdrop-blur-md"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.1)]">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                          Generate AI Review
                        </p>
                        <p className="text-xs text-gray-400 font-medium">Auto-detects language and builds a custom review</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </button>

                  {/* Option A: Direct Review (Secondary) */}
                  <button
                    id="direct-review-btn"
                    onClick={handleDirectReviewClick}
                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-between group cursor-pointer text-left backdrop-blur-md"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold tracking-tight text-white">Write My Own Review</p>
                        <p className="text-xs text-gray-400 font-medium">Open Google directly to write your comments</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setStep('rating')}
                  className="w-full py-3 text-xs font-semibold text-gray-500 hover:text-gray-300 transition-colors pt-4 text-center cursor-pointer font-mono uppercase tracking-widest"
                >
                  Change Rating
                </button>
              </motion.div>
            )}

            {/* STEP 4: AI CUSTOMIZER FORM */}
            {step === 'ai_config' && (
              <motion.div
                key="step-ai-config"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="p-6 sm:p-8 flex-grow flex flex-col justify-between scrollbar-thin overflow-y-auto max-h-[580px]"
              >
                <div className="space-y-5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-yellow-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 fill-yellow-400 text-yellow-400 animate-pulse" /> Shorly AI review assistant
                    </span>
                    <h3 className="text-xl font-bold tracking-tight text-white">Personalize Your Review</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">Fill in any details (all optional) to make your generated review highly unique and perfect.</p>
                  </div>

                  <div className="space-y-3 text-left">
                    {/* Style Selection */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Review Style</label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {([
                          { key: 'friendly', label: 'Friendly', icon: Smile },
                          { key: 'detailed', label: 'Detailed', icon: Heart },
                          { key: 'short', label: 'Short', icon: MessageSquare },
                          { key: 'professional', label: 'Professional', icon: Briefcase },
                          { key: 'local', label: 'Local', icon: MapPin }
                        ] as const).map((styleOpt) => (
                          <button
                            key={styleOpt.key}
                            type="button"
                            onClick={() => setSelectedStyle(styleOpt.key)}
                            className={`py-2 px-0.5 text-[10px] font-bold rounded-lg border transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${
                              selectedStyle === styleOpt.key 
                                ? "bg-yellow-400 border-yellow-400 text-black shadow-[0_0_10px_rgba(250,204,21,0.25)]" 
                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                            }`}
                          >
                            <styleOpt.icon className="w-3.5 h-3.5" />
                            {styleOpt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Service selection */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">What service did you get?</label>
                      <div className="flex flex-wrap gap-1.5 py-1">
                        {defaultServices.map((srv) => (
                          <button
                            key={srv}
                            type="button"
                            onClick={() => setServiceUsed(serviceUsed === srv ? "" : srv)}
                            className={`py-1.5 px-3 text-xs rounded-full border transition-all cursor-pointer ${
                              serviceUsed === srv 
                                ? "bg-white border-white text-black" 
                                : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                            }`}
                          >
                            {srv}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Aspect selection */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">What did you like most?</label>
                      <div className="flex flex-wrap gap-1.5 py-1">
                        {defaultLikedAspects.map((asp) => (
                          <button
                            key={asp}
                            type="button"
                            onClick={() => setLikedMost(likedMost === asp ? "" : asp)}
                            className={`py-1.5 px-3 text-xs rounded-full border transition-all cursor-pointer ${
                              likedMost === asp 
                                ? "bg-white border-white text-black" 
                                : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                            }`}
                          >
                            {asp}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Staff name */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Staff Member Name (Optional)</label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input
                          id="staff-name-input"
                          type="text"
                          placeholder="e.g. Rahul, Priya, David"
                          value={staffName}
                          onChange={(e) => setStaffName(e.target.value)}
                          className="w-full text-xs p-2.5 pl-9 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 font-medium text-white placeholder-gray-500"
                        />
                      </div>
                    </div>

                    {/* Additional raw comments */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
                        Additional Comments & Language <span className="text-yellow-400 font-semibold">(Type in Hinglish, Marathi, Hindi or English!)</span>
                      </label>
                      <textarea
                        id="additional-comments-input"
                        rows={2}
                        placeholder="e.g. 'Haircut bohot badhiya kiya!' or 'सेवा उत्तम होती'"
                        value={additionalComments}
                        onChange={(e) => setAdditionalComments(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 resize-none font-medium text-white placeholder-gray-500"
                      />
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-red-500/10 text-red-400 text-xs font-medium flex items-center gap-2 border border-red-500/20">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('positive_options')}
                    className="flex-1 py-3.5 text-sm font-semibold rounded-2xl border border-white/10 text-gray-300 hover:bg-white/10 active:scale-95 transition-all cursor-pointer bg-white/5"
                  >
                    Back
                  </button>
                  <button
                    id="trigger-ai-review-btn"
                    type="button"
                    onClick={generateAIReview}
                    disabled={isGenerating}
                    className="flex-1 py-3.5 text-sm font-semibold rounded-2xl bg-yellow-400 text-black hover:bg-yellow-300 active:scale-95 transition-all flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(250,204,21,0.25)] cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-black animate-pulse" />
                    Generate Review
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 5: AI GENERATING SKELETON LOADER */}
            {step === 'ai_generation' && (
              <motion.div
                key="step-ai-generation"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-8 flex-grow flex flex-col justify-center items-center text-center space-y-6 animate-fade-in"
              >
                <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-yellow-400 relative">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <Sparkles className="w-4 h-4 absolute top-1 right-1 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-bold tracking-tight text-white">Shorly AI is thinking...</h4>
                  <p className="text-xs text-gray-400 max-w-[200px] mx-auto">Detecting input language & assembling your unique Google review.</p>
                </div>

                {/* Animated skeletons */}
                <div className="w-full space-y-2 max-w-[280px] pt-4">
                  <div className="h-4 bg-white/5 border border-white/5 rounded-full w-full animate-pulse" />
                  <div className="h-4 bg-white/5 border border-white/5 rounded-full w-5/6 animate-pulse" />
                  <div className="h-4 bg-white/5 border border-white/5 rounded-full w-4/6 animate-pulse" />
                </div>
              </motion.div>
            )}

            {/* STEP 6: AI GENERATED REVIEW DISPLAY */}
            {step === 'ai_result' && (
              <motion.div
                key="step-ai-result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="p-6 sm:p-8 flex-grow flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-400/10 text-yellow-400 font-bold flex items-center gap-1.5 shadow-sm border border-yellow-400/20">
                      <Sparkles className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" /> Generated Review
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">Via {aiProvider}</span>
                  </div>

                  {/* Generated Text Card */}
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-5 relative min-h-[140px] flex flex-col justify-between">
                    <p className="text-sm text-gray-200 font-medium leading-relaxed italic text-left select-text">
                      "{aiReviewResult}"
                    </p>
                    <div className="pt-4 flex justify-end">
                      <button
                        id="copy-review-btn"
                        onClick={handleCopyToClipboard}
                        className="py-1.5 px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-xs font-semibold flex items-center gap-1.5 text-gray-300 shadow-sm cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-400" />
                            <span className="text-green-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-gray-400" />
                            <span>Copy Review</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Instructional guide */}
                  <div className="p-3 bg-yellow-400/10 rounded-xl border border-yellow-400/20 flex items-start gap-2 text-left shadow-[0_0_15px_rgba(250,204,21,0.05)] animate-pulse">
                    <Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-yellow-400 font-semibold leading-normal">
                      We've automatically copied this to your clipboard! Now click below to open Google Reviews and simply paste it!
                    </p>
                  </div>
                </div>

                <div className="pt-6 space-y-2.5">
                  <button
                    id="continue-to-google-btn"
                    onClick={handleAIClickToGoog}
                    className="w-full py-4 rounded-2xl bg-yellow-400 text-black hover:bg-yellow-300 active:scale-95 transition-all font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(250,204,21,0.25)] cursor-pointer"
                  >
                    <span>Continue to Google Reviews</span>
                    <ArrowRight className="w-4 h-4 text-black stroke-[3px]" />
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep('ai_config')}
                      className="flex-1 py-3 text-xs font-semibold rounded-xl border border-white/10 text-gray-300 hover:bg-white/10 transition-all flex items-center justify-center gap-1 cursor-pointer bg-white/5"
                    >
                      Customize Style
                    </button>
                    <button
                      id="regenerate-review-btn"
                      type="button"
                      onClick={generateAIReview}
                      className="flex-1 py-3 text-xs font-semibold rounded-xl border border-white/10 text-gray-300 hover:bg-white/10 transition-all flex items-center justify-center gap-1 cursor-pointer bg-white/5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Regenerate
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
          
          {/* Subtle Secure Footer */}
          <div className="py-3 px-6 bg-black/40 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-500 font-mono">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
              100% Secure Privacy Funnel
            </span>
            <span>SHORLY © 2026</span>
          </div>

        </div>
      </div>

    </div>
  );
}
