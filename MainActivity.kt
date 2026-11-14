package com.charlok.assistant

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.charlok.assistant.ui.theme.CHARLOKTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { CHARLOKTheme { CharlokHome() } }
    }
}

@Composable
private fun CharlokHome() {
    var selected by remember { mutableIntStateOf(0) }
    val pages = listOf("Home", "Calls", "History", "Settings")
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(containerColor = Color(0xFF0D1524)) {
                val icons = listOf(Icons.Default.Home, Icons.Default.Call, Icons.Default.History, Icons.Default.Settings)
                pages.forEachIndexed { index, label ->
                    NavigationBarItem(
                        selected = selected == index,
                        onClick = { selected = index },
                        icon = { Icon(icons[index], contentDescription = label) },
                        label = { Text(label) },
                        colors = NavigationBarItemDefaults.colors(selectedIconColor = Color(0xFF75A5FF), indicatorColor = Color(0xFF1D3154), selectedTextColor = Color.White, unselectedTextColor = Color(0xFF8392AB))
                    )
                }
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            item { Spacer(Modifier.height(14.dp)); Header() }
            item {
                Column(
                    Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(Color(0xFF173B75), Color(0xFF17243D), Color(0xFF111A2A))), RoundedCornerShape(28.dp)).padding(22.dp)
                ) {
                    Text("YOUR AI CALL ASSISTANT", color = Color(0xFF9FC2FF), fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.4.sp)
                    Spacer(Modifier.height(10.dp))
                    Text("Your calls.\nHandled smarter.", color = Color.White, fontSize = 27.sp, lineHeight = 33.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    Text("CHARLOK helps you stay on top of important conversations.", color = Color(0xFFD1DDF3), fontSize = 14.sp)
                    Spacer(Modifier.height(22.dp))
                    Button(onClick = { selected = 1 }, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F8CFF))) {
                        Icon(Icons.Default.Call, contentDescription = null)
                        Spacer(Modifier.width(9.dp))
                        Text("Set up call assistant", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
            item { Text("Your workspace", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold) }
            item { FeatureCard("Call assistant", "Choose how CHARLOK handles incoming calls", Icons.Default.Call, "Setup required") }
            item { FeatureCard("Recent conversations", "Review callers and conversation activity", Icons.Default.History, "Coming next") }
            item { FeatureCard("Call preferences", "Voice, availability and assistant behaviour", Icons.Default.Tune, "Coming next") }
            item {
                Text("Privacy first", color = Color(0xFF9FB0CA), fontSize = 12.sp, modifier = Modifier.padding(vertical = 8.dp))
                Text("Call access, microphone and contacts will only be requested when you enable the related feature.", color = Color(0xFF8392AB), fontSize = 12.sp, lineHeight = 18.sp)
                Spacer(Modifier.height(20.dp))
            }
        }
    }
}

@Composable
private fun Header() {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(44.dp).background(Brush.linearGradient(listOf(Color(0xFF4F8CFF), Color(0xFF63D5FF))), CircleShape), contentAlignment = Alignment.Center) {
            Text("C", color = Color.White, fontWeight = FontWeight.Black, fontSize = 23.sp)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text("CHARLOK", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.2.sp)
            Text("AI CALL ASSISTANT", color = Color(0xFF8193B0), fontSize = 9.sp, letterSpacing = 1.6.sp)
        }
        Surface(color = Color(0xFF15243B), shape = RoundedCornerShape(50)) {
            Text("PREVIEW", color = Color(0xFF9FC2FF), fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
        }
    }
}

@Composable
private fun FeatureCard(title: String, subtitle: String, icon: androidx.compose.ui.graphics.vector.ImageVector, status: String) {
    Surface(color = Color(0xFF111A2A), shape = RoundedCornerShape(20.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF22324C))) {
        Row(Modifier.fillMaxWidth().padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(46.dp).background(Color(0xFF1B3154), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
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
