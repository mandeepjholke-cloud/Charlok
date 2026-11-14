package com.charlok.assistant.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val CharlokColors = darkColorScheme(
    primary = Color(0xFF4F8CFF),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF69D4FF),
    background = Color(0xFF080D18),
    onBackground = Color(0xFFF4F7FF),
    surface = Color(0xFF111A2A),
    onSurface = Color(0xFFEAF0FF),
    surfaceVariant = Color(0xFF1A2740),
    onSurfaceVariant = Color(0xFFAAB8D0)
)

@Composable
fun CHARLOKTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = CharlokColors, content = content)
}
