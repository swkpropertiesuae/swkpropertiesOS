package ae.swk.one

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Emerald = Color(0xFF007B52)
val Fold = Color(0xFF025E3D)
val Canvas = Color(0xFFF1F6F3)
val Ink = Color(0xFF161D1A)
val Champagne = Color(0xFFF5F1E9)
@Composable fun SwkTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) darkColorScheme(primary = Color(0xFF83DAB3), secondary = Color(0xFFE5D1A4), background = Color(0xFF101B16), surface = Color(0xFF192820), surfaceVariant = Color(0xFF26372D))
    else lightColorScheme(primary = Emerald, secondary = Fold, background = Canvas, surface = Color.White, surfaceVariant = Color(0xFFE6EBE7), onBackground = Ink, onSurface = Ink)
    MaterialTheme(colorScheme = colors, content = content)
}
