@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package ae.swk.one

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.time.LocalDate
import java.time.ZoneId

/** Native metadata-driven editors keep validation and record schemas aligned with SWK OS. */
@Composable fun RecordForm(model: WorkspaceModel, entity: JSONObject, record: JSONObject?) {
    val fields = remember(entity, record) { entity.optJSONArray("fields")?.objects()?.filter { !it.optBoolean("readonly") && !it.optBoolean("computed") && !it.optBoolean("hidden") && !it.optBoolean("secret") && !it.optBoolean("virtual") } ?: emptyList() }
    val values = remember(entity, record) { mutableStateMapOf<String, String>().apply {
        fields.forEach { f ->
            val name = f.text("name")
            put(name, if (record != null) record.text(name) else when (val default = f.text("default")) {
                "today" -> LocalDate.now(ZoneId.of("Asia/Dubai")).toString()
                "me" -> model.state.value.user?.text("id").orEmpty()
                else -> default
            })
        }
    } }
    var errors by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    val loading by model.state.collectAsState()
    Column(Modifier.fillMaxSize().imePadding()) {
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(if (record == null) "New ${entity.text("label")}" else "Edit ${entity.text("label")}", style = MaterialTheme.typography.headlineSmall)
            Text("Changes save to the same SWK OS records. Required fields are marked *.", style = MaterialTheme.typography.bodySmall)
            fields.forEach { field ->
                if (field.text("section").isNotBlank()) Text(field.text("section"), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                val name = field.text("name"); val value = values[name].orEmpty()
                val label = field.text("label") + if (field.optBoolean("required")) " *" else ""
                when (field.text("type")) {
                    "select" -> SelectField(label, value, field.optJSONArray("options") ?: JSONArray(), { values[name] = it })
                    "bool" -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(label, Modifier.weight(1f)); Switch(value == "true" || value == "1", { values[name] = it.toString() }) }
                    "ref" -> ReferenceField(model, field, label, value) { values[name] = it }
                    else -> OutlinedTextField(value, { values[name] = it }, label = { Text(label) }, modifier = Modifier.fillMaxWidth(),
                        minLines = if (field.text("type") in listOf("textarea", "json")) 3 else 1,
                        isError = errors.containsKey(name), supportingText = { Text(errors[name] ?: when (field.text("type")) { "date" -> "YYYY-MM-DD"; "datetime" -> "UTC date/time: YYYY-MM-DDTHH:mm (Dubai is UTC+4)"; "json" -> "Valid JSON"; else -> field.text("help") }) },
                        keyboardOptions = KeyboardOptions(keyboardType = when (field.text("type")) { "int", "number", "money", "percent" -> KeyboardType.Decimal; "email" -> KeyboardType.Email; "phone" -> KeyboardType.Phone; "url" -> KeyboardType.Uri; else -> KeyboardType.Text }))
                }
                if (errors[name] != null && field.text("type") in listOf("select", "ref")) Text(errors[name]!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        }
        Surface(shadowElevation = 6.dp) { Button(onClick = {
            val invalid = mutableMapOf<String, String>(); val payload = JSONObject()
            fields.forEach { f ->
                val name = f.text("name"); val v = values[name].orEmpty().trim(); val type = f.text("type")
                if (v.isEmpty()) { if (f.optBoolean("required")) invalid[name] = "This field is required" else if (record != null && record.has(name) && !record.isNull(name)) payload.put(name, JSONObject.NULL) }
                else try {
                    val typed: Any = when (type) {
                        "int", "ref" -> v.toLong()
                        "number", "money", "percent" -> v.toDouble().also { require(it.isFinite()) }
                        "bool" -> v == "true" || v == "1"
                        "json" -> if (v.startsWith("[")) JSONArray(v) else JSONObject(v)
                        "date" -> LocalDate.parse(v).toString()
                        else -> v
                    }
                    if (typed is Number && f.has("min") && typed.toDouble() < f.optDouble("min")) throw IllegalArgumentException()
                    if (typed is Number && f.has("max") && typed.toDouble() > f.optDouble("max")) throw IllegalArgumentException()
                    payload.put(name, typed)
                } catch (_: Exception) { invalid[name] = "Enter a valid ${f.text("label").lowercase()}" }
            }
            errors = invalid
            if (invalid.isEmpty()) model.save(entity, record, payload)
        }, enabled = !loading.loading, modifier = Modifier.fillMaxWidth().padding(16.dp).height(52.dp)) { Text("Save to SWK OS") } }
    }
}
@Composable private fun SelectField(label: String, value: String, options: JSONArray, changed: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val choices = (0 until options.length()).map { i -> val o = options.get(i); if (o is JSONObject) o.text("value") to o.text("label").ifBlank { o.text("value") } else o.toString() to o.toString() }
    ExposedDropdownMenuBox(expanded = open, onExpandedChange = { open = !open }) {
        OutlinedTextField(choices.firstOrNull { it.first == value }?.second ?: value, {}, label = { Text(label) }, readOnly = true, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(open) }, modifier = Modifier.menuAnchor().fillMaxWidth())
        ExposedDropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(text = { Text("Clear") }, onClick = { changed(""); open = false })
            choices.forEach { (v, text) -> DropdownMenuItem(text = { Text(text) }, onClick = { changed(v); open = false }) }
        }
    }
}
@Composable private fun ReferenceField(model: WorkspaceModel, field: JSONObject, label: String, value: String, changed: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }; var query by remember { mutableStateOf("") }; var rows by remember { mutableStateOf<List<JSONObject>>(emptyList()) }; var title by remember(value) { mutableStateOf(if (value.isBlank()) "Choose record" else "Record #$value") }; var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    fun search() { scope.launch {
        try {
            val filter = field.optJSONObject("refFilter")?.let { "&filter=${URLEncoder.encode(it.toString(), "UTF-8")}" }.orEmpty()
            rows = (model.api.request("/api/e/${field.text("ref")}/lookup?q=${URLEncoder.encode(query, "UTF-8")}$filter") as JSONArray).objects(); error = null
        } catch (e: Exception) { error = e.message }
    } }
    LaunchedEffect(value) { if (value.isNotBlank()) runCatching { (model.api.request("/api/e/${field.text("ref")}/lookup?ids=$value") as JSONArray).objects().firstOrNull()?.let { title = it.text("label") } } }
    OutlinedButton(onClick = { open = true; search() }, modifier = Modifier.fillMaxWidth()) { Text("$label: $title") }
    if (open) AlertDialog(onDismissRequest = { open = false }, title = { Text(label) }, text = {
        Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(query, { query = it }, label = { Text("Search") }, modifier = Modifier.fillMaxWidth())
            TextButton(onClick = { search() }) { Text("Find records") }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            rows.forEach { row -> TextButton(onClick = { changed(row.text("id")); title = row.text("label"); open = false }) { Text(row.text("label")) } }
            if (rows.isEmpty() && error == null) Text("No matching records")
        }
    }, confirmButton = { TextButton(onClick = { open = false }) { Text("Close") } }, dismissButton = { TextButton(onClick = { changed(""); open = false }) { Text("Clear") } })
}
