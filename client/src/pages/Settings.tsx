import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Bell, Mail, MessageCircle, Save, Info, Trash2 } from "lucide-react";

export default function Settings() {
  const { isAuthenticated, loading, logout } = useAuth();
  const clientQuery = trpc.clients.me.useQuery();
  const utils = trpc.useUtils();

  const deleteAccount = trpc.auth.deleteAccount.useMutation({
    onSuccess: async () => {
      toast.success("Your account has been deleted.");
      await logout();
    },
    onError: (err) => {
      toast.error(err.message || "Could not delete account");
    },
  });

  const updateClient = trpc.clients.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved!");
      utils.clients.me.invalidate();
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [approvalEmail, setApprovalEmail] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);

  useEffect(() => {
    if (clientQuery.data) {
      const c = clientQuery.data;
      setBusinessName(c.businessName || "");
      setContactEmail(c.contactEmail || "");
      setApprovalEmail(c.approvalEmail || "");
      setTelegramChatId(c.telegramChatId || "");
      setNotifyTelegram(c.notifyTelegram ?? true);
      setNotifyEmail(c.notifyEmail ?? true);
    }
  }, [clientQuery.data]);

  const handleSave = () => {
    updateClient.mutate({
      businessName,
      contactEmail: contactEmail || undefined,
      approvalEmail: approvalEmail || undefined,
      telegramChatId: telegramChatId || undefined,
      notifyTelegram,
      notifyEmail,
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
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-gray-500">
              <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-700 text-gray-900 flex items-center gap-2">
              <Bell className="w-6 h-6 text-blue-600" />
              Account Settings
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage your business profile and notification preferences
            </p>
          </div>
          <Button onClick={handleSave} disabled={updateClient.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {updateClient.isPending ? "Saving..." : "Save"}
          </Button>
        </div>

        <div className="space-y-4">
          {/* Business Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Mario's Italian Restaurant"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                Email Notifications
              </CardTitle>
              <CardDescription>
                Receive AI draft responses via email with one-click approve/reject links.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Enable email notifications</p>
                  <p className="text-xs text-gray-500">Send approval emails for each new review</p>
                </div>
                <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
              </div>
              {notifyEmail && (
                <div>
                  <Label htmlFor="approvalEmail">Approval Email Address</Label>
                  <Input
                    id="approvalEmail"
                    type="email"
                    value={approvalEmail}
                    onChange={(e) => setApprovalEmail(e.target.value)}
                    placeholder="approvals@yourdomain.com"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Leave blank to use your contact email above
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Telegram Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                Telegram Notifications
              </CardTitle>
              <CardDescription>
                Receive AI drafts in Telegram with inline approve/reject/edit buttons — the fastest approval method.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Enable Telegram notifications</p>
                  <p className="text-xs text-gray-500">Send approval messages to your Telegram</p>
                </div>
                <Switch checked={notifyTelegram} onCheckedChange={setNotifyTelegram} />
              </div>
              {notifyTelegram && (
                <div>
                  <Label htmlFor="telegramChatId">Your Telegram Chat ID</Label>
                  <Input
                    id="telegramChatId"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="e.g. 123456789"
                    className="mt-1"
                  />
                  <div className="flex items-start gap-2 mt-2 p-3 bg-blue-50 rounded-lg">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-700 space-y-1">
                      <p><strong>How to get your Chat ID:</strong></p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>Open Telegram and search for <strong>@userinfobot</strong></li>
                        <li>Send it any message</li>
                        <li>It will reply with your Chat ID — paste it above</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updateClient.isPending} size="lg">
              <Save className="w-4 h-4 mr-2" />
              {updateClient.isPending ? "Saving..." : "Save all settings"}
            </Button>
          </div>

          <Card className="border-red-200 bg-red-50/40">
            <CardHeader>
              <CardTitle className="text-base text-red-900">Danger zone</CardTitle>
              <CardDescription className="text-red-800/80">
                Permanently delete your ReviewPilot account, business data, saved audits, and your login. This cannot
                be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={deleteAccount.isPending}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleteAccount.isPending ? "Deleting…" : "Delete my account"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      We will remove your profile, locations, reviews, brand settings, and marketing lead data tied to
                      this account, then sign you out. Your Clerk login will also be removed if configured.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className={cn(buttonVariants({ variant: "destructive" }))}
                      onClick={() => deleteAccount.mutate()}
                    >
                      Yes, delete everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
