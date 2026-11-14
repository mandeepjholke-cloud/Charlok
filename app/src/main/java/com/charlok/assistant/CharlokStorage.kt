package com.charlok.assistant

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class CharlokSettings(
    val ownerName: String = "Mandeep",
    val pickupDelayMode: String = "ring_3s", // "ring_3s", "instant", "manual"
    val autoPickupEnabled: Boolean = true,
    val speakGreetingOnPickup: Boolean = true,
    val screeningMode: String = "screen_message", // "screen_message", "friendly_receptionist", "strict_spam"
    val customGreeting: String = ""
)

data class CallLogItem(
    val id: String = UUID.randomUUID().toString(),
    val callerLabel: String,
    val callerNumber: String,
    val status: String, // "Auto-answered", "Screened", "Simulated"
    val summary: String,
    val timestampMs: Long = System.currentTimeMillis(),
    val transcriptLines: List<String> = emptyList()
)

object CharlokStorage {
    const val PREFS_NAME = "charlok_prefs"
    const val KEY_AUTO_PICKUP = "auto_pickup_enabled"
    private const val KEY_OWNER_NAME = "owner_name"
    private const val KEY_PICKUP_DELAY = "pickup_delay_mode"
    private const val KEY_SPEAK_GREETING = "speak_greeting_on_pickup"
    private const val KEY_SCREENING_MODE = "screening_mode"
    private const val KEY_CUSTOM_GREETING = "custom_greeting"
    private const val KEY_CALL_HISTORY = "call_history_json"

    fun loadSettings(context: Context): CharlokSettings {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val pickupDelay = prefs.getString(KEY_PICKUP_DELAY, "ring_3s") ?: "ring_3s"
        val autoPickup = prefs.getBoolean(KEY_AUTO_PICKUP, pickupDelay != "manual")
        return CharlokSettings(
            ownerName = prefs.getString(KEY_OWNER_NAME, "Mandeep") ?: "Mandeep",
            pickupDelayMode = pickupDelay,
            autoPickupEnabled = autoPickup,
            speakGreetingOnPickup = prefs.getBoolean(KEY_SPEAK_GREETING, true),
            screeningMode = prefs.getString(KEY_SCREENING_MODE, "screen_message") ?: "screen_message",
            customGreeting = prefs.getString(KEY_CUSTOM_GREETING, "") ?: ""
        )
    }

    fun saveSettings(context: Context, settings: CharlokSettings) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putString(KEY_OWNER_NAME, settings.ownerName)
            .putString(KEY_PICKUP_DELAY, settings.pickupDelayMode)
            .putBoolean(KEY_AUTO_PICKUP, settings.autoPickupEnabled)
            .putBoolean(KEY_SPEAK_GREETING, settings.speakGreetingOnPickup)
            .putString(KEY_SCREENING_MODE, settings.screeningMode)
            .putString(KEY_CUSTOM_GREETING, settings.customGreeting)
            .apply()
    }

    fun loadCallHistory(context: Context): List<CallLogItem> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_CALL_HISTORY, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            buildList {
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    val linesArr = obj.optJSONArray("transcriptLines")
                    val lines = buildList {
                        if (linesArr != null) {
                            for (j in 0 until linesArr.length()) {
                                add(linesArr.optString(j))
                            }
                        }
                    }
                    add(
                        CallLogItem(
                            id = obj.optString("id", UUID.randomUUID().toString()),
                            callerLabel = obj.optString("callerLabel", "Caller"),
                            callerNumber = obj.optString("callerNumber", "Unknown"),
                            status = obj.optString("status", "Screened"),
                            summary = obj.optString("summary", ""),
                            timestampMs = obj.optLong("timestampMs", System.currentTimeMillis()),
                            transcriptLines = lines
                        )
                    )
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun appendCallLog(context: Context, item: CallLogItem) {
        val current = loadCallHistory(context).toMutableList()
        current.add(0, item)
        saveCallHistory(context, current.take(50))
    }

    fun deleteCallLog(context: Context, id: String) {
        val filtered = loadCallHistory(context).filterNot { it.id == id }
        saveCallHistory(context, filtered)
    }

    fun clearCallHistory(context: Context) {
        saveCallHistory(context, emptyList())
    }

    private fun saveCallHistory(context: Context, list: List<CallLogItem>) {
        val arr = JSONArray()
        for (item in list) {
            val obj = JSONObject()
            obj.put("id", item.id)
            obj.put("callerLabel", item.callerLabel)
            obj.put("callerNumber", item.callerNumber)
            obj.put("status", item.status)
            obj.put("summary", item.summary)
            obj.put("timestampMs", item.timestampMs)
            val linesArr = JSONArray()
            for (line in item.transcriptLines) {
                linesArr.put(line)
            }
            obj.put("transcriptLines", linesArr)
            arr.put(obj)
        }
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_CALL_HISTORY, arr.toString()).apply()
    }

    fun buildOpeningGreeting(settings: CharlokSettings, callerName: String): String {
        val owner = settings.ownerName.trim().ifEmpty { "the user" }
        if (settings.customGreeting.isNotBlank()) {
            return settings.customGreeting.trim()
        }
        val callerPrefix = if (callerName.isNotBlank() && callerName != "Unknown Caller") {
            "Hello $callerName, "
        } else {
            "Hello! "
        }
        return when (settings.screeningMode) {
            "strict_spam" -> "${callerPrefix}this is CHARLOK, $owner's call assistant. Please state your full name, company, and why you are calling."
            "friendly_receptionist" -> "${callerPrefix}this is CHARLOK, $owner's personal assistant. How can I help you today?"
            else -> "${callerPrefix}this is CHARLOK answering for $owner. Who is calling and what is this regarding?"
        }
    }

    fun buildSmartReply(settings: CharlokSettings, callerMessage: String, turnCount: Int): String {
        val owner = settings.ownerName.trim().ifEmpty { "the user" }
        val lower = callerMessage.lowercase()

        val looksLikeSpam = listOf("loan", "credit card", "offer", "insurance", "lottery", "kyc", "otp", "promotion", "marketing")
            .any { lower.contains(it) }
        val looksLikeDelivery = listOf("delivery", "parcel", "package", "courier", "amazon", "flipkart", "zomato", "swiggy", "gate")
            .any { lower.contains(it) }
        val looksUrgent = listOf("urgent", "emergency", "asap", "hospital", "important", "immediately")
            .any { lower.contains(it) }

        if (looksLikeSpam) {
            return if (settings.screeningMode == "strict_spam") {
                "$owner is not accepting promotional or unsolicited calls right now. Thank you, goodbye."
            } else {
                "Thanks for sharing that. I will note it down for $owner, and they will reach out if interested."
            }
        }

        if (looksLikeDelivery) {
            return "Got it, thanks for the delivery update! Please leave the parcel safely at the door or gate, and I will notify $owner immediately."
        }

        if (looksUrgent) {
            return "Understood, I am marking this as high urgency for $owner right now. Please confirm your callback number if different from this line."
        }

        return when {
            turnCount <= 1 -> "Thank you. I have noted your message for $owner. Is there a specific time they should call you back?"
            else -> "Perfect, I have saved all the details for $owner and they will get back to you shortly. Have a great day!"
        }
    }
}
