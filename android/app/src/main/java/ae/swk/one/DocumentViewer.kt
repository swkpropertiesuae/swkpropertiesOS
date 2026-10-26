package ae.swk.one

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File

/** Documents remain in app-private temporary storage; no external viewer or public URL. */
@Composable fun DocumentViewer(model: WorkspaceModel, file: JSONObject, close: () -> Unit) {
    val context = LocalContext.current
    var bitmap by remember { mutableStateOf<Bitmap?>(null) }; var error by remember { mutableStateOf<String?>(null) }
    var page by remember { mutableIntStateOf(0) }; var total by remember { mutableIntStateOf(1) }; var bytes by remember { mutableStateOf<ByteArray?>(null) }
    val temporary = remember { File.createTempFile("preview-", ".pdf", context.cacheDir) }
    DisposableEffect(Unit) { onDispose { temporary.delete() } }
    LaunchedEffect(file.optInt("id")) { try { bytes = model.api.download(file.optInt("id")) } catch (e: Exception) { error = e.message } }
    LaunchedEffect(bytes, page) { bytes?.let { data ->
        try {
            val rendered = withContext(Dispatchers.IO) {
                if (file.text("mime").contains("pdf") || file.text("file_name").endsWith(".pdf", true)) {
                    temporary.writeBytes(data)
                    ParcelFileDescriptor.open(temporary, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
                        PdfRenderer(descriptor).use { pdf -> total = pdf.pageCount; require(total > 0); pdf.openPage(page).use { p ->
                            val width = 1400; val height = (p.height.toDouble() / p.width * width).toInt().coerceIn(1, 2400)
                            Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also { it.eraseColor(android.graphics.Color.WHITE); p.render(it, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY) }
                        } }
                    }
                } else {
                    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeByteArray(data, 0, data.size, bounds)
                    require(bounds.outWidth > 0) { "Preview supports PDF and images. Open other file types through SWK OS." }
                    val options = BitmapFactory.Options().apply { inSampleSize = (maxOf(bounds.outWidth, bounds.outHeight) / 1600).coerceAtLeast(1) }
                    BitmapFactory.decodeByteArray(data, 0, data.size, options) ?: throw IllegalStateException("Cannot decode image")
                }
            }
            bitmap = rendered
        } catch (e: Exception) { error = e.message }
    } }
    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false, securePolicy = androidx.compose.ui.window.SecureFlagPolicy.SecureOn)) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(file.text("file_name"), style = MaterialTheme.typography.titleMedium)
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Box(Modifier.weight(1f)) { if (bitmap != null) Image(bitmap!!.asImageBitmap(), file.text("file_name"), Modifier.fillMaxSize()) else if (error == null) CircularProgressIndicator() }
            if (total > 1) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = { page-- }, enabled = page > 0) { Text("Previous") }; Text("${page + 1} / $total"); TextButton(onClick = { page++ }, enabled = page + 1 < total) { Text("Next") }
            }
            Button(onClick = close, modifier = Modifier.fillMaxWidth()) { Text("Close preview") }
        } }
    }
}
