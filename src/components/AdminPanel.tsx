import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Building2, 
  MessageSquareOff, 
  Sparkles, 
  BarChart3, 
  Plus, 
  Edit3, 
  Trash2, 
  QrCode, 
  Smartphone, 
  Send, 
  Globe, 
  Mail, 
  Phone, 
  ExternalLink, 
  Check, 
  Layers, 
  Tag, 
  Star, 
  RefreshCw, 
  AlertCircle,
  MapPin,
  User
} from "lucide-react";
import { Business, Feedback, ReviewLog, AIGeneration } from "../types";
import { api, isSupabaseConfigured } from "../lib/supabase";

interface AdminPanelProps {
  onLaunchFunnel: (business: Business) => void;
}

type ActiveTab = 'businesses' | 'feedback' | 'analytics' | 'instructions';

export default function AdminPanel({ onLaunchFunnel }: AdminPanelProps) {
  // DB States
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [reviewLogs, setReviewLogs] = useState<ReviewLog[]>([]);
  const [aiGenerations, setAiGenerations] = useState<AIGeneration[]>([]);
  const [loading, setLoading] = useState(true);

  // Active UI States
  const [activeTab, setActiveTab] = useState<ActiveTab>('businesses');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  
  // Create / Edit Business Form Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formBusinessId, setFormBusinessId] = useState("");
  const [formName, setFormName] = useState("");
  const [formLogoUrl, setFormLogoUrl] = useState("");
  const [formType, setFormType] = useState("Restaurant / Cafe");
  const [formGoogleLink, setFormGoogleLink] = useState("");
  const [formOwnerEmail, setFormOwnerEmail] = useState("");
  const [formOwnerWhatsapp, setFormOwnerWhatsapp] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formServices, setFormServices] = useState(""); // Comma separated
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Copy success tooltips
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Initial Fetch
  const fetchData = async () => {
    setLoading(true);
    try {
      const bList = await api.getBusinesses();
      setBusinesses(bList);
      if (bList.length > 0 && !selectedBusiness) {
        setSelectedBusiness(bList[0]);
      }
      
      const fList = await api.getFeedback();
      setFeedback(fList);

      const rList = await api.getReviewLogs();
      setReviewLogs(rList);

      const aList = await api.getAIGenerations();
      setAiGenerations(aList);
    } catch (e) {
      console.error("Failed to load initial workspace data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Create Business Trigger
  const handleOpenCreateModal = () => {
    setFormMode('create');
    setFormBusinessId("");
    setFormName("");
    setFormLogoUrl("");
    setFormType("Restaurant / Cafe");
    setFormGoogleLink("https://g.page/r/example-business/review");
    setFormOwnerEmail("owner@example.com");
    setFormOwnerWhatsapp("+919876543210");
    setFormLocation("Mumbai, India");
    setFormServices("Premium Service, Core Treatment, Standard Consultation");
    setFormError("");
    setShowFormModal(true);
  };

  // Handle Edit Business Trigger
  const handleOpenEditModal = (biz: Business) => {
    setFormMode('edit');
    setFormBusinessId(biz.id);
    setFormName(biz.name);
    setFormLogoUrl(biz.logo_url || "");
    setFormType(biz.business_type);
    setFormGoogleLink(biz.google_review_link);
    setFormOwnerEmail(biz.owner_email);
    setFormOwnerWhatsapp(biz.owner_whatsapp || "");
    setFormLocation(biz.location || "");
    setFormServices(biz.services ? biz.services.join(", ") : "");
    setFormError("");
    setShowFormModal(true);
  };

  // Submit Business Form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formGoogleLink.trim() || !formOwnerEmail.trim()) {
      setFormError("Business Name, Google Review Link, and Owner Email are required.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const servicesArray = formServices
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (formMode === 'create') {
        const generatedSlug = await api.generateUniqueSlug(formName);
        await api.createBusiness({
          slug: generatedSlug,
          name: formName.trim(),
          logo_url: formLogoUrl.trim() || undefined,
          business_type: formType,
          google_review_link: formGoogleLink.trim(),
          owner_email: formOwnerEmail.trim(),
          owner_whatsapp: formOwnerWhatsapp.trim() || undefined,
          location: formLocation.trim() || undefined,
          services: servicesArray
        });
      } else {
        await api.updateBusiness(formBusinessId, {
          name: formName.trim(),
          logo_url: formLogoUrl.trim() || undefined,
          business_type: formType,
          google_review_link: formGoogleLink.trim(),
          owner_email: formOwnerEmail.trim(),
          owner_whatsapp: formOwnerWhatsapp.trim() || undefined,
          location: formLocation.trim() || undefined,
          services: servicesArray
        });
      }

      await fetchData();
      setShowFormModal(false);
    } catch (err: any) {
      console.error("Save business failed:", err);
      setFormError(err.message || "Failed to save business profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Business
  const handleDeleteBusiness = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you absolutely sure you want to delete this business profile? This will cascade delete its private feedback logs.")) {
      return;
    }

    try {
      await api.deleteBusiness(id);
      if (selectedBusiness?.id === id) {
        setSelectedBusiness(null);
      }
      await fetchData();
    } catch (err) {
      console.error("Delete business failed:", err);
      alert("Failed to delete business.");
    }
  };

  // Copy simulated NFC review link to clipboard
  const handleCopyLink = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const mockUrl = `${window.location.origin}/business/${slug}`;
    navigator.clipboard.writeText(mockUrl);
    setCopiedUrl(slug);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  // Aggregated analytics values
  const totalDirectClicks = reviewLogs.filter(l => l.review_type === 'direct').length;
  const totalAIClicks = reviewLogs.filter(l => l.review_type === 'ai').length;
  const totalFeedbacks = feedback.length;
  const totalClicksAndFeedbacks = totalDirectClicks + totalAIClicks + totalFeedbacks;
  const reviewConversionRate = totalClicksAndFeedbacks > 0 
    ? Math.round(((totalDirectClicks + totalAIClicks) / totalClicksAndFeedbacks) * 100) 
    : 0;

  const negativePrivateCount = feedback.filter(f => f.rating <= 3).length;
  const publicSavedPercentage = totalClicksAndFeedbacks > 0
    ? Math.round((negativePrivateCount / totalClicksAndFeedbacks) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A] font-sans antialiased text-white flex flex-col md:flex-row border-t-2 border-yellow-400">
      
      {/* LEFT WORKSPACE PANE */}
      <div className="flex-1 p-6 md:p-8 lg:p-10 border-r border-white/10 overflow-y-auto max-h-screen bg-gradient-to-b from-[#0F0F0F] to-[#0A0A0A]">
        
        {/* Workspace Brand Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-8 border-b border-white/10 gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-lg bg-yellow-400 flex items-center justify-center text-black font-mono font-black text-base tracking-tighter shadow-[0_0_15px_rgba(250,204,21,0.3)]">S</div>
              <span className="text-xl font-bold tracking-tight text-white">Shorly <span className="text-yellow-400">Admin Panel</span></span>
            </div>
            <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Smart Review Funnel Management & Testing Environment</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-[10px] font-mono tracking-wider uppercase border ${
              isSupabaseConfigured 
                ? "bg-green-500/10 text-green-400 border-green-500/20" 
                : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shadow-[0_0_10px_rgba(250,204,21,0.05)]"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1.5 ${isSupabaseConfigured ? "bg-green-400 animate-pulse" : "bg-yellow-400 animate-pulse"}`} />
              {isSupabaseConfigured ? "SUPABASE_PROD_OK" : "LOCAL_SANDBOX_MODE"}
            </span>
            <button 
              onClick={fetchData} 
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-colors shadow-sm backdrop-blur-md"
              title="Refresh Logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workspace Tabs */}
        <div className="flex border-b border-white/10 my-6 gap-2 overflow-x-auto pb-px scrollbar-thin">
          {([
            { id: 'businesses', label: 'Business Profiles', icon: Building2 },
            { id: 'feedback', label: 'Private Feedback Feed', icon: MessageSquareOff },
            { id: 'analytics', label: 'Review Conversion Analytics', icon: BarChart3 },
            { id: 'instructions', label: 'System Setup Manual', icon: Layers }
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-4 font-bold text-xs tracking-wider uppercase transition-all relative flex items-center gap-2 -mb-px border-b-2 whitespace-nowrap ${
                activeTab === tab.id 
                  ? "border-yellow-400 text-yellow-400 text-shadow-[0_0_10px_rgba(250,204,21,0.2)]" 
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'feedback' && feedback.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-extrabold border border-red-500/30">{feedback.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* WORKSPACE CONTENT AREA */}
        <div className="space-y-6">
          
          {/* TAB 1: BUSINESS PROFILES */}
          {activeTab === 'businesses' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h3 className="text-lg font-bold tracking-tight">Configured Businesses</h3>
                  <p className="text-xs text-gray-400">Select a business profile to test or tap its simulated NFC review card on the right.</p>
                </div>
                <button
                  id="add-business-btn"
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2.5 rounded-xl bg-yellow-400 text-black hover:bg-yellow-300 transition-colors font-bold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(250,204,21,0.25)] cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3px]" />
                  Create Business
                </button>
              </div>

              {loading ? (
                <div className="p-12 text-center text-gray-400 font-medium">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-yellow-400" />
                  Loading sandbox profiles...
                </div>
              ) : businesses.length === 0 ? (
                <div className="p-12 text-center border border-white/10 rounded-3xl space-y-4 bg-white/5 backdrop-blur-md shadow-sm">
                  <Building2 className="w-12 h-12 text-gray-500 mx-auto" />
                  <div className="space-y-1">
                    <p className="font-bold text-white">No Business Profiles Configured</p>
                    <p className="text-xs text-gray-400">Create your first business to start testing the NFC and QR code review funnel.</p>
                  </div>
                  <button
                    onClick={handleOpenCreateModal}
                    className="px-4 py-2.5 rounded-xl bg-yellow-400 text-black hover:bg-yellow-300 transition-colors font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4 stroke-[3px]" />
                    Add First Business
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {businesses.map((biz) => {
                    const bizFeedback = feedback.filter(f => f.business_id === biz.id);
                    const bizLogs = reviewLogs.filter(l => l.business_id === biz.id);
                    const isSelected = selectedBusiness?.id === biz.id;

                    return (
                      <div
                        key={biz.id}
                        id={`biz-row-${biz.slug}`}
                        onClick={() => setSelectedBusiness(biz)}
                        className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          isSelected 
                            ? "border-yellow-400/60 bg-white/10 ring-1 ring-yellow-400/30 shadow-[0_0_15px_rgba(250,204,21,0.1)]" 
                            : "border-white/10 bg-white/5 hover:bg-white/10 shadow-sm backdrop-blur-md"
                        }`}
                      >
                        <div className="flex items-start space-x-4">
                          {biz.logo_url ? (
                            <img 
                              src={biz.logo_url} 
                              alt={biz.name} 
                              className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0 bg-neutral-900"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-gray-400 shrink-0 text-xl">
                              {biz.name.substring(0,1)}
                            </div>
                          )}
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-mono tracking-widest text-yellow-400 font-bold">{biz.business_type}</span>
                            <h4 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                              {biz.name}
                              {isSelected && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.8)]" />}
                            </h4>
                            <p className="text-xs text-gray-400 flex items-center gap-1 font-medium">
                              <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-500" /> {biz.location || "No address details"}
                            </p>
                          </div>
                        </div>

                        {/* Profiles Controls */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/5">
                          {/* Mini Stats */}
                          <div className="flex items-center space-x-4 text-right sm:mr-4">
                            <div className="text-center sm:text-right">
                              <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest">Saved Alerts</p>
                              <p className="text-xs font-black text-white">{bizFeedback.length}</p>
                            </div>
                            <div className="text-center sm:text-right">
                              <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest">Conversions</p>
                              <p className="text-xs font-black text-white">{bizLogs.length}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleCopyLink(biz.slug, e)}
                              className="p-2 rounded-lg border border-white/10 hover:bg-white/15 text-gray-300 transition-colors bg-white/5 shadow-sm flex items-center justify-center cursor-pointer"
                              title="Copy Customer Funnel Link"
                            >
                              {copiedUrl === biz.slug ? (
                                <Check className="w-3.5 h-3.5 text-green-400 animate-bounce" />
                              ) : (
                                <Globe className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              id={`edit-biz-btn-${biz.slug}`}
                              onClick={(e) => { e.stopPropagation(); handleOpenEditModal(biz); }}
                              className="p-2 rounded-lg border border-white/10 hover:bg-white/15 text-gray-300 transition-colors bg-white/5 shadow-sm flex items-center justify-center cursor-pointer"
                              title="Edit Business Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              id={`delete-biz-btn-${biz.slug}`}
                              onClick={(e) => handleDeleteBusiness(biz.id, e)}
                              className="p-2 rounded-lg border border-red-500/20 hover:bg-red-500/20 text-red-400 transition-colors bg-white/5 shadow-sm flex items-center justify-center cursor-pointer"
                              title="Delete Business Profile"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRIVATE FEEDBACK FEED (1-3 Stars captured privately) */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              <div className="space-y-0.5">
                <h3 className="text-lg font-bold tracking-tight">Captured Private Complaints & Feedback</h3>
                <p className="text-xs text-gray-400">Below is the record of customer ratings of 1, 2, or 3 stars. These never reached Google, keeping your public reputation clean.</p>
              </div>

              {feedback.length === 0 ? (
                <div className="p-12 text-center border border-white/10 rounded-3xl bg-white/5 backdrop-blur-md shadow-sm text-gray-400">
                  <MessageSquareOff className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <p className="font-bold text-white">No Private Customer Complaints</p>
                  <p className="text-xs">Congratulations! No 1-3 star feedback has been submitted yet.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {feedback.map((f) => {
                    const biz = businesses.find(b => b.id === f.business_id);
                    return (
                      <div key={f.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-sm space-y-4 text-left">
                        <div className="flex items-start justify-between flex-wrap gap-2">
                          <div className="space-y-1">
                            <h4 className="font-bold text-sm tracking-tight flex items-center gap-1.5 text-white">
                              {biz ? biz.name : "Unknown Business"}
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-300 font-mono uppercase tracking-wider">{f.category}</span>
                            </h4>
                            <p className="text-[10px] text-gray-500 font-mono font-semibold">
                              ID: {f.id.substring(0, 8)} • Submitted at {new Date(f.created_at).toLocaleString()}
                            </p>
                          </div>

                          {/* Red Warning rating label */}
                          <div className="flex items-center space-x-1 py-1 px-2 rounded-xl bg-red-500/10 text-red-400 font-bold text-xs border border-red-500/20">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{f.rating} Stars Private Feedback</span>
                          </div>
                        </div>

                        {/* Feedback Content Card */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5 font-medium text-gray-200 leading-relaxed text-sm select-text">
                          "{f.feedback}"
                        </div>

                        {/* Customer details for followup */}
                        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <User className="w-4 h-4 text-gray-500" />
                            Customer: {f.name || <span className="text-gray-500 font-medium italic">Anonymous</span>}
                          </span>
                          {f.phone && (
                            <span className="flex items-center gap-1.5 text-gray-200 bg-white/10 px-2 py-1 rounded-lg">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              Phone: {f.phone}
                            </span>
                          )}
                          <span className="text-yellow-400 font-bold flex items-center gap-1">
                            ⚠️ Action Needed: Customer recovery alert sent to {biz ? biz.owner_email : "management"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REVIEW CONVERSION ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="space-y-0.5">
                <h3 className="text-lg font-bold tracking-tight">Funnel Performance Metrics</h3>
                <p className="text-xs text-gray-400">Live analytics indicating conversion efficiency, AI generations, and negative review deflection.</p>
              </div>

              {/* Grid Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Metric 1 */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-sm text-left">
                  <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Total Actions</p>
                  <p className="text-3xl font-black text-white mt-1">{totalClicksAndFeedbacks}</p>
                  <p className="text-[10px] text-gray-500 mt-1.5 font-medium">Customer interactions logged</p>
                </div>

                {/* Metric 2 */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-sm text-left">
                  <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Review Clicks</p>
                  <p className="text-3xl font-black text-yellow-400 mt-1">{totalDirectClicks + totalAIClicks}</p>
                  <p className="text-[10px] text-gray-400 mt-1.5 font-medium flex items-center gap-1">
                    <span>Direct: {totalDirectClicks} • AI: {totalAIClicks}</span>
                  </p>
                </div>

                {/* Metric 3 */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-sm text-left">
                  <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Conversion Rate</p>
                  <p className="text-3xl font-black text-white mt-1">{reviewConversionRate}%</p>
                  <div className="w-full bg-white/10 rounded-full h-1.5 mt-2.5 overflow-hidden">
                    <div className="bg-yellow-400 h-1.5 rounded-full shadow-[0_0_8px_rgba(250,204,21,0.5)]" style={{ width: `${reviewConversionRate}%` }} />
                  </div>
                </div>

                {/* Metric 4 */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-sm text-left">
                  <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Negative Deflected</p>
                  <p className="text-3xl font-black text-red-400 mt-1">{negativePrivateCount}</p>
                  <p className="text-[10px] text-red-400/80 mt-1.5 font-bold">Public 1-3★ reviews blocked</p>
                </div>

              </div>

              {/* Conversion details list */}
              <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl text-left space-y-4">
                <h4 className="font-bold text-sm tracking-tight text-white">Conversion Event Stream</h4>
                {reviewLogs.length === 0 ? (
                  <p className="text-xs text-gray-500 font-medium text-center py-6">No conversions tracked yet. Simulate a 4-star or 5-star review click to see event streams.</p>
                ) : (
                  <div className="divide-y divide-white/5 max-h-[250px] overflow-y-auto pr-2 space-y-2 scrollbar-thin">
                    {reviewLogs.map((log) => {
                      const biz = businesses.find(b => b.id === log.business_id);
                      return (
                        <div key={log.id} className="pt-2 text-xs flex items-center justify-between font-semibold text-gray-300">
                          <div className="space-y-0.5">
                            <span className="text-white font-bold">{biz ? biz.name : "Unknown"}</span>
                            <p className="text-[10px] text-gray-500 font-mono">ID: {log.id.substring(0, 8)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider ${
                              log.review_type === 'ai' 
                                ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/20" 
                                : "bg-white/10 text-gray-300 border border-white/5"
                            }`}>
                              {log.review_type === 'ai' ? "AI Generated" : "Direct Click"}
                            </span>
                            <span className="text-gray-500 text-[10px] font-mono">{new Date(log.created_at).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: MANUAL / INSTRUCTIONS */}
          {activeTab === 'instructions' && (
            <div className="space-y-5 text-left leading-relaxed">
              <div className="space-y-0.5">
                <h3 className="text-lg font-bold tracking-tight">System Setup Manual</h3>
                <p className="text-xs text-gray-400">Configure your production environment (Supabase, Gemini, Resend) in less than 5 minutes.</p>
              </div>

              <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-5 space-y-4 text-xs font-semibold">
                {/* Steps */}
                <div className="space-y-3">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-white font-bold mb-1">1. Configure Supabase Environment</p>
                    <p className="text-gray-400 font-medium">To connect this client to a real Supabase Database, define the following variables in your platform settings:</p>
                    <pre className="p-2.5 bg-black/80 border border-white/10 text-yellow-400 font-mono text-[10px] rounded-lg mt-2 overflow-x-auto select-all">
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsIn..."
                    </pre>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-white font-bold mb-1">2. Run SQL Schema Script</p>
                    <p className="text-gray-400 font-medium">Go to your Supabase SQL Editor, paste the contents of `/supabase/schema.sql`, and run it. This provisions your tables, Row Level Security, indexes, and triggers automatically.</p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-white font-bold mb-1">3. Configure Gemini AI API Key</p>
                    <p className="text-gray-400 font-medium">Configure your Gemini API key in the platform's **Secrets Panel** under `GEMINI_API_KEY`. This runs the multilingual generation engine server-side safely without key exposure.</p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-white font-bold mb-1">4. Configure Resend Email alerts</p>
                    <p className="text-gray-400 font-medium">Provide `RESEND_API_KEY` in the secrets panel. This automatically triggers instant HTML email delivery to business owners the moment a complaint is recorded.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* RIGHT PREVIEW & SIMULATOR PANE */}
      <div className="w-full md:w-[420px] lg:w-[460px] bg-[#0C0C0C] text-white p-6 sm:p-8 flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/10">
        
        <div className="space-y-6 w-full max-w-sm mx-auto">
          {/* Header */}
          <div className="space-y-1 text-center sm:text-left">
            <span className="text-[10px] font-mono font-bold text-yellow-400 uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1">
              <Smartphone className="w-3.5 h-3.5 text-yellow-400" /> Physical NFC & QR Simulator
            </span>
            <h3 className="text-xl font-bold tracking-tight text-white">Shorly NFC Touch Card</h3>
            <p className="text-xs text-gray-400 leading-normal">Simulate customer actions. A customer taps their phone on the Shorly Card or scans the QR code in your store.</p>
          </div>

          {selectedBusiness ? (
            <div className="space-y-6">
              {/* Premium Vector Card Representation */}
              <div className="w-full aspect-[1.58/1] bg-gradient-to-br from-neutral-900/60 via-neutral-950/80 to-[#0A0A0A] rounded-2xl border border-white/10 p-5 relative overflow-hidden shadow-[0_0_30px_rgba(250,204,21,0.06)] flex flex-col justify-between">
                
                {/* Elegant card detailing */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-full blur-2xl" />
                
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-yellow-400 flex items-center justify-center text-black font-mono font-black text-xs tracking-tighter">S</div>
                    <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-white">SHORLY CARD</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-yellow-400/10 flex items-center justify-center text-yellow-400 text-[9px] font-bold font-mono tracking-widest border border-yellow-400/20 animate-pulse">
                    NFC
                  </div>
                </div>

                <div className="space-y-1 z-10 text-left">
                  <span className="text-[9px] font-mono font-bold text-yellow-400 uppercase tracking-widest">TAP TO REVIEW</span>
                  <h4 className="font-extrabold text-base tracking-tight text-white">{selectedBusiness.name}</h4>
                  <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0 text-gray-500" /> {selectedBusiness.location || "In-store Service"}
                  </p>
                </div>

                {/* Simulated chips & waves */}
                <div className="flex items-center justify-between border-t border-white/5 pt-3 text-[9px] text-gray-500 uppercase font-mono font-bold tracking-wide">
                  <span>SHORLY PREMIUM NFC v3.2</span>
                  <span>100% SECURE</span>
                </div>
              </div>

              {/* Action Trigger Buttons */}
              <div className="space-y-2.5">
                <button
                  id="simulate-nfc-btn"
                  onClick={() => onLaunchFunnel(selectedBusiness)}
                  className="w-full py-4 rounded-2xl bg-yellow-400 text-black font-extrabold text-sm hover:bg-yellow-300 transition-all flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(250,204,21,0.2)] cursor-pointer transform active:scale-95"
                >
                  <Smartphone className="w-4 h-4 animate-bounce text-black" />
                  <span>Tap NFC Card (Open Funnel)</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const mockUrl = `${window.location.origin}/business/${selectedBusiness.slug}`;
                      window.open(mockUrl, "_blank");
                    }}
                    className="py-3 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-white/10 cursor-pointer text-gray-200"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    Open New Tab
                  </button>

                  <button
                    onClick={() => {
                      const mockUrl = `${window.location.origin}/business/${selectedBusiness.slug}`;
                      navigator.clipboard.writeText(mockUrl);
                      alert(`Review Link Copied!\n${mockUrl}`);
                    }}
                    className="py-3 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-white/10 cursor-pointer text-gray-200"
                  >
                    <QrCode className="w-3.5 h-3.5 text-gray-400" />
                    Print QR Code
                  </button>
                </div>
              </div>

              {/* Selected Business Profile Highlights */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-xs font-semibold text-left space-y-2 text-gray-300 backdrop-blur-md">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono font-bold">Active Profile Overview</p>
                <div className="space-y-1 font-medium text-gray-300">
                  <p className="text-white font-bold flex justify-between gap-1">Slug: <span className="font-normal text-yellow-400 font-mono">/business/{selectedBusiness.slug}</span></p>
                  <p className="flex justify-between gap-1">Services: <span className="text-white font-bold text-right max-w-[180px] truncate">{selectedBusiness.services ? selectedBusiness.services.join(", ") : "None"}</span></p>
                  <p className="flex justify-between gap-1">Owner Email: <span className="text-white font-bold truncate">{selectedBusiness.owner_email}</span></p>
                  <p className="flex justify-between gap-1">WhatsApp: <span className="text-white font-bold">{selectedBusiness.owner_whatsapp || "Not set"}</span></p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
              <Smartphone className="w-10 h-10 mx-auto mb-2 text-gray-600" />
              <p className="font-bold text-sm text-gray-300">No Active Profile Selected</p>
              <p className="text-[11px] mt-1 text-gray-500">Configure or select a business in the left panel to test cards.</p>
            </div>
          )}
        </div>

        {/* Workspace Brand Footer */}
        <div className="pt-8 border-t border-white/5 text-center text-[10px] text-gray-600 font-mono uppercase tracking-widest mt-8 flex flex-col items-center gap-1">
          <span>Premium NFC Review Network</span>
          <span className="text-gray-500">Shorly Smart Funnel System © 2026</span>
        </div>

      </div>

      {/* CREATE / EDIT BUSINESS POPUP MODAL */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-[#121214]/90 border border-white/15 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col justify-between text-white"
            >
              {/* Form Modal Header */}
              <div className="p-6 bg-black/60 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    {formMode === 'create' ? "Create Business Profile" : "Edit Business Profile"}
                  </h3>
                  <p className="text-xs text-gray-400 font-mono uppercase tracking-widest">Configure review funnel destination</p>
                </div>
                <button 
                  onClick={() => setShowFormModal(false)}
                  className="text-white/60 hover:text-white font-bold text-lg p-2 focus:outline-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Form Modal Body */}
              <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[500px] overflow-y-auto text-left scrollbar-thin">
                
                {formError && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-semibold flex items-center gap-2 border border-red-500/20 animate-pulse">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Form fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Business Name *</label>
                    <input
                      id="form-business-name"
                      type="text"
                      required
                      placeholder="e.g. Royal Salon"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 font-medium text-white placeholder-gray-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Business Type</label>
                    <input
                      id="form-business-type"
                      type="text"
                      placeholder="e.g. Hair Salon, Gym, Cafe"
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 font-medium text-white placeholder-gray-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Logo Image URL</label>
                  <input
                    id="form-business-logo"
                    type="url"
                    placeholder="e.g. https://images.unsplash.com/photo-..."
                    value={formLogoUrl}
                    onChange={(e) => setFormLogoUrl(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 font-mono text-white placeholder-gray-500"
                  />
                  <p className="text-[9px] text-gray-500">Provide an Unsplash or static image link. Leave empty for default logo.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Google Review Page Link *</label>
                  <input
                    id="form-business-google-link"
                    type="url"
                    required
                    placeholder="https://g.page/r/..."
                    value={formGoogleLink}
                    onChange={(e) => setFormGoogleLink(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 font-mono text-white placeholder-gray-500"
                  />
                  <p className="text-[9px] text-gray-500">The destination URL opened when customers choose to submit Google ratings.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Owner Alert Email *</label>
                    <input
                      id="form-business-email"
                      type="email"
                      required
                      placeholder="owner@business.com"
                      value={formOwnerEmail}
                      onChange={(e) => setFormOwnerEmail(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 font-medium text-white placeholder-gray-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">WhatsApp Number</label>
                    <input
                      id="form-business-whatsapp"
                      type="tel"
                      placeholder="+919876543210"
                      value={formOwnerWhatsapp}
                      onChange={(e) => setFormOwnerWhatsapp(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 font-mono text-white placeholder-gray-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Store Location / Address</label>
                  <input
                    id="form-business-location"
                    type="text"
                    placeholder="e.g. Bandra West, Mumbai"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 font-medium text-white placeholder-gray-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Services Offered <span className="text-yellow-400 font-semibold">(Comma Separated)</span></label>
                  <textarea
                    id="form-business-services"
                    rows={2}
                    placeholder="e.g. Specialty Coffee, Woodfired Pizzas, Desserts"
                    value={formServices}
                    onChange={(e) => setFormServices(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-white/5 resize-none font-medium text-white placeholder-gray-500"
                  />
                  <p className="text-[9px] text-gray-500">Used dynamically by Gemini to construct highly authentic, tailored service-specific reviews.</p>
                </div>

              </form>

              {/* Form Modal Actions */}
              <div className="p-6 bg-black/40 border-t border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2.5 text-xs font-bold rounded-xl border border-white/10 hover:bg-white/5 transition-colors bg-white/5 text-gray-300 shadow-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="save-business-submit-btn"
                  type="button"
                  onClick={handleFormSubmit}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-50 transition-colors shadow-md flex items-center gap-1.5 cursor-pointer font-sans"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Profile"
                  )}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
