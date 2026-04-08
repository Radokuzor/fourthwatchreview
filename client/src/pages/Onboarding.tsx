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
  ChevronRight,
  Search,
  Loader2,
} from "lucide-react";

const PLATFORM_MANAGER_EMAIL = "manager@fourthwatchtech.com";

type Step = "search" | "path" | "manager-setup" | "location" | "done";

type BusinessResult = {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  totalReviews: number | null;
  category: string | null;
};

const PROGRESS_LABELS = ["Find business", "Connect", "Location", "Done"] as const;

function progressPhase(step: Step): number {
  if (step === "search") return 0;
  if (step === "path" || step === "manager-setup") return 1;
  if (step === "location") return 2;
  return 3;
}

export default function Onboarding() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<Step>("search");
  const [selectedPath, setSelectedPath] = useState<"manager" | "oauth">("manager");
  const [copied, setCopied] = useState(false);

  const [businessQuery, setBusinessQuery] = useState("");
  const [businesses, setBusinesses] = useState<BusinessResult[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessResult | null>(null);

  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");

  const clientQuery = trpc.clients.me.useQuery(undefined, { enabled: isAuthenticated });
  const createClientMutation = trpc.clients.create.useMutation();
  const addLocation = trpc.locations.add.useMutation();
  const searchMutation = trpc.audit.searchBusinesses.useMutation();

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(PLATFORM_MANAGER_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSearch = async () => {
    if (!businessQuery.trim()) return;
    try {
      const { results } = await searchMutation.mutateAsync({ query: businessQuery.trim() });
      setBusinesses(results as BusinessResult[]);
    } catch {
      toast.error("Search failed — please try again");
    }
  };

  const goToLocationStep = () => {
    if (selectedBusiness) {
      setLocationName(selectedBusiness.name);
      setAddress(selectedBusiness.address ?? "");
    }
    setStep("location");
  };

  const handleContinueFromSearch = async () => {
    if (!selectedBusiness) {
      toast.error("Select your business from the list");
      return;
    }
    const email = user?.email?.trim();
    if (!email) {
      toast.error("Your account needs an email address to receive approval notifications.");
      return;
    }
    try {
      if (!clientQuery.data) {
        await createClientMutation.mutateAsync({
          businessName: selectedBusiness.name,
          contactEmail: email,
          approvalEmail: email,
          notifyTelegram: false,
          notifyEmail: true,
        });
        await utils.clients.me.invalidate();
      }
      setStep("path");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to continue";
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

  const phase = progressPhase(step);

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
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2 flex-wrap">
          {PROGRESS_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  phase === i ? "bg-blue-600 text-white" : phase > i ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {phase > i ? "✓" : i + 1}
              </div>
              <span className={`text-xs hidden sm:inline ${phase === i ? "text-gray-900 font-medium" : ""}`}>{label}</span>
              {i < PROGRESS_LABELS.length - 1 && (
                <div className={`h-0.5 w-6 sm:w-8 ${phase > i ? "bg-green-500" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Step 1: Find business (same flow as free trial / audit search) */}
        {step === "search" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Find your business
              </CardTitle>
              <CardDescription>
                Search by name (add your city for better matches). We&apos;ll use your sign-in email for notifications — no extra email step.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-3">
                <Input
                  placeholder="e.g. Joe's Pizza New York"
                  value={businessQuery}
                  onChange={(e) => setBusinessQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="text-base py-5 border-2"
                />
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 shrink-0"
                  onClick={handleSearch}
                  disabled={searchMutation.isPending}
                >
                  {searchMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                </Button>
              </div>
              {businesses.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-500">Select your business:</p>
                  {businesses.map((biz) => (
                    <button
                      key={biz.placeId}
                      type="button"
                      onClick={() => setSelectedBusiness(biz)}
                      className={`w-full text-left p-4 bg-white border-2 rounded-xl transition-all group ${
                        selectedBusiness?.placeId === biz.placeId ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200 hover:border-blue-500"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{biz.name}</p>
                          <p className="text-sm text-slate-500 mt-0.5">{biz.address}</p>
                          {biz.category && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              {biz.category}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          {biz.rating != null && (
                            <div className="flex gap-0.5 justify-end">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`h-3.5 w-3.5 ${s <= Math.round(biz.rating!) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                                />
                              ))}
                            </div>
                          )}
                          {biz.totalReviews != null && (
                            <p className="text-xs text-slate-400 mt-1">{biz.totalReviews} reviews</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {businesses.length === 0 && !searchMutation.isPending && businessQuery.trim().length > 0 && (
                <p className="text-sm text-slate-400 text-center">No results yet — try a more specific name or add your city.</p>
              )}
              <Button
                className="w-full mt-2"
                onClick={handleContinueFromSearch}
                disabled={createClientMutation.isPending || !selectedBusiness}
              >
                {createClientMutation.isPending ? "Saving..." : "Continue"}{" "}
                <ArrowRight className="w-4 h-4 ml-2 inline" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Choose onboarding path */}
        {step === "path" && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-display font-700 text-gray-900 mb-2">Connect your Google Business Profile</h2>
              <p className="text-gray-500">Choose how you&apos;d like to connect your location.</p>
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
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 ${selectedPath === "manager" ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}
                  >
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
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 ${selectedPath === "oauth" ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}
                  >
                    {selectedPath === "oauth" && <div className="w-full h-full rounded-full bg-white scale-50 block" />}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full"
              onClick={() => (selectedPath === "manager" ? setStep("manager-setup") : goToLocationStep())}
            >
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
                ].map((s) => (
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
                <Button variant="outline" onClick={() => setStep("path")} className="flex-1">
                  Back
                </Button>
                <Button onClick={goToLocationStep} className="flex-1">
                  I&apos;ve sent the invite <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3b: Confirm / edit location (prefilled from search) */}
        {step === "location" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Add your first location
              </CardTitle>
              <CardDescription>Confirm or edit the location from your search.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="locationName">Location name *</Label>
                <Input
                  id="locationName"
                  placeholder="e.g. Joe's Pizza — Downtown"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main St, City, State"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1"
                />
              </div>

              {selectedPath === "manager" && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  <p className="font-medium mb-1">Next step after saving:</p>
                  <p>
                    Go to your Google Business Profile and add <strong>{PLATFORM_MANAGER_EMAIL}</strong> as a Manager. Once accepted,
                    we&apos;ll start monitoring your reviews automatically.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(selectedPath === "manager" ? "manager-setup" : "path")} className="flex-1">
                  Back
                </Button>
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
              <h2 className="text-2xl font-display font-700 text-gray-900 mb-2">You&apos;re all set!</h2>
              <p className="text-gray-500 mb-6">
                {selectedPath === "manager"
                  ? "Once you add our email as a manager on Google Business Profile, we'll start monitoring your reviews and generating AI responses automatically."
                  : "Your location is connected. We'll start monitoring your reviews and generating AI responses automatically."}
              </p>
              <div className="bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto mb-6">
                <Mail className="w-5 h-5 text-blue-500 mb-2" />
                <p className="text-sm font-medium text-gray-700">Email approvals</p>
                <p className="text-xs text-gray-500">Draft responses are sent to your sign-in email ({user?.email ?? "your account"}) for approval.</p>
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
