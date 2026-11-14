package com.charlok.assistant

import android.Manifest
import android.app.role.RoleManager
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PhoneInTalk
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.charlok.assistant.ui.theme.CHARLOKTheme
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { CHARLOKTheme { CharlokApp() } }
    }
}

@Composable
private fun CharlokApp() {
    val context = LocalContext.current
    var selectedTab by remember { mutableIntStateOf(0) }
    var settings by remember { mutableStateOf(CharlokStorage.loadSettings(context)) }
    var history by remember { mutableStateOf(CharlokStorage.loadCallHistory(context)) }

    fun updateSettings(updated: CharlokSettings) {
        settings = updated
        CharlokStorage.saveSettings(context, updated)
    }

    fun refreshHistory() {
        history = CharlokStorage.loadCallHistory(context)
    }

    var hasCallPermissions by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ANSWER_PHONE_CALLS) ==
                PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    var hasMicPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
        )
    }

    val roleManager = remember {
        context.getSystemService(RoleManager::class.java)
    }
    var isCallScreeningRoleHeld by remember {
        mutableStateOf(roleManager?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) == true)
    }

    val roleLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        isCallScreeningRoleHeld = roleManager?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) == true
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        hasCallPermissions =
            (results[Manifest.permission.ANSWER_PHONE_CALLS] == true ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.ANSWER_PHONE_CALLS) ==
                PackageManager.PERMISSION_GRANTED) &&
                (results[Manifest.permission.READ_PHONE_STATE] == true ||
                    ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) ==
                    PackageManager.PERMISSION_GRANTED)
        hasMicPermission =
            results[Manifest.permission.RECORD_AUDIO] == true ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED

        isCallScreeningRoleHeld = roleManager?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) == true
        if (hasCallPermissions && !isCallScreeningRoleHeld) {
            roleManager?.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)?.let {
                roleLauncher.launch(it)
            }
        }
    }

    fun requestAllCallPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.ANSWER_PHONE_CALLS,
            Manifest.permission.RECORD_AUDIO
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        permissionLauncher.launch(permissions.toTypedArray())
    }

    val pages = listOf("Home", "Calls", "History", "Settings")
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(containerColor = Color(0xFF0D1524)) {
                val icons = listOf(
                    Icons.Default.Home,
                    Icons.Default.Call,
                    Icons.Default.History,
                    Icons.Default.Settings
                )
                pages.forEachIndexed { index, label ->
                    NavigationBarItem(
                        selected = selectedTab == index,
                        onClick = {
                            if (index == 2) refreshHistory()
                            selectedTab = index
                        },
                        icon = { Icon(icons[index], contentDescription = label) },
                        label = { Text(label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color(0xFF75A5FF),
                            indicatorColor = Color(0xFF1D3154),
                            selectedTextColor = Color.White,
                            unselectedTextColor = Color(0xFF8392AB)
                        )
                    )
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (selectedTab) {
                0 -> HomeScreen(
                    settings = settings,
                    historyCount = history.size,
                    hasCallPermissions = hasCallPermissions,
                    isCallScreeningRoleHeld = isCallScreeningRoleHeld,
                    onToggleAutoPickup = { checked ->
                        if (checked && (!hasCallPermissions || !isCallScreeningRoleHeld)) {
                            requestAllCallPermissions()
                        }
                        updateSettings(
                            settings.copy(
                                autoPickupEnabled = checked,
                                pickupDelayMode = if (!checked) "manual"
                                else if (settings.pickupDelayMode == "manual") "ring_3s"
                                else settings.pickupDelayMode
                            )
                        )
                    },
                    onEnableAutoPickup = {
                        requestAllCallPermissions()
                        updateSettings(
                            settings.copy(
                                autoPickupEnabled = true,
                                pickupDelayMode = if (settings.pickupDelayMode == "manual") "ring_3s" else settings.pickupDelayMode
                            )
                        )
                    },
                    onNavigateTab = { tab ->
                        if (tab == 2) refreshHistory()
                        selectedTab = tab
                    }
                )

                1 -> CallsScreen(
                    settings = settings,
                    hasCallPermissions = hasCallPermissions,
                    hasMicPermission = hasMicPermission,
                    isCallScreeningRoleHeld = isCallScreeningRoleHeld,
                    onRequestPermissions = { requestAllCallPermissions() },
                    onRequestRoleOnly = {
                        roleManager?.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)?.let {
                            roleLauncher.launch(it)
                        }
                    },
                    onOpenDefaultAppsSettings = {
                        runCatching {
                            context.startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
                        }
                    },
                    onCallSaved = {
                        refreshHistory()
                    }
                )

                2 -> HistoryScreen(
                    history = history,
                    onDeleteItem = { id ->
                        CharlokStorage.deleteCallLog(context, id)
                        refreshHistory()
                    },
                    onClearAll = {
                        CharlokStorage.clearCallHistory(context)
                        refreshHistory()
                    },
                    onGoToCalls = { selectedTab = 1 }
                )

                3 -> SettingsScreen(
                    settings = settings,
                    onUpdateSettings = { updateSettings(it) }
                )
            }
        }
    }
}

@Composable
private fun HomeScreen(
    settings: CharlokSettings,
    historyCount: Int,
    hasCallPermissions: Boolean,
    isCallScreeningRoleHeld: Boolean,
    onToggleAutoPickup: (Boolean) -> Unit,
    onEnableAutoPickup: () -> Unit,
    onNavigateTab: (Int) -> Unit
) {
    val isSimReady = hasCallPermissions && isCallScreeningRoleHeld

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        item {
            Spacer(Modifier.height(14.dp))
            Header(isActive = settings.autoPickupEnabled && isSimReady)
        }
        item {
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.linearGradient(
                            listOf(Color(0xFF173B75), Color(0xFF17243D), Color(0xFF111A2A))
                        ),
                        RoundedCornerShape(28.dp)
                    )
                    .padding(22.dp)
            ) {
                Text(
                    "YOUR AI CALL ASSISTANT",
                    color = Color(0xFF9FC2FF),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.4.sp
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    "Your calls.\nHandled smarter.",
                    color = Color.White,
                    fontSize = 27.sp,
                    lineHeight = 33.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "CHARLOK auto-picks up incoming calls, greets callers, and logs every conversation.",
                    color = Color(0xFFD1DDF3),
                    fontSize = 14.sp
                )
                Spacer(Modifier.height(22.dp))
                Button(
                    onClick = { onNavigateTab(1) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F8CFF))
                ) {
                    Icon(Icons.Default.Call, contentDescription = null)
                    Spacer(Modifier.width(9.dp))
                    Text("Answer & test inbound calls", fontWeight = FontWeight.SemiBold)
                }
            }
        }
        item {
            Surface(
                color = Color(0xFF111A2A),
                shape = RoundedCornerShape(20.dp),
                border = BorderStroke(1.dp, Color(0xFF22324C))
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable {
                            if (!isSimReady) onEnableAutoPickup()
                        }
                        .padding(17.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            "Auto-answer incoming SIM calls",
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            when {
                                isSimReady && settings.autoPickupEnabled ->
                                    "Active — incoming calls auto-picked up"
                                isSimReady ->
                                    "Permissions ready (currently manual)"
                                else ->
                                    "Tap to enable Call Screening & Answer permissions"
                            },
                            color = if (isSimReady) Color(0xFF8DE6C2) else Color(0xFF9BAAC2),
                            fontSize = 12.sp
                        )
                    }
                    Switch(
                        checked = settings.autoPickupEnabled,
                        onCheckedChange = onToggleAutoPickup
                    )
                }
            }
        }
        item {
            Text("Your workspace", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold)
        }
        item {
            FeatureCard(
                title = "Call assistant",
                subtitle = "SIM permissions & test inbound calls",
                icon = Icons.Default.Call,
                status = if (isSimReady && settings.autoPickupEnabled) "Active" else "Open",
                onClick = { onNavigateTab(1) }
            )
        }
        item {
            FeatureCard(
                title = "Recent conversations",
                subtitle = "Review incoming & simulated call logs",
                icon = Icons.Default.History,
                status = if (historyCount > 0) "$historyCount calls" else "Empty",
                onClick = { onNavigateTab(2) }
            )
        }
        item {
            FeatureCard(
                title = "Call preferences",
                subtitle = "Pickup timing, greeting & screening mode",
                icon = Icons.Default.Tune,
                status = settings.pickupDelayMode,
                onClick = { onNavigateTab(3) }
            )
        }
        item {
            Text(
                "Privacy first",
                color = Color(0xFF9FB0CA),
                fontSize = 12.sp,
                modifier = Modifier.padding(vertical = 8.dp)
            )
            Text(
                "Call screening and microphone permissions are only used when you enable auto-pickup or start a voice call.",
                color = Color(0xFF8392AB),
                fontSize = 12.sp,
                lineHeight = 18.sp
            )
            Spacer(Modifier.height(20.dp))
        }
    }
}

@Composable
private fun CallsScreen(
    settings: CharlokSettings,
    hasCallPermissions: Boolean,
    hasMicPermission: Boolean,
    isCallScreeningRoleHeld: Boolean,
    onRequestPermissions: () -> Unit,
    onRequestRoleOnly: () -> Unit,
    onOpenDefaultAppsSettings: () -> Unit,
    onCallSaved: () -> Unit
) {
    val context = LocalContext.current

    var callerName by remember { mutableStateOf("Delivery Driver") }
    var callerNumber by remember { mutableStateOf("+91 98765 43210") }
    var callPhase by remember { mutableStateOf("idle") } // "idle", "ringing", "active"
    var ringCountdown by remember { mutableIntStateOf(3) }
    var callerInput by remember { mutableStateOf("") }
    var isListening by remember { mutableStateOf(false) }
    var statusBanner by remember { mutableStateOf<String?>(null) }
    val transcript = remember { mutableStateListOf<String>() }

    var ttsReady by remember { mutableStateOf(false) }
    val tts = remember {
        var instance: TextToSpeech? = null
        instance = TextToSpeech(context.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                instance?.language = Locale.getDefault()
                ttsReady = true
            }
        }
        instance
    }

    val speechRecognizer = remember {
        if (SpeechRecognizer.isRecognitionAvailable(context)) {
            SpeechRecognizer.createSpeechRecognizer(context)
        } else null
    }

    DisposableEffect(Unit) {
        onDispose {
            tts?.shutdown()
            speechRecognizer?.destroy()
        }
    }

    fun speak(text: String) {
        if (ttsReady) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "charlok_${System.currentTimeMillis()}")
        }
    }

    fun answerSimulatedCall() {
        callPhase = "active"
        val greeting = CharlokStorage.buildOpeningGreeting(settings, callerName)
        transcript.clear()
        transcript.add("CHARLOK: $greeting")
        speak(greeting)
    }

    fun sendCallerMessage(messageText: String) {
        val clean = messageText.trim()
        if (clean.isEmpty()) return
        transcript.add("Caller: $clean")
        val reply = CharlokStorage.buildSmartReply(settings, clean, transcript.count { it.startsWith("Caller:") })
        transcript.add("CHARLOK: $reply")
        speak(reply)
    }

    fun endSimulatedCall() {
        tts?.stop()
        speechRecognizer?.stopListening()
        isListening = false
        if (transcript.isNotEmpty()) {
            CharlokStorage.appendCallLog(
                context,
                CallLogItem(
                    callerLabel = callerName.ifBlank { "Simulated Caller" },
                    callerNumber = callerNumber.ifBlank { "Unknown" },
                    status = "Simulated",
                    summary = transcript.lastOrNull { it.startsWith("Caller:") }
                        ?.removePrefix("Caller: ")
                        ?: "Inbound call answered by CHARLOK.",
                    transcriptLines = transcript.toList()
                )
            )
            onCallSaved()
            statusBanner = "Call saved to History tab."
        }
        callPhase = "idle"
        transcript.clear()
    }

    LaunchedEffect(callPhase, ringCountdown) {
        if (callPhase == "ringing") {
            if (settings.pickupDelayMode == "instant") {
                delay(350L)
                answerSimulatedCall()
            } else if (settings.autoPickupEnabled && settings.pickupDelayMode == "ring_3s") {
                if (ringCountdown > 0) {
                    delay(1000L)
                    ringCountdown -= 1
                } else {
                    answerSimulatedCall()
                }
            }
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Spacer(Modifier.height(14.dp))
            Header(isActive = settings.autoPickupEnabled && hasCallPermissions && isCallScreeningRoleHeld)
        }
        item {
            Text("Inbound Calls", color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold)
            Text(
                "Manage SIM call auto-pickup and test live AI call handling",
                color = Color(0xFF8392AB),
                fontSize = 12.sp
            )
        }
        item {
            Surface(
                color = Color(0xFF111A2A),
                shape = RoundedCornerShape(20.dp),
                border = BorderStroke(1.dp, Color(0xFF22324C))
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "SIM Auto-Pickup Readiness",
                        color = Color(0xFF9FC2FF),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    PermissionRow("Phone & Answer Calls permission", hasCallPermissions)
                    PermissionRow("Default Call Screening role", isCallScreeningRoleHeld)
                    PermissionRow("Microphone permission", hasMicPermission)

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                if (!hasCallPermissions || !hasMicPermission) {
                                    onRequestPermissions()
                                } else if (!isCallScreeningRoleHeld) {
                                    onRequestRoleOnly()
                                } else {
                                    statusBanner = "All SIM auto-pickup permissions are active!"
                                }
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F8CFF))
                        ) {
                            Text(
                                if (hasCallPermissions && isCallScreeningRoleHeld) "Permissions Ready"
                                else "Grant Permissions",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        OutlinedButton(
                            onClick = onOpenDefaultAppsSettings,
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, Color(0xFF2B4166))
                        ) {
                            Text("Caller ID App", color = Color(0xFF9FC2FF), fontSize = 12.sp)
                        }
                    }
                    Text(
                        "Note: Android picks up real incoming SIM calls automatically when Call Screening role is set to CHARLOK. Voice audio injection into cellular calls depends on device OEM restrictions.",
                        color = Color(0xFF8392AB),
                        fontSize = 11.sp,
                        lineHeight = 16.sp
                    )
                }
            }
        }

        if (statusBanner != null) {
            item {
                Surface(
                    color = Color(0xFF112A22),
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, Color(0xFF2B5D4A))
                ) {
                    Text(
                        statusBanner ?: "",
                        color = Color(0xFF8DE6C2),
                        fontSize = 12.sp,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }
        }

        item {
            Surface(
                color = Color(0xFF111A2A),
                shape = RoundedCornerShape(22.dp),
                border = BorderStroke(1.dp, Color(0xFF22324C))
            ) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    when (callPhase) {
                        "idle" -> {
                            Text(
                                "Test Inbound Call Assistant",
                                color = Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                listOf(
                                    "Delivery" to "+91 98765 43210",
                                    "Spam Offer" to "+91 14000 88123",
                                    "Mom" to "+91 98111 22334"
                                ).forEach { (presetName, presetNum) ->
                                    OutlinedButton(
                                        onClick = {
                                            callerName = presetName
                                            callerNumber = presetNum
                                        },
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                        border = BorderStroke(1.dp, Color(0xFF2A3E61))
                                    ) {
                                        Text(presetName, fontSize = 11.sp, color = Color(0xFF9FC2FF))
                                    }
                                }
                            }
                            OutlinedTextField(
                                value = callerName,
                                onValueChange = { callerName = it },
                                label = { Text("Caller Name") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = callerNumber,
                                onValueChange = { callerNumber = it },
                                label = { Text("Caller Number") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Button(
                                onClick = {
                                    statusBanner = null
                                    ringCountdown = 3
                                    callPhase = "ringing"
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(50.dp),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F8CFF))
                            ) {
                                Icon(Icons.Default.PhoneInTalk, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text("Simulate Incoming Call", fontWeight = FontWeight.SemiBold)
                            }
                        }

                        "ringing" -> {
                            Text(
                                "INCOMING CALL",
                                color = Color(0xFF9FC2FF),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.4.sp
                            )
                            Text(callerName, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                            Text(callerNumber, color = Color(0xFF9BAAC2), fontSize = 14.sp)
                            Text(
                                if (settings.autoPickupEnabled && settings.pickupDelayMode != "manual")
                                    "CHARLOK auto-picking up in ${ringCountdown}s..."
                                else
                                    "Waiting for manual answer...",
                                color = Color(0xFF8DE6C2),
                                fontSize = 13.sp
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Button(
                                    onClick = { answerSimulatedCall() },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2DA66F))
                                ) {
                                    Text("Pick up now", fontWeight = FontWeight.SemiBold)
                                }
                                Button(
                                    onClick = { callPhase = "idle" },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD94A5D))
                                ) {
                                    Text("Decline", fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }

                        "active" -> {
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text("CONNECTED · CHARLOK ACTIVE", color = Color(0xFF8DE6C2), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    Text("$callerName ($callerNumber)", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                }
                                IconButton(
                                    onClick = { endSimulatedCall() },
                                    modifier = Modifier
                                        .background(Color(0xFFD94A5D), CircleShape)
                                ) {
                                    Icon(Icons.Default.CallEnd, contentDescription = "End Call", tint = Color.White)
                                }
                            }

                            Column(
                                Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFF080D18), RoundedCornerShape(14.dp))
                                    .padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                transcript.forEach { line ->
                                    val isCharlok = line.startsWith("CHARLOK:")
                                    Text(
                                        line,
                                        color = if (isCharlok) Color(0xFF9FC2FF) else Color(0xFFEAF0FF),
                                        fontSize = 13.sp,
                                        lineHeight = 18.sp
                                    )
                                }
                            }

                            if (speechRecognizer != null) {
                                Button(
                                    onClick = {
                                        if (!hasMicPermission) {
                                            onRequestPermissions()
                                            return@Button
                                        }
                                        if (isListening) {
                                            speechRecognizer.stopListening()
                                            isListening = false
                                        } else {
                                            tts?.stop()
                                            speechRecognizer.setRecognitionListener(object : RecognitionListener {
                                                override fun onReadyForSpeech(params: Bundle?) { isListening = true }
                                                override fun onBeginningOfSpeech() {}
                                                override fun onRmsChanged(rmsdB: Float) {}
                                                override fun onBufferReceived(buffer: ByteArray?) {}
                                                override fun onEndOfSpeech() { isListening = false }
                                                override fun onError(error: Int) { isListening = false }
                                                override fun onResults(results: Bundle?) {
                                                    isListening = false
                                                    val spoken = results
                                                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                                                        ?.firstOrNull()
                                                    if (!spoken.isNullOrBlank()) {
                                                        sendCallerMessage(spoken)
                                                    }
                                                }
                                                override fun onPartialResults(partialResults: Bundle?) {}
                                                override fun onEvent(eventType: Int, params: Bundle?) {}
                                            })
                                            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                                putExtra(
                                                    RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                                                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                                                )
                                                putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                                            }
                                            speechRecognizer.startListening(intent)
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (isListening) Color(0xFFD94A5D) else Color(0xFF1B3154)
                                    )
                                ) {
                                    Icon(
                                        if (isListening) Icons.Default.Stop else Icons.Default.Mic,
                                        contentDescription = null
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text(if (isListening) "Listening... Tap to Stop" else "Speak as Caller (Mic)")
                                }
                            }

                            Row(
                                Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedTextField(
                                    value = callerInput,
                                    onValueChange = { callerInput = it },
                                    placeholder = { Text("Type caller reply...") },
                                    singleLine = true,
                                    modifier = Modifier.weight(1f)
                                )
                                IconButton(
                                    onClick = {
                                        val msg = callerInput
                                        callerInput = ""
                                        sendCallerMessage(msg)
                                    },
                                    modifier = Modifier.background(Color(0xFF4F8CFF), CircleShape)
                                ) {
                                    Icon(Icons.Default.Send, contentDescription = "Send", tint = Color.White)
                                }
                            }
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
private fun HistoryScreen(
    history: List<CallLogItem>,
    onDeleteItem: (String) -> Unit,
    onClearAll: () -> Unit,
    onGoToCalls: () -> Unit
) {
    val formatter = remember { SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault()) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Spacer(Modifier.height(14.dp))
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Call History", color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                    Text("${history.size} recorded inbound calls", color = Color(0xFF8392AB), fontSize = 12.sp)
                }
                if (history.isNotEmpty()) {
                    TextButton(onClick = onClearAll) {
                        Text("Clear all", color = Color(0xFFFF8A9B))
                    }
                }
            }
        }

        if (history.isEmpty()) {
            item {
                Surface(
                    color = Color(0xFF111A2A),
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, Color(0xFF22324C))
                ) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(22.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text("No calls recorded yet", color = Color.White, fontWeight = FontWeight.SemiBold)
                        Text(
                            "Real incoming SIM calls and simulated test calls will appear here.",
                            color = Color(0xFF8392AB),
                            fontSize = 12.sp
                        )
                        Button(
                            onClick = onGoToCalls,
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F8CFF))
                        ) {
                            Text("Test Inbound Call")
                        }
                    }
                }
            }
        } else {
            items(history, key = { it.id }) { item ->
                Surface(
                    color = Color(0xFF111A2A),
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, Color(0xFF22324C))
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(item.callerLabel, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Text(
                                    "${item.callerNumber} · ${formatter.format(Date(item.timestampMs))}",
                                    color = Color(0xFF8392AB),
                                    fontSize = 11.sp
                                )
                            }
                            Surface(color = Color(0xFF1B3154), shape = RoundedCornerShape(50)) {
                                Text(
                                    item.status,
                                    color = Color(0xFF9FC2FF),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                            IconButton(onClick = { onDeleteItem(item.id) }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFF8392AB))
                            }
                        }
                        if (item.summary.isNotBlank()) {
                            Text(item.summary, color = Color(0xFFD1DDF3), fontSize = 13.sp)
                        }
                        if (item.transcriptLines.isNotEmpty()) {
                            Column(
                                Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFF080D18), RoundedCornerShape(12.dp))
                                    .padding(10.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                item.transcriptLines.forEach { line ->
                                    Text(line, color = Color(0xFF9BAAC2), fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
private fun SettingsScreen(
    settings: CharlokSettings,
    onUpdateSettings: (CharlokSettings) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Spacer(Modifier.height(14.dp))
            Text("Call Preferences", color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold)
            Text("Saved automatically for incoming SIM & test calls", color = Color(0xFF8392AB), fontSize = 12.sp)
        }
        item {
            Surface(
                color = Color(0xFF111A2A),
                shape = RoundedCornerShape(20.dp),
                border = BorderStroke(1.dp, Color(0xFF22324C))
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    OutlinedTextField(
                        value = settings.ownerName,
                        onValueChange = { onUpdateSettings(settings.copy(ownerName = it)) },
                        label = { Text("Your Name (Answering For)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Text("Inbound Pickup Timing", color = Color(0xFF9FC2FF), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    listOf(
                        "ring_3s" to "Auto-pickup (3s ring)",
                        "instant" to "Instant auto-pickup",
                        "manual" to "Manual answer only"
                    ).forEach { (modeId, label) ->
                        val selected = settings.pickupDelayMode == modeId
                        Surface(
                            color = if (selected) Color(0xFF172C50) else Color(0xFF0D1524),
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, if (selected) Color(0xFF4F8CFF) else Color(0xFF22324C)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onUpdateSettings(
                                        settings.copy(
                                            pickupDelayMode = modeId,
                                            autoPickupEnabled = modeId != "manual"
                                        )
                                    )
                                }
                        ) {
                            Text(
                                label,
                                color = if (selected) Color.White else Color(0xFF9BAAC2),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(14.dp)
                            )
                        }
                    }

                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("Speak greeting on pickup", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            Text("Uses Android Text-to-Speech when call answers", color = Color(0xFF8392AB), fontSize = 11.sp)
                        }
                        Switch(
                            checked = settings.speakGreetingOnPickup,
                            onCheckedChange = { onUpdateSettings(settings.copy(speakGreetingOnPickup = it)) }
                        )
                    }

                    Text("Screening Behaviour", color = Color(0xFF9FC2FF), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    listOf(
                        "screen_message" to "Screen & Take Message",
                        "friendly_receptionist" to "Friendly Receptionist",
                        "strict_spam" to "Strict Spam Filter"
                    ).forEach { (modeId, label) ->
                        val selected = settings.screeningMode == modeId
                        Surface(
                            color = if (selected) Color(0xFF172C50) else Color(0xFF0D1524),
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, if (selected) Color(0xFF4F8CFF) else Color(0xFF22324C)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onUpdateSettings(settings.copy(screeningMode = modeId)) }
                        ) {
                            Text(
                                label,
                                color = if (selected) Color.White else Color(0xFF9BAAC2),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(14.dp)
                            )
                        }
                    }

                    OutlinedTextField(
                        value = settings.customGreeting,
                        onValueChange = { onUpdateSettings(settings.copy(customGreeting = it)) },
                        label = { Text("Custom Opening Greeting (Optional)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
private fun PermissionRow(label: String, granted: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(
            if (granted) Icons.Default.CheckCircle else Icons.Default.Warning,
            contentDescription = null,
            tint = if (granted) Color(0xFF5CE0A8) else Color(0xFFFFB86C),
            modifier = Modifier.size(18.dp)
        )
        Text(
            label,
            color = if (granted) Color(0xFFEAF0FF) else Color(0xFFD1DDF3),
            fontSize = 13.sp
        )
    }
}

@Composable
private fun Header(isActive: Boolean) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(44.dp)
                .background(Brush.linearGradient(listOf(Color(0xFF4F8CFF), Color(0xFF63D5FF))), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text("C", color = Color.White, fontWeight = FontWeight.Black, fontSize = 23.sp)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text("CHARLOK", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.2.sp)
            Text("AI CALL ASSISTANT", color = Color(0xFF8193B0), fontSize = 9.sp, letterSpacing = 1.6.sp)
        }
        Surface(
            color = if (isActive) Color(0xFF112A22) else Color(0xFF15243B),
            shape = RoundedCornerShape(50)
        ) {
            Text(
                if (isActive) "ACTIVE" else "ANDROID",
                color = if (isActive) Color(0xFF8DE6C2) else Color(0xFF9FC2FF),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
            )
        }
    }
}

@Composable
private fun FeatureCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    status: String,
    onClick: () -> Unit
) {
    Surface(
        color = Color(0xFF111A2A),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Color(0xFF22324C)),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(17.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(46.dp)
                    .background(Color(0xFF1B3154), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = Color(0xFF83AEFF))
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                Spacer(Modifier.height(4.dp))
                Text(subtitle, color = Color(0xFF9BAAC2), fontSize = 12.sp, lineHeight = 16.sp)
            }
            Text(status, color = Color(0xFF80AFFF), fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }
    }
}
