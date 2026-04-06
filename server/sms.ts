import axios from "axios";
import { ENV } from "./_core/env";

/**
 * Send an SMS via Textbelt API
 * Free tier: use key "textbelt" for 1 SMS/day
 * Paid: use purchased key from textbelt.com
 */
export async function sendSms(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Normalize phone number
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length < 10) {
      return { success: false, error: "Invalid phone number" };
    }

    const response = await axios.post(
      "https://textbelt.com/text",
      {
        phone: normalized,
        message,
        key: ENV.textbeltApiKey || "textbelt",
      },
      { timeout: 10000 }
    );

    const data = response.data;
    if (data.success) {
      console.log(`[SMS] Sent to ${normalized.slice(0, 6)}*** — quota remaining: ${data.quotaRemaining}`);
      return { success: true };
    } else {
      console.warn("[SMS] Failed:", data.error);
      return { success: false, error: data.error };
    }
  } catch (error: any) {
    console.error("[SMS] Error:", error?.message);
    return { success: false, error: error?.message };
  }
}
