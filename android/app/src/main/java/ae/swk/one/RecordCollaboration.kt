package ae.swk.one

import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

@Composable fun RecordCollaboration(model: WorkspaceModel, entity: JSONObject, record: JSONObject) {
    val context = LocalContext.current
    val uiState by model.state.collectAsState()
    val key = entity.text("key"); val id = record.optInt("id")
    var comments by remember(id, key) { mutableStateOf<List<JSONObject>>(emptyList()) }
    var comment by remember(id, key) { mutableStateOf("") }
    var files by remember(id, key) { mutableStateOf<List<JSONObject>>(emptyList()) }
    var failure by remember(id, key) { mutableStateOf<String?>(null) }
    var preview by remember { mutableStateOf<JSONObject?>(null) }
    if (preview != null) DocumentViewer(model, preview!!) { preview = null }
    var generation by remember { mutableIntStateOf(0) }
    LaunchedEffect(id, key, generation) {
        if (entity.optBoolean("panel")) try {
            comments = (model.api.request("/api/panel/$key/$id/comments") as JSONArray).objects()
            val filters = java.net.URLEncoder.encode(JSONArray().put(JSONObject().put("field", "link_entity").put("op", "eq").put("value", key)).put(JSONObject().put("field", "link_id").put("op", "eq").put("value", id)).toString(), "UTF-8")
            if (model.entities().any { it.text("key") == "attachments" }) files = model.api.obj("/api/e/attachments?filters=$filters").optJSONArray("rows")?.objects().orEmpty()
        } catch (e: Exception) { failure = e.message }
    }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) model.action {
            val (name, data) = withContext(Dispatchers.IO) {
                val name = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else "document" } ?: "document"
                val data = context.contentResolver.openInputStream(uri)?.use { it.readBytesLimited() } ?: throw IllegalStateException("File could not be opened")
                name to data
            }
            model.api.upload(key, id, name, context.contentResolver.getType(uri) ?: "application/octet-stream", data)
            generation++; model.notice("Document attached to SWK OS")
        }
    }
    if (entity.optBoolean("panel")) Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HorizontalDivider(); Text("Record discussion & evidence", style = MaterialTheme.typography.titleMedium)
        failure?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
        comments.takeLast(10).forEach { c -> Card(modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) { Text(c.text("user_name"), style = MaterialTheme.typography.labelSmall); Text(c.text("body").ifBlank { c.text("text") }); Text(c.text("created_at"), style = MaterialTheme.typography.labelSmall) } } }
        if (model.permitted(entity, "edit")) {
            OutlinedTextField(comment, { comment = it }, label = { Text("Add a follow-up note") }, modifier = Modifier.fillMaxWidth())
            TextButton(onClick = { model.action { model.api.obj("/api/panel/$key/$id/comments", "POST", JSONObject().put("body", comment)); comment = ""; generation++ } }, enabled = comment.isNotBlank() && !uiState.loading) { Text("Save note") }
            OutlinedButton(onClick = { picker.launch(arrayOf("image/*", "application/pdf", "text/plain")) }) { Text("Attach photo or document") }
        }
        files.forEach { f -> TextButton(onClick = { preview = f }) { Text("Preview ${f.text("file_name")}") } }
    }
}
private fun java.io.InputStream.readBytesLimited(): ByteArray {
    val output = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
    while (true) { val count = read(buffer); if (count < 0) break; require(output.size() + count <= 10 * 1024 * 1024) { "Choose a file smaller than 10 MB" }; output.write(buffer, 0, count) }
    return output.toByteArray()
}
