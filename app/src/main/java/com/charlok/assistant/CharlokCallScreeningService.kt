package com.charlok.assistant

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.telecom.Call
import android.telecom.CallScreeningService
import android.telecom.TelecomManager
import androidx.core.content.ContextCompat
import java.util.Locale

class CharlokCallScreeningService : CallScreeningService() {

    private var tts: TextToSpeech? = null

    override fun onScreenCall(callDetails: Call.Details) {
        val response = CallResponse.Builder()
            .setDisallowCall(false)
            .setRejectCall(false)
            .setSilenceCall(false)
            .setSkipCallLog(false)
            .setSkipNotification(false)
            .build()

        respondToCall(callDetails, response)

        if (callDetails.callDirection != Call.Details.DIRECTION_INCOMING) {
            return
        }

        val settings = CharlokStorage.loadSettings(this)
        val callerNumber = callDetails.handle?.schemeSpecificPart
            ?.takeIf { it.isNotBlank() }
            ?: "Unknown number"

        if (settings.autoPickupEnabled && settings.pickupDelayMode != "manual") {
            val hasAnswerPermission = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ANSWER_PHONE_CALLS
            ) == PackageManager.PERMISSION_GRANTED

            if (hasAnswerPermission) {
                val delayMs = if (settings.pickupDelayMode == "instant") 200L else 3000L
                val greeting = CharlokStorage.buildOpeningGreeting(settings, "Caller")

                Handler(Looper.getMainLooper()).postDelayed({
                    val telecomManager =
                        getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
                    @Suppress("DEPRECATION")
                    telecomManager?.acceptRingingCall()

                    CharlokStorage.appendCallLog(
                        this,
                        CallLogItem(
                            callerLabel = callerNumber,
                            callerNumber = callerNumber,
                            status = "Auto-answered",
                            summary = "CHARLOK auto-picked up incoming call (${settings.pickupDelayMode}).",
                            transcriptLines = listOf("CHARLOK: $greeting")
                        )
                    )

                    postCallNotification(
                        title = "CHARLOK answered call",
                        body = "Auto-picked up incoming call from $callerNumber"
                    )

                    if (settings.speakGreetingOnPickup) {
                        Handler(Looper.getMainLooper()).postDelayed({
                            speakGreetingAloud(greeting)
                        }, 1100L)
                    }
                }, delayMs)
                return
            }
        }

        CharlokStorage.appendCallLog(
            this,
            CallLogItem(
                callerLabel = callerNumber,
                callerNumber = callerNumber,
                status = "Screened",
                summary = if (settings.autoPickupEnabled) {
                    "Incoming call screened (grant Answer Calls permission for auto-pickup)."
                } else {
                    "Incoming call logged while auto-pickup is OFF."
                }
            )
        )
    }

    private fun speakGreetingAloud(greeting: String) {
        try {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            @Suppress("DEPRECATION")
            audioManager?.isSpeakerphoneOn = true
        } catch (_: Exception) {
            // Ignore audio routing exceptions on restricted OEMs
        }

        tts?.shutdown()
        tts = TextToSpeech(applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.getDefault()
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {}
                    override fun onDone(utteranceId: String?) {
                        tts?.shutdown()
                        tts = null
                    }
                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        tts?.shutdown()
                        tts = null
                    }
                })
                tts?.speak(greeting, TextToSpeech.QUEUE_FLUSH, null, "charlok_sim_pickup")
            } else {
                tts?.shutdown()
                tts = null
            }
        }
    }

    private fun postCallNotification(title: String, body: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return
        }

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        val channelId = "charlok_calls"
        val channel = NotificationChannel(
            channelId,
            "CHARLOK Inbound Calls",
            NotificationManager.IMPORTANCE_HIGH
        )
        manager.createNotificationChannel(channel)

        val notification = Notification.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .build()

        manager.notify((System.currentTimeMillis() % 10000).toInt(), notification)
    }

    override fun onDestroy() {
        tts?.shutdown()
        tts = null
        super.onDestroy()
    }

    companion object {
        const val PREFS_NAME = CharlokStorage.PREFS_NAME
        const val KEY_AUTO_PICKUP = CharlokStorage.KEY_AUTO_PICKUP
    }
}
