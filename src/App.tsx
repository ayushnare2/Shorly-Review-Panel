import React, { useState, useEffect } from "react";
import AdminPanel from "./components/AdminPanel";
import ReviewFunnel from "./components/ReviewFunnel";
import { Business } from "./types";
import { api } from "./lib/supabase";
import { RefreshCw, Building2, AlertCircle, Sparkles, Smartphone } from "lucide-react";
import { isSupabaseConfigured } from "./lib/supabase";

export default function App() {
  // Routing States
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(false);
  const [errorText, setErrorText] = useState("");
  console.log("Supabase:", isSupabaseConfigured);

  // Handle URL Path changes
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    // Listen to back/forward button events
    window.addEventListener("popstate", handleLocationChange);
    
    // Custom event listener for custom pushState navigation
    window.addEventListener("pushstate-nav", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("pushstate-nav", handleLocationChange);
    };
  }, []);

  // Resolve Business Slug if routing matches /business/:slug
  useEffect(() => {
    const parts = currentPath.split("/").filter(Boolean);
    
    if (parts[0] === "business" && parts[1]) {
      const slug = parts[1];
      setLoadingBusiness(true);
      setErrorText("");
      
      api.getBusinessBySlug(slug)
        .then((biz) => {
          if (biz) {
            setActiveBusiness(biz);
          } else {
            setErrorText(`We couldn't find a business profile with the identifier "${slug}".`);
          }
        })
        .catch((err) => {
          console.error("Error fetching business by slug:", err);
          setErrorText("Something went wrong while loading this review portal.");
        })
        .finally(() => {
          setLoadingBusiness(false);
        });
    } else {
      // Clear active business if we navigate back to home/admin
      setActiveBusiness(null);
    }
  }, [currentPath]);

  // Navigate helper (custom history router)
  const navigateTo = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
    // Dispatch custom event to trigger state updates if needed
    window.dispatchEvent(new Event("pushstate-nav"));
  };

  // Simulated NFC tap callback from Admin Simulator
  const handleLaunchFunnel = (business: Business) => {
    navigateTo(`/business/${business.slug}`);
  };

  // Exit preview and go back to admin sandbox
  const handleBackToAdmin = () => {
    navigateTo("/");
  };

  // ==========================================
  // RENDER DECISION
  // ==========================================

  // 1. Loading Business State (Skeleton loader)
  if (loadingBusiness) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col justify-center items-center p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200/85 p-8 text-center space-y-6 shadow-xl animate-pulse">
          <div className="w-20 h-20 bg-neutral-100 rounded-2xl mx-auto" />
          <div className="space-y-3">
            <div className="h-4 bg-neutral-100 rounded-full w-24 mx-auto" />
            <div className="h-6 bg-neutral-100 rounded-full w-48 mx-auto" />
            <div className="h-4 bg-neutral-100 rounded-full w-36 mx-auto" />
          </div>
          <div className="pt-8 space-y-4">
            <div className="h-10 bg-neutral-100 rounded-xl w-full" />
            <div className="h-24 bg-neutral-100 rounded-xl w-full" />
          </div>
          <div className="pt-6 flex justify-center gap-2">
            <RefreshCw className="w-5 h-5 text-neutral-400 animate-spin" />
            <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Syncing NFC Review Tunnel...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Error / 404 Business Profile State
  if (errorText) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col justify-center items-center p-6 font-sans antialiased text-neutral-900">
        <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 p-8 text-center space-y-6 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 text-red-500 flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tight text-neutral-900">Portal Not Found</h3>
            <p className="text-sm text-neutral-500 leading-relaxed px-2">
              {errorText}
            </p>
          </div>
          
          <div className="pt-4 space-y-2">
            <button
              onClick={handleBackToAdmin}
              className="w-full py-3.5 text-sm font-semibold rounded-2xl bg-black text-white hover:bg-neutral-800 transition-all shadow-sm"
            >
              Return to Admin Workspace
            </button>
            <p className="text-[10px] text-neutral-400 font-mono">
              Ensure you have run the database setup or created this slug in the sandbox.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Customer Funnel View
  if (activeBusiness) {
    return (
      <ReviewFunnel 
        business={activeBusiness} 
        onBackToAdmin={handleBackToAdmin} 
      />
    );
  }

  // 4. Default: Admin Panel & Simulator
  return (
    <AdminPanel 
      onLaunchFunnel={handleLaunchFunnel} 
    />
  );
}
