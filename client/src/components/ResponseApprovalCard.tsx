import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  CheckCircle,
  XCircle,
  RefreshCw,
  Edit3,
  ChevronDown,
  ChevronUp,
  MapPin,
} from "lucide-react";

interface ReviewResponse {
  id: number;
  reviewId: number;
  aiDraftResponse: string | null;
  finalResponse: string | null;
  status: string;
  telegramMessageId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface Review {
  id: number;
  reviewerName: string | null;
  rating: number;
  comment: string | null;
  publishedAt?: number | null;
}

interface Location {
  id: number;
  locationName: string;
  address?: string | null;
}

interface Props {
  response: { response: ReviewResponse; review: Review; location: Location };
  onApprove: (finalText?: string) => void;
  onReject: (reason?: string) => void;
  onRegenerate: (instructions?: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  isRegenerating?: boolean;
}

export function ResponseApprovalCard({
  response: data,
  onApprove,
  onReject,
  onRegenerate,
  isApproving,
  isRejecting,
  isRegenerating,
}: Props) {
  const { response, review, location } = data;
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(response.finalResponse || response.aiDraftResponse || "");
  const [regenInstructions, setRegenInstructions] = useState("");
  const [showRegen, setShowRegen] = useState(false);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [expanded, setExpanded] = useState(true);

  const stars = Array.from({ length: 5 }, (_, i) => i + 1);

  return (
    <Card className="border-amber-200 bg-amber-50/20">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm">
                {review.reviewerName || "Anonymous"}
              </span>
              <div className="flex gap-0.5">
                {stars.map((i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${i <= review.rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}`}
                  />
                ))}
              </div>
              <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">Pending Approval</Badge>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500">{location.locationName}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-600"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {expanded && (
          <>
            {/* Review text */}
            <div className="bg-white border border-gray-100 rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Customer Review</p>
              <p className="text-sm text-gray-700 italic leading-relaxed">
                "{review.comment || "(No written comment — rating only)"}"
              </p>
            </div>

            {/* AI Draft */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">AI Draft Response</p>
              {isEditing ? (
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="text-sm min-h-[100px] bg-white"
                  placeholder="Edit the response..."
                />
              ) : (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {response.finalResponse || response.aiDraftResponse || "No draft generated"}
                  </p>
                </div>
              )}
            </div>

            {/* Regen instructions */}
            {showRegen && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-1">Regeneration instructions (optional)</p>
                <Textarea
                  value={regenInstructions}
                  onChange={(e) => setRegenInstructions(e.target.value)}
                  className="text-sm min-h-[60px] bg-white"
                  placeholder="e.g. Make it shorter, more formal, mention our loyalty program..."
                />
              </div>
            )}

            {/* Reject reason */}
            {showRejectReason && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-1">Reason for rejection (optional)</p>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="text-sm min-h-[60px] bg-white"
                  placeholder="e.g. Client will respond personally..."
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onApprove(isEditing ? editedText : undefined)}
                disabled={isApproving}
              >
                {isApproving ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                )}
                {isEditing ? "Approve Edited" : "Approve & Post"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(!isEditing);
                  if (!isEditing) setEditedText(response.finalResponse || response.aiDraftResponse || "");
                }}
              >
                <Edit3 className="w-3.5 h-3.5 mr-1" />
                {isEditing ? "Cancel Edit" : "Edit"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowRegen(!showRegen);
                  if (showRegen) onRegenerate(regenInstructions || undefined);
                }}
                disabled={isRegenerating}
              >
                {isRegenerating ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                )}
                {showRegen ? "Regenerate" : "New Draft"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => {
                  if (showRejectReason) {
                    onReject(rejectReason || undefined);
                  } else {
                    setShowRejectReason(true);
                  }
                }}
                disabled={isRejecting}
              >
                {isRejecting ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                )}
                {showRejectReason ? "Confirm Reject" : "Reject"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
