import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link } from "wouter";
import { Star, ArrowLeft, Save, Sparkles, Info } from "lucide-react";

const RATING_TIERS = [
  { key: "5", label: "5 Stars", emoji: "⭐⭐⭐⭐⭐", color: "text-green-600" },
  { key: "4", label: "4 Stars", emoji: "⭐⭐⭐⭐", color: "text-green-500" },
  { key: "3", label: "3 Stars", emoji: "⭐⭐⭐", color: "text-amber-500" },
  { key: "1-2", label: "1-2 Stars", emoji: "⭐", color: "text-red-500" },
];

export default function BrandVoice() {
  const { isAuthenticated, loading } = useAuth();

  const templateQuery = trpc.templates.get.useQuery();
  const upsertTemplate = trpc.templates.upsert.useMutation({
    onSuccess: () => toast.success("Brand voice settings saved!"),
    onError: () => toast.error("Failed to save settings"),
  });

  const [businessContext, setBusinessContext] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [toneGuidelines, setToneGuidelines] = useState("");
  const [avoidPhrases, setAvoidPhrases] = useState("");
  const [mustIncludePhrases, setMustIncludePhrases] = useState("");
  const [languagePreference, setLanguagePreference] = useState("en");
  const [responseTemplates, setResponseTemplates] = useState<Record<string, string>>({
    "5": "",
    "4": "",
    "3": "",
    "1-2": "",
  });

  useEffect(() => {
    if (templateQuery.data) {
      const t = templateQuery.data;
      setBusinessContext(t.businessContext || "");
      setBrandVoice(t.brandVoice || "");
      setToneGuidelines(t.toneGuidelines || "");
      setAvoidPhrases(t.avoidPhrases || "");
      setMustIncludePhrases(t.mustIncludePhrases || "");
      setLanguagePreference(t.languagePreference || "en");
      const templates = (t.responseTemplates as Record<string, string>) || {};
      setResponseTemplates({
        "5": templates["5"] || "",
        "4": templates["4"] || "",
        "3": templates["3"] || "",
        "1-2": templates["1-2"] || "",
      });
    }
  }, [templateQuery.data]);

  const handleSave = () => {
    const filteredTemplates: Record<string, string> = {};
    Object.entries(responseTemplates).forEach(([k, v]) => {
      if (v.trim()) filteredTemplates[k] = v.trim();
    });

    upsertTemplate.mutate({
      businessContext: businessContext || undefined,
      brandVoice: brandVoice || undefined,
      toneGuidelines: toneGuidelines || undefined,
      avoidPhrases: avoidPhrases || undefined,
      mustIncludePhrases: mustIncludePhrases || undefined,
      languagePreference,
      responseTemplates: Object.keys(filteredTemplates).length > 0 ? filteredTemplates : undefined,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-gray-500">
              <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-700 text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-600" />
              Brand Voice & Templates
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Customize how the AI generates responses to match your brand personality
            </p>
          </div>
          <Button onClick={handleSave} disabled={upsertTemplate.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {upsertTemplate.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>

        <Tabs defaultValue="voice">
          <TabsList className="mb-6">
            <TabsTrigger value="voice">Brand Voice</TabsTrigger>
            <TabsTrigger value="templates">Response Templates</TabsTrigger>
            <TabsTrigger value="rules">Rules & Phrases</TabsTrigger>
          </TabsList>

          {/* Brand Voice Tab */}
          <TabsContent value="voice" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Business Context</CardTitle>
                <CardDescription>
                  Tell the AI about your business so it can generate more relevant responses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={businessContext}
                  onChange={(e) => setBusinessContext(e.target.value)}
                  placeholder="e.g. We're a family-owned Italian restaurant in downtown Chicago, specializing in authentic Neapolitan pizza and pasta. We've been serving the community since 1987 and pride ourselves on fresh ingredients and warm hospitality."
                  className="min-h-[120px]"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Brand Voice</CardTitle>
                <CardDescription>
                  Describe the personality and tone your brand should convey.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={brandVoice}
                  onChange={(e) => setBrandVoice(e.target.value)}
                  placeholder="e.g. Warm, friendly, and approachable. We speak like a knowledgeable friend, not a corporate entity. We're enthusiastic about food and genuinely care about every guest's experience."
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tone Guidelines</CardTitle>
                <CardDescription>
                  Specific instructions for how responses should be written.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={toneGuidelines}
                  onChange={(e) => setToneGuidelines(e.target.value)}
                  placeholder="e.g. Always use the customer's first name. Keep responses under 100 words. Never be defensive. For negative reviews, always offer to make it right and provide a direct contact email."
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Language Preference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  {[
                    { code: "en", label: "English" },
                    { code: "es", label: "Spanish" },
                    { code: "fr", label: "French" },
                    { code: "de", label: "German" },
                    { code: "pt", label: "Portuguese" },
                    { code: "auto", label: "Auto (match review)" },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setLanguagePreference(lang.code)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        languagePreference === lang.code
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Response Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg p-4 mb-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-700">
                Templates are used as a starting point. The AI will personalize each response based on the specific review content. Leave blank to let the AI generate freely.
              </p>
            </div>

            {RATING_TIERS.map((tier) => (
              <Card key={tier.key}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className={tier.color}>{tier.emoji}</span>
                    {tier.label} Response Template
                  </CardTitle>
                  <CardDescription>
                    Starting template for {tier.label.toLowerCase()} reviews
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={responseTemplates[tier.key]}
                    onChange={(e) =>
                      setResponseTemplates((prev) => ({ ...prev, [tier.key]: e.target.value }))
                    }
                    placeholder={
                      tier.key === "5"
                        ? "e.g. Thank you so much for the wonderful review, [Name]! We're thrilled you enjoyed your experience with us. It means the world to our team..."
                        : tier.key === "1-2"
                        ? "e.g. We're truly sorry to hear about your experience, [Name]. This is not the standard we hold ourselves to. Please reach out to us at..."
                        : "Optional template for this rating tier..."
                    }
                    className="min-h-[100px]"
                  />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phrases to Avoid</CardTitle>
                <CardDescription>
                  Comma-separated phrases the AI should never use in responses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={avoidPhrases}
                  onChange={(e) => setAvoidPhrases(e.target.value)}
                  placeholder="e.g. Thank you for your review, We apologize for the inconvenience, As per our policy, We strive to..."
                  className="min-h-[80px]"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Must-Include Elements</CardTitle>
                <CardDescription>
                  Things the AI should always try to include in responses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={mustIncludePhrases}
                  onChange={(e) => setMustIncludePhrases(e.target.value)}
                  placeholder="e.g. Invite them to return, Mention our loyalty program, Include our contact email for complaints: hello@business.com"
                  className="min-h-[80px]"
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={upsertTemplate.isPending} size="lg">
                <Save className="w-4 h-4 mr-2" />
                {upsertTemplate.isPending ? "Saving..." : "Save all settings"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
