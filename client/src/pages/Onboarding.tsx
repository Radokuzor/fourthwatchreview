import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Star,
  UserPlus,
  LogIn,
  CheckCircle,
  Copy,
  ArrowRight,
  Building2,
  Mail,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

const PLATFORM_MANAGER_EMAIL = "manager@fourthwatchtech.com";

type Step = "profile" | "path" | "manager-setup" | "location" | "notifications" | "done";

export default function Onboarding() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("profile");
  const [selectedPath, setSelectedPath] = useState<"manager" | "oauth">("manager");
  const [copied, setCopied] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [approvalEmail, setApprovalEmail] = useState(user?.email || "");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [clientId, setClientId] = useState<number | null>(null);

  const createClient = trpc.clients.create.useMutation();
  const addLocation = trpc.locations.add.useMutation();

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(PLATFORM_MANAGER_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateProfile = async () => {
    if (!businessName.trim()) {
      toast.error("Please enter your business name");
      return;
    }
    try {
      const client = await createClient.mutateAsync({
        businessName: businessName.trim(),
        contactEmail: contactEmail || undefined,
        approvalEmail: approvalEmail || undefined,
        telegramChatId: telegramChatId || undefined,
        notifyTelegram,
        notifyEmail,
      });
      if (client) setClientId(client.id);
      setStep("path");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create profile";
      toast.error(msg);
    }
  };

  const handleAddLocation = async () => {
    if (!locationName.trim()) {
      toast.error("Please enter a location name");
      return;
    }
    try {
      await addLocation.mutateAsync({
        locationName: locationName.trim(),
        address: address || undefined,
        onboardingPath: selectedPath,
      });
      setStep("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add location";
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
              <Star className="w-6 h-6 text-white fill-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign in to get started</h2>
            <p className="text-gray-500 mb-6">Create your WatchReviews account to start automating review responses.</p>
            <a href="/sign-in">
              <Button className="w-full">Sign in</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Star className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="font-display font-700 text-lg text-gray-900">WatchReviews</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          {(["profile", "path", "location", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                step === s ? "bg-blue-600 text-white" :
                ["profile", "path", "location", "done"].indexOf(step) > i ? "bg-green-500 text-white" :
                "bg-gray-200 text-gray-500"
              }`}>
                {["profile", "path", "location", "done"].indexOf(step) > i ? "✓" : i + 1}
              </div>
              {i < 3 && <div className={`h-0.5 w-8 ${["profile", "path", "location", "done"].indexOf(step) > i ? "bg-green-500" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Step 1: Business Profile */}
        {step === "profile" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Set up your business profile
              </CardTitle>
              <CardDescription>Tell us about your business so we can personalize your AI responses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="businessName">Business name *</Label>
                <Input
                  id="businessName"
                  placeholder="e.g. Joe's Pizza Restaurant"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contactEmail">Contact email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="your@email.com"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="approvalEmail">Approval notification email</Label>
                <p className="text-xs text-gray-500 mb-1">Where to send AI draft responses for approval</p>
                <Input
                  id="approvalEmail"
                  type="email"
                  placeholder="approvals@email.com"
                  value={approvalEmail}
                  onChange={e => setApprovalEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="telegramChatId">Telegram Chat ID (optional)</Label>
                <p className="text-xs text-gray-500 mb-1">Get approvals via Telegram bot. Leave blank to use email only.</p>
                <Input
                  id="telegramChatId"
                  placeholder="e.g. 123456789"
                  value={telegramChatId}
                  onChange={e => setTelegramChatId(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                className="w-full mt-2"
                onClick={handleCreateProfile}
                disabled={createClient.isPending}
              >
                {createClient.isPending ? "Creating..." : "Continue"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Choose onboarding path */}
        {step === "path" && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-display font-700 text-gray-900 mb-2">Connect your Google Business Profile</h2>
              <p className="text-gray-500">Choose how you'd like to connect your location.</p>
            </div>

            {/* Path 1: Manager invite (recommended) */}
            <Card
              className={`cursor-pointer border-2 transition-all ${selectedPath === "manager" ? "border-blue-500 bg-blue-50/30" : "border-gray-100 hover:border-gray-200"}`}
              onClick={() => setSelectedPath("manager")}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <UserPlus className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">Add as Manager</h3>
                      <Badge className="bg-green-100 text-green-700 border-0 text-xs">Recommended · Works immediately</Badge>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">
                      Add our platform email as a manager on your Google Business Profile. No app verification required — works right now.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      <span>Zero friction</span>
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 ml-2" />
                      <span>Works today</span>
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 ml-2" />
                      <span>Full review access</span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 ${selectedPath === "manager" ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}>
                    {selectedPath === "manager" && <div className="w-full h-full rounded-full bg-white scale-50 block" />}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Path 2: OAuth */}
            <Card
              className={`cursor-pointer border-2 transition-all ${selectedPath === "oauth" ? "border-blue-500 bg-blue-50/30" : "border-gray-100 hover:border-gray-200"}`}
              onClick={() => setSelectedPath("oauth")}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <LogIn className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">Sign in with Google</h3>
                      <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Coming soon · Pending verification</Badge>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">
                      Connect directly via Google OAuth. Your clients sign in and grant access. Currently pending Google app verification.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                      <span>No manual steps</span>
                      <CheckCircle className="w-3.5 h-3.5 text-blue-500 ml-2" />
                      <span>Self-service</span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 ${selectedPath === "oauth" ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}>
                    {selectedPath === "oauth" && <div className="w-full h-full rounded-full bg-white scale-50 block" />}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button className="w-full" onClick={() => setStep(selectedPath === "manager" ? "manager-setup" : "location")}>
              Continue with {selectedPath === "manager" ? "Manager invite" : "Google OAuth"} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 3a: Manager setup instructions */}
        {step === "manager-setup" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-green-600" />
                Add our email as a Google Business Profile Manager
              </CardTitle>
              <CardDescription>Follow these steps to give us access to respond to your reviews.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-6">
                {[
                  { step: 1, text: "Go to your Google Business Profile at business.google.com" },
                  { step: 2, text: "Click on your business location" },
                  { step: 3, text: 'Go to "Business Profile settings" → "Managers"' },
                  { step: 4, text: 'Click "Add" and enter our platform email address:' },
                  { step: 5, text: 'Set the role to "Manager" and click "Invite"' },
                  { step: 6, text: "We'll accept the invitation and start monitoring your reviews" },
                ].map(s => (
                  <div key={s.step} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {s.step}
                    </div>
                    <p className="text-sm text-gray-600">{s.text}</p>
                  </div>
                ))}
              </div>

              {/* Email copy box */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Platform Manager Email</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white border border-gray-200 rounded-md px-3 py-2 font-mono text-sm text-gray-900">
                    {PLATFORM_MANAGER_EMAIL}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCopyEmail}>
                    {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("path")} className="flex-1">Back</Button>
                <Button onClick={() => setStep("location")} className="flex-1">
                  I've sent the invite <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3b: Add location details */}
        {step === "location" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Add your first location
              </CardTitle>
              <CardDescription>Enter your business location details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="locationName">Location name *</Label>
                <Input
                  id="locationName"
                  placeholder="e.g. Joe's Pizza — Downtown"
                  value={locationName}
                  onChange={e => setLocationName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main St, City, State"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="mt-1"
                />
              </div>

              {selectedPath === "manager" && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  <p className="font-medium mb-1">Next step after saving:</p>
                  <p>Go to your Google Business Profile and add <strong>{PLATFORM_MANAGER_EMAIL}</strong> as a Manager. Once accepted, we'll start monitoring your reviews automatically.</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(selectedPath === "manager" ? "manager-setup" : "path")} className="flex-1">Back</Button>
                <Button onClick={handleAddLocation} disabled={addLocation.isPending} className="flex-1">
                  {addLocation.isPending ? "Saving..." : "Add location"} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Done */}
        {step === "done" && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-display font-700 text-gray-900 mb-2">You're all set!</h2>
              <p className="text-gray-500 mb-6">
                {selectedPath === "manager"
                  ? "Once you add our email as a manager on Google Business Profile, we'll start monitoring your reviews and generating AI responses automatically."
                  : "Your location is connected. We'll start monitoring your reviews and generating AI responses automatically."}
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 text-left">
                  <Mail className="w-5 h-5 text-blue-500 mb-2" />
                  <p className="text-sm font-medium text-gray-700">Email approvals</p>
                  <p className="text-xs text-gray-500">Draft responses sent to your email</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-left">
                  <MessageSquare className="w-5 h-5 text-blue-500 mb-2" />
                  <p className="text-sm font-medium text-gray-700">Telegram alerts</p>
                  <p className="text-xs text-gray-500">One-tap approval on mobile</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => navigate("/brand-voice")} className="flex-1">
                  Set up brand voice
                </Button>
                <Button onClick={() => navigate("/dashboard")} className="flex-1">
                  Go to dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
