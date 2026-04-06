import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  Star,
  Users,
  MapPin,
  MessageSquare,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  ArrowLeft,
  Loader2,
  Building2,
  Clock,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    trial: "bg-blue-100 text-blue-700",
    active: "bg-green-100 text-green-700",
    paused: "bg-amber-100 text-amber-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return (
    <Badge className={`${map[status] || "bg-gray-100 text-gray-600"} border-0 text-xs capitalize`}>
      {status}
    </Badge>
  );
}

export default function AdminDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  const clientsQuery = trpc.admin.allClients.useQuery();
  const reviewsQuery = trpc.admin.allReviews.useQuery();
  const clientDetailQuery = trpc.admin.clientDetail.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId }
  );

  const updateStatus = trpc.admin.updateClientStatus.useMutation({
    onSuccess: () => {
      toast.success("Client status updated");
      clientsQuery.refetch();
    },
    onError: () => toast.error("Failed to update status"),
  });

  const triggerPoll = trpc.admin.triggerPoll.useMutation({
    onSuccess: () => toast.success("Poll triggered"),
    onError: () => toast.error("Poll failed"),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Admin access required</h2>
            <p className="text-gray-500 mb-4">You don't have permission to view this page.</p>
            <Link href="/dashboard">
              <Button variant="outline">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clients = clientsQuery.data || [];
  const reviews = reviewsQuery.data || [];

  const totalLocations = clients.reduce((sum, c) => sum + ((c as { locationCount?: number }).locationCount || 0), 0);
  const totalPosted = reviews.filter((r) => r.review.status === "posted").length;
  const totalPending = reviews.filter((r) => r.review.status === "pending_approval").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-[oklch(0.13_0.03_250)] text-white flex flex-col flex-shrink-0">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-2">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663492121254/dd2dpCppv6NJGLXJF3QZ3N/watchreviews-logo_022832b1.png" alt="WatchReviews" className="w-8 h-8 object-contain" />
              <span className="font-display font-700 text-base">WatchReviews</span>
            </div>
            <Badge className="mt-2 bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">Admin</Badge>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {[
              { icon: <TrendingUp className="w-4 h-4" />, label: "Overview", active: true },
              { icon: <Users className="w-4 h-4" />, label: "Clients" },
              { icon: <MessageSquare className="w-4 h-4" />, label: "All Reviews" },
            ].map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                  item.active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.icon}
                {item.label}
              </div>
            ))}
          </nav>
          <div className="p-4 border-t border-white/10">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="w-full text-white/60 hover:text-white hover:bg-white/10">
                <ArrowLeft className="w-4 h-4 mr-2" /> Client View
              </Button>
            </Link>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-display font-700 text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-500 text-sm mt-1">Platform overview and client management</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Clients", value: clients.length, icon: <Users className="w-5 h-5 text-blue-500" />, color: "bg-blue-50" },
                { label: "Total Locations", value: totalLocations, icon: <MapPin className="w-5 h-5 text-purple-500" />, color: "bg-purple-50" },
                { label: "Responses Posted", value: totalPosted, icon: <CheckCircle className="w-5 h-5 text-green-500" />, color: "bg-green-50" },
                { label: "Pending Approval", value: totalPending, icon: <Clock className="w-5 h-5 text-amber-500" />, color: "bg-amber-50" },
              ].map((stat) => (
                <Card key={stat.label} className="border-gray-100">
                  <CardContent className="p-5">
                    <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
                      {stat.icon}
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs defaultValue="clients">
              <TabsList className="mb-6">
                <TabsTrigger value="clients">Clients ({clients.length})</TabsTrigger>
                <TabsTrigger value="reviews">Recent Reviews ({reviews.length})</TabsTrigger>
              </TabsList>

              {/* Clients Tab */}
              <TabsContent value="clients">
                {clientsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clients.map((client) => (
                      <Card key={client.id} className="border-gray-100">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-5 h-5 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-gray-900">{client.businessName}</p>
                                  <StatusBadge status={client.subscriptionStatus || "trial"} />
                                </div>
                                <p className="text-sm text-gray-500 mt-0.5">{client.contactEmail}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {(client as { locationCount?: number }).locationCount || 0} locations
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" />
                                    {(client as { responseCount?: number }).responseCount || 0} responses
                                  </span>
                                  <span>Joined {new Date(client.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Select
                                value={client.subscriptionStatus || "trial"}
                                onValueChange={(val) =>
                                  updateStatus.mutate({
                                    clientId: client.id,
                                    subscriptionStatus: val as "trial" | "active" | "paused" | "cancelled",
                                  })
                                }
                              >
                                <SelectTrigger className="w-32 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="trial">Trial</SelectItem>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="paused">Paused</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedClientId(selectedClientId === client.id ? null : client.id)}
                              >
                                {selectedClientId === client.id ? "Hide" : "Details"}
                              </Button>
                            </div>
                          </div>

                          {/* Client detail expansion */}
                          {selectedClientId === client.id && clientDetailQuery.data && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Locations</p>
                                  <div className="space-y-2">
                                    {clientDetailQuery.data.locations.map((loc) => (
                                      <div key={loc.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                        <div>
                                          <p className="text-sm font-medium text-gray-700">{loc.locationName}</p>
                                          <p className="text-xs text-gray-400">{loc.address || "No address"}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Badge className={`text-xs border-0 ${loc.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                            {loc.isActive ? "Active" : "Inactive"}
                                          </Badge>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => triggerPoll.mutate({ locationId: loc.id })}
                                            disabled={triggerPoll.isPending}
                                          >
                                            <RefreshCw className={`w-3 h-3 ${triggerPoll.isPending ? "animate-spin" : ""}`} />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Recent Responses</p>
                                  <div className="space-y-2">
                                    {clientDetailQuery.data.responses.slice(0, 5).map((r) => (
                                      <div key={r.response.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                        <p className="text-xs text-gray-600 truncate flex-1">{r.review.reviewerName || "Anonymous"}</p>
                                        <Badge className={`text-xs border-0 ml-2 ${
                                          r.response.status === "posted" ? "bg-green-100 text-green-700" :
                                          r.response.status === "pending_approval" ? "bg-amber-100 text-amber-700" :
                                          "bg-gray-100 text-gray-600"
                                        }`}>
                                          {r.response.status}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews">
                <Card className="border-gray-100">
                  <CardContent className="p-0">
                    {reviews.length === 0 ? (
                      <div className="py-12 text-center">
                        <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No reviews yet</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {reviews.slice(0, 50).map((r) => (
                          <div key={r.review.id} className="p-4 flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="text-sm font-medium text-gray-900">{r.review.reviewerName || "Anonymous"}</p>
                                <div className="flex gap-0.5">
                                  {[1,2,3,4,5].map(i => (
                                    <Star key={i} className={`w-3 h-3 ${i <= r.review.rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}`} />
                                  ))}
                                </div>
                                <Badge className={`text-xs border-0 ${
                                  r.review.status === "posted" ? "bg-green-100 text-green-700" :
                                  r.review.status === "pending_approval" ? "bg-amber-100 text-amber-700" :
                                  "bg-gray-100 text-gray-600"
                                }`}>
                                  {r.review.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500 truncate">{r.review.comment || "(No written comment)"}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{r.location?.locationName}</p>
                            </div>
                            <p className="text-xs text-gray-400 flex-shrink-0">
                              {new Date(r.review.publishedAt || Date.now()).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
