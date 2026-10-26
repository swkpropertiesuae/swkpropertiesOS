@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package ae.swk.one

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable fun SwkApp(model: WorkspaceModel, locked: Boolean, unlock: () -> Unit, clock: (String) -> Unit, startDuty: (Int, String) -> Unit, stopDuty: (Int) -> Unit) = SwkTheme {
    val state by model.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.message) { state.message?.let { snackbar.showSnackbar(it); model.clearNotice() } }
    if (state.error != null) AlertDialog(onDismissRequest = model::dismissError, title = { Text("Please check") }, text = { Text(state.error!!) }, confirmButton = { TextButton(onClick = model::dismissError) { Text("OK") } })
    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        when {
            locked -> Column(Modifier.fillMaxSize().padding(28.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                Brand(); Spacer(Modifier.height(32.dp)); Icon(Icons.Default.Lock, null, Modifier.size(48.dp)); Text("Your workspace is locked", style = MaterialTheme.typography.headlineSmall)
                Button(onClick = unlock) { Text("Unlock securely") }; TextButton(onClick = model::logout) { Text("Sign out") }
            }
            state.user == null -> Login(model, state)
            state.user!!.optBoolean("mustChangePassword") -> PasswordForm(model, true)
            else -> {
                val root = state.screen in listOf(Screen.Home, Screen.Workspaces, Screen.Field, Screen.Account)
                BackHandler(!root) { model.back() }
                Scaffold(containerColor = MaterialTheme.colorScheme.background, snackbarHost = { SnackbarHost(snackbar) },
                    topBar = {
                        TopAppBar(title = { Brand() }, navigationIcon = { if (!root) IconButton(onClick = model::back) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                            actions = { IconButton(onClick = model::refresh, enabled = !state.loading) { Icon(Icons.Default.Refresh, "Refresh from SWK OS") }; Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.primaryContainer) { Text(state.user!!.text("name").take(1).uppercase(), Modifier.padding(12.dp), fontWeight = FontWeight.Bold) }; Spacer(Modifier.width(12.dp)) },
                            colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background))
                    }, bottomBar = {
                        NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                            listOf(Triple(Screen.Home, "Today", Icons.Default.SpaceDashboard), Triple(Screen.Workspaces, "Workspaces", Icons.Default.Apps), Triple(Screen.Field, "Field duty", Icons.Default.NearMe), Triple(Screen.Account, "You", Icons.Default.PersonOutline)).forEach { (screen, label, icon) ->
                                NavigationBarItem(selected = state.screen == screen, onClick = { model.tab(screen) }, icon = { Icon(icon, label) }, label = { Text(label, fontSize = 11.sp) })
                            }
                        }
                    }) { padding ->
                    Column(Modifier.padding(padding).fillMaxSize()) {
                        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
                        Box(Modifier.weight(1f)) {
                            when (val screen = state.screen) {
                                Screen.Home -> Home(model, state, clock)
                                Screen.Workspaces -> Workspaces(model)
                                Screen.Field -> Field(model, state, startDuty, stopDuty)
                                Screen.Account -> Account(model, state)
                                Screen.Report -> Report(model, state)
                                is Screen.Records -> Records(model, state, screen.entity)
                                is Screen.Detail -> Detail(model, screen.entity, screen.record)
                                is Screen.Edit -> RecordForm(model, screen.entity, screen.record)
                            }
                        }
                    }
                }
            }
        }
    }
}
@Composable private fun Brand() { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
    Surface(color = Fold, shape = RoundedCornerShape(10.dp)) { Image(painterResource(R.drawable.swk_brand), "SWK Properties", Modifier.padding(6.dp).size(27.dp)) }
    Column { Text("SWK ONE", fontWeight = FontWeight.ExtraBold, letterSpacing = 2.sp, fontSize = 17.sp); Text("PROPERTIES · YOUR WORKDAY", fontSize = 8.sp, letterSpacing = 1.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
} }
@Composable private fun Login(model: WorkspaceModel, state: WorkspaceState) {
    var email by rememberSaveable { mutableStateOf("") }; var password by remember { mutableStateOf("") }; var code by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(28.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Spacer(Modifier.height(30.dp)); Brand(); Spacer(Modifier.height(28.dp))
        Surface(shape = RoundedCornerShape(28.dp), color = Fold) { Column(Modifier.padding(28.dp)) {
            Text("ONE WORKSPACE.\nEVERY OPPORTUNITY.", color = Color(0xFFE5D1A4), fontSize = 11.sp, letterSpacing = 2.sp)
            Spacer(Modifier.height(22.dp)); Text("Make today\nmove forward.", color = Color.White, fontSize = 35.sp, fontWeight = FontWeight.Bold, lineHeight = 42.sp)
            Spacer(Modifier.height(18.dp)); Text("Your clients, properties and team.\nConnected to SWK OS.", color = Color(0xFFD3EEE0), lineHeight = 23.sp)
        } }
        Text("Welcome to SWK ONE", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        OutlinedTextField(email, { email = it }, label = { Text("Company email") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(password, { password = it }, label = { Text("Password") }, visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth())
        if (state.totp) OutlinedTextField(code, { code = it.filter(Char::isDigit).take(6) }, label = { Text("Authenticator code") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        Button(onClick = { model.login(email, password, code) }, enabled = !state.loading && email.isNotBlank() && password.isNotBlank(), modifier = Modifier.fillMaxWidth().height(54.dp)) { if (state.loading) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp) else Text("Sign in securely") }
        Text("Use your existing SWK OS account. Access follows your company role.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
@Composable private fun Section(title: String, subtitle: String? = null) { Column(Modifier.padding(vertical = 5.dp)) { Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold); subtitle?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } } }
@Composable private fun Tile(title: String, subtitle: String, icon: ImageVector = Icons.Default.ArrowOutward, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.primaryContainer) { Icon(icon, null, Modifier.padding(12.dp).size(23.dp), tint = MaterialTheme.colorScheme.onPrimaryContainer) }
            Column(Modifier.weight(1f)) { Text(title, fontWeight = FontWeight.SemiBold); if (subtitle.isNotBlank()) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Icon(Icons.AutoMirrored.Filled.ArrowForward, "Open", Modifier.size(18.dp))
        }
    }
}
@Composable private fun Home(model: WorkspaceModel, state: WorkspaceState, clock: (String) -> Unit) {
    val day = state.workday
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Text(LocalDate.now(ZoneId.of("Asia/Dubai")).format(DateTimeFormatter.ofPattern("EEEE, d MMMM")).uppercase(), style = MaterialTheme.typography.labelSmall, letterSpacing = 1.4.sp); Text("Hello, ${state.user?.text("name")?.substringBefore(' ')}.", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold); Text("Your next move starts here.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        item { Card(shape = RoundedCornerShape(26.dp), colors = CardDefaults.cardColors(containerColor = Fold)) {
            Column(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(Fold, Color(0xFF094E3A)))).padding(24.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
                Text("TODAY’S WORKDAY", color = Color(0xFFE5D1A4), fontSize = 11.sp, letterSpacing = 1.6.sp)
                val attendance = day.optJSONArray("attendance")?.objects()?.firstOrNull()
                Text(when { attendance == null -> "Ready when you are."; attendance.text("check_out_at").isNotBlank() -> "Workday checked out."; else -> "You’re checked in." }, fontSize = 26.sp, color = Color.White, fontWeight = FontWeight.Bold)
                Text("Office proximity is recorded as evidence. Indoor entry requires independent verification.", color = Color(0xFFD3EEE0), style = MaterialTheme.typography.bodySmall)
                Button(onClick = { clock(if (attendance == null) "in" else "out") }, enabled = !state.loading && day.optBoolean("office_checkin_configured") && (attendance == null || attendance.text("check_out_at").isBlank()), colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Fold)) { Icon(Icons.Default.MyLocation, null, Modifier.size(17.dp)); Spacer(Modifier.width(8.dp)); Text(if (attendance == null) "Check in at office" else "Check out") }
                if (!day.optBoolean("office_checkin_configured")) Text(day.text("setup").ifBlank { "Office check-in awaits verified location configuration." }, color = Color(0xFFE5D1A4), style = MaterialTheme.typography.bodySmall)
            }
        } }
        item { Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            listOf(Triple("Tasks", day.optJSONArray("tasks")?.length() ?: 0, "tasks"), Triple("Field visits", day.optJSONArray("field")?.length() ?: 0, "field_sessions")).forEach { (label, count, key) ->
                Card(onClick = { model.openEntity(key) }, modifier = Modifier.weight(1f), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(20.dp)) { Column(Modifier.padding(20.dp)) { Text(count.toString(), fontSize = 32.sp, fontWeight = FontWeight.Bold); Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
            }
        } }
        item { Section("Your daily essentials", "Less switching. More progress.") }
        item { Tile("My leads", "Follow up and move conversations forward", Icons.Default.PeopleOutline) { model.openEntity("leads") } }
        item { Tile("Property viewings", "Appointments, feedback and follow-ups", Icons.Default.Event) { model.openEntity("viewings") } }
        item { Tile("Source inventory", "Submit a property for verification", Icons.Default.Apartment) { model.openEntity("inventory_submissions") } }
        item { Tile("Daily work report", "Review outcomes and submit for your manager", Icons.Default.FactCheck) { model.navigate(Screen.Report) } }
        if (state.notifications.isNotEmpty()) {
            item { Section("Company updates") }
            items(state.notifications.take(10)) { n -> Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Text(n.text("title"), fontWeight = FontWeight.SemiBold); Text(n.text("body"), style = MaterialTheme.typography.bodySmall) } } }
        }
        item { Text("Synced with SWK OS · Refresh for the latest records", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
@Composable private fun Workspaces(model: WorkspaceModel) {
    var search by rememberSaveable { mutableStateOf("") }
    val groups = model.entities().filter { it.text("plural").contains(search, true) || it.text("module").contains(search, true) }.groupBy { it.text("module") }
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Section("Your workspaces", "Every permitted business record, connected.") }
        item { OutlinedTextField(search, { search = it }, leadingIcon = { Icon(Icons.Default.Search, null) }, placeholder = { Text("Find a workspace") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(30.dp), singleLine = true) }
        groups.forEach { (module, entities) ->
            item { Text(module.replaceFirstChar { it.uppercase() }, Modifier.padding(top = 16.dp), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary) }
            items(entities) { e -> Tile(e.text("plural"), e.text("description").take(110), moduleIcon(module)) { model.navigate(Screen.Records(e)) } }
        }
        if (groups.isEmpty()) item { Text("No matching workspaces are available for your role.") }
    }
}
private fun moduleIcon(module: String): ImageVector = when (module) { "hr" -> Icons.Default.Badge; "properties", "mandates" -> Icons.Default.Apartment; "finance" -> Icons.Default.AccountBalanceWallet; "crm", "sales" -> Icons.Default.PeopleOutline; "compliance" -> Icons.Default.VerifiedUser; else -> Icons.Default.WorkOutline }
@Composable private fun Records(model: WorkspaceModel, state: WorkspaceState, entity: JSONObject) {
    var query by rememberSaveable(entity.text("key")) { mutableStateOf("") }
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Section(entity.text("plural"), entity.text("description").ifBlank { "Connected company records" }) }
        item { Row(verticalAlignment = Alignment.CenterVertically) { OutlinedTextField(query, { query = it }, label = { Text("Search records") }, modifier = Modifier.weight(1f), singleLine = true); IconButton(onClick = { model.search(query) }, enabled = !state.loading) { Icon(Icons.Default.Search, "Search") } } }
        if (model.permitted(entity, "create") && !entity.optBoolean("readonlyApi")) item { Button(onClick = { model.navigate(Screen.Edit(entity)) }, enabled = !state.loading) { Icon(Icons.Default.Add, null); Text("New ${entity.text("label")}") } }
        if (!state.loading && state.rows.isEmpty()) item { Empty("No records found", "Try another search or create a record if your role allows it.") }
        items(state.rows) { row -> RecordCard(entity, row) { model.detail(entity, row.optInt("id")) } }
        if (state.more) item { OutlinedButton(onClick = model::more, enabled = !state.loading, modifier = Modifier.fillMaxWidth()) { Text("Load more") } }
    }
}
@Composable private fun RecordCard(entity: JSONObject, row: JSONObject, click: () -> Unit) {
    Card(onClick = click, shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text(row.text("_title").ifBlank { "${entity.text("label")} #${row.optInt("id")}" }, fontWeight = FontWeight.Bold)
            val status = row.text(entity.text("statusField").ifBlank { "status" })
            if (status.isNotBlank()) SuggestionChip(onClick = click, label = { Text(status, fontSize = 11.sp) })
            entity.optJSONArray("fields")?.objects()?.filter { it.optBoolean("list") && !it.optBoolean("secret") && it.text("name") != entity.text("statusField") }?.take(3)?.forEach { f ->
                val value = fieldValue(row, f)
                if (value.isNotBlank()) Text("${f.text("label")}: $value", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
private fun fieldValue(record: JSONObject, field: JSONObject): String = if (field.text("type") == "ref") record.optJSONObject("_labels")?.text(field.text("name")).orEmpty().ifBlank { record.text(field.text("name")) } else record.text(field.text("name"))
@Composable private fun Detail(model: WorkspaceModel, entity: JSONObject, record: JSONObject) {
    val context = LocalContext.current
    var confirm by remember { mutableStateOf<Pair<String, String>?>(null) }
    val key = entity.text("key"); val id = record.optInt("id")
    if (confirm != null) AlertDialog(onDismissRequest = { confirm = null }, title = { Text(confirm!!.first) }, text = { Text("Apply this action to this SWK OS record?") }, confirmButton = { TextButton(onClick = { model.recordAction(confirm!!.second); confirm = null }) { Text("Confirm") } }, dismissButton = { TextButton(onClick = { confirm = null }) { Text("Cancel") } })
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Section(record.text("_title").ifBlank { "${entity.text("label")} #$id" }) }
        if (model.permitted(entity, "edit") && !entity.optBoolean("readonlyApi")) item { FilledTonalButton(onClick = { model.navigate(Screen.Edit(entity, record)) }) { Icon(Icons.Default.Edit, null); Text("Edit record") } }
        item { WorkflowActions(model, entity, record) }
        items(entity.optJSONArray("fields")?.objects()?.filter { !it.optBoolean("secret") && !it.optBoolean("hidden") && fieldValue(record, it).isNotBlank() } ?: emptyList()) { field ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) {
                Text(field.text("label"), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(fieldValue(record, field), Modifier.padding(top = 5.dp), style = MaterialTheme.typography.bodyLarge)
                if (field.text("type") == "phone") TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", record.text(field.text("name")), null))) }) { Text("Call") }
                if (field.text("type") == "email") TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.fromParts("mailto", record.text(field.text("name")), null))) }) { Text("Compose email") }
            } }
        }
        if (record.text("meeting_point").isNotBlank()) item { OutlinedButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=${Uri.encode(record.text("meeting_point"))}"))) }) { Icon(Icons.Default.NearMe, null); Text("Open navigation") } }
        item { RecordCollaboration(model, entity, record) }
        entity.optJSONArray("children")?.objects()?.forEach { child ->
            val children = record.optJSONObject("children")?.optJSONArray(child.text("key"))?.objects().orEmpty()
            if (children.isNotEmpty()) { item { Section(child.text("label")) }; items(children) { c -> Text(c.toString(2), style = MaterialTheme.typography.bodySmall) } }
        }
    }
}
@Composable private fun Field(model: WorkspaceModel, state: WorkspaceState, start: (Int, String) -> Unit, stop: (Int) -> Unit) {
    val sessions = state.workday.optJSONArray("field")?.objects().orEmpty()
    var sos by remember { mutableStateOf<JSONObject?>(null) }; var reason by remember { mutableStateOf("") }
    if (sos != null) AlertDialog(onDismissRequest = { sos = null }, title = { Text("Flag an urgent safety issue") }, text = { Column { Text("This flags your assignment for manager review. It does not contact emergency services or guarantee an immediate response."); OutlinedTextField(reason, { reason = it }, label = { Text("What support do you need?") }) } }, confirmButton = { TextButton(enabled = reason.trim().length >= 5, onClick = { model.recordAction("/api/mobile/field/${sos!!.optInt("id")}/sos", JSONObject().put("reason", reason)); sos = null }) { Text("Flag in SWK OS") } }, dismissButton = { TextButton(onClick = { sos = null }) { Text("Cancel") } })
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Section("Field duty", "Your location. Shared on your terms.") }
        item { Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Icon(Icons.Default.PrivacyTip, null); Text("Location sharing is visible", fontWeight = FontWeight.Bold); Text("Start a scheduled assignment to share duty location. A persistent notification lets you stop. Sharing ends at the assignment deadline. Managers receive last-known coordinates; poor signal can delay updates.", style = MaterialTheme.typography.bodySmall) } } }
        if (sessions.isEmpty()) item { Empty("No field assignments today", "Your manager can schedule assignments in SWK OS. Refresh after one is assigned.") }
        items(sessions) { session ->
            val active = session.text("status") in listOf("Active (On Duty)", "SOS Emergency Active")
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(session.text("assigned_location"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("${session.text("scheduled_start")} → ${session.text("scheduled_end")}", style = MaterialTheme.typography.bodySmall)
                Text(session.text("status"), color = MaterialTheme.colorScheme.primary)
                if (session.text("status") == "Scheduled") Button(onClick = { start(session.optInt("id"), session.text("scheduled_end")) }, enabled = !state.loading) { Text("Start sharing for this duty") }
                if (active) { Button(onClick = { stop(session.optInt("id")) }, enabled = !state.loading) { Text("End duty & stop sharing") }; OutlinedButton(onClick = { sos = session; reason = "" }) { Icon(Icons.Default.Sos, null); Text("Safety assistance") } }
            } }
        }
        item { Tile("Attendance & corrections", "View evidence and request a documented correction", Icons.Default.History) { model.openEntity("attendance_events") } }
    }
}
@Composable private fun Report(model: WorkspaceModel, state: WorkspaceState) {
    val key = "report_${state.user?.optInt("id")}"; val draft = remember { runCatching { JSONObject(model.api.vault.get(key) ?: "{}") }.getOrDefault(JSONObject()) }
    var outcomes by remember { mutableStateOf(draft.text("outcomes")) }; var blockers by remember { mutableStateOf(draft.text("blockers")) }; var next by remember { mutableStateOf(draft.text("next")) }; var confirm by remember { mutableStateOf(false) }
    if (confirm) AlertDialog(onDismissRequest = { confirm = false }, title = { Text("Submit today’s report?") }, text = { Text("SWK OS calculates evidence from company records and freezes the submitted report for manager review.") }, confirmButton = { TextButton(onClick = { confirm = false; model.submitReport(outcomes, blockers, next) }) { Text("Submit & freeze") } }, dismissButton = { TextButton(onClick = { confirm = false }) { Text("Keep editing") } })
    Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Section("Close the day with clarity", "Daily work report · ${state.workday.text("date")}")
        Text("Your narrative is separate from verified system metrics. Saved drafts are encrypted on this phone.", style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(outcomes, { outcomes = it }, label = { Text("Key outcomes achieved *") }, minLines = 4, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(blockers, { blockers = it }, label = { Text("Blockers & support needed") }, minLines = 3, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(next, { next = it }, label = { Text("Tomorrow’s priorities") }, minLines = 3, modifier = Modifier.fillMaxWidth())
        OutlinedButton(onClick = { model.api.vault.put(key, JSONObject().put("outcomes", outcomes).put("blockers", blockers).put("next", next).toString()); model.notice("Encrypted draft saved on this phone") }, modifier = Modifier.fillMaxWidth()) { Text("Save draft on device") }
        Button(onClick = { confirm = true }, enabled = outcomes.trim().length >= 10 && next.isNotBlank() && !state.loading, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Review & submit") }
    }
}
@Composable private fun Account(model: WorkspaceModel, state: WorkspaceState) {
    var security by remember { mutableStateOf(false) }; var biometric by remember { mutableStateOf(model.api.vault.get("biometric") == "true") }; var signout by remember { mutableStateOf(false) }
    if (signout) AlertDialog(onDismissRequest = { signout = false }, title = { Text("Sign out of SWK ONE?") }, text = { Text("This revokes this session, stops local location sharing and clears saved drafts.") }, confirmButton = { TextButton(onClick = { signout = false; model.logout() }) { Text("Sign out") } }, dismissButton = { TextButton(onClick = { signout = false }) { Text("Cancel") } })
    if (security) { Column { TextButton(onClick = { security = false }) { Text("Back to account") }; PasswordForm(model, false) }; return }
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Section(state.user!!.text("name"), state.user.text("email")); Text(state.user.text("role"), color = MaterialTheme.colorScheme.primary) }
        item { Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) { Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text("Device unlock", fontWeight = FontWeight.Bold); Text("Lock workspace when you leave the app", style = MaterialTheme.typography.bodySmall) }; Switch(biometric, { biometric = it; model.api.vault.put("biometric", it.toString()) }) } } }
        item { Tile("Change password", "Use a personal, strong password", Icons.Default.Lock) { security = true } }
        item { Tile("Leave & absence", "Request leave through company approvals", Icons.Default.FlightTakeoff) { model.openEntity("leave_requests") } }
        item { Tile("Commission payouts", "Review calculated, approved and paid stages", Icons.Default.AccountBalanceWallet) { model.openEntity("commission_entitlements") } }
        item { Tile("Company communications", "Approved company-managed conversations", Icons.Default.ChatBubbleOutline) { model.openEntity("communications") } }
        item { Tile("Training & knowledge", "Find approved internal guidance", Icons.Default.School) { model.openEntity("knowledge_articles") } }
        item { OutlinedButton(onClick = { signout = true }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.AutoMirrored.Filled.Logout, null); Text("Sign out securely") } }
        item { Text("SWK ONE ${BuildConfig.VERSION_NAME}\nNative Android · Connected to ${BuildConfig.API_BASE_URL}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
@Composable private fun PasswordForm(model: WorkspaceModel, required: Boolean) {
    val uiState by model.state.collectAsState()
    var current by remember { mutableStateOf("") }; var next by remember { mutableStateOf("") }; var repeat by remember { mutableStateOf("") }
    Column(Modifier.padding(24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Section(if (required) "Set your personal password" else "Change password", "At least 10 characters with upper and lower case letters and a number.")
        listOf(Triple(current, "Current password", { s: String -> current = s }), Triple(next, "New password", { s: String -> next = s }), Triple(repeat, "Confirm password", { s: String -> repeat = s })).forEach { (value, label, change) -> OutlinedTextField(value, change, label = { Text(label) }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth(), singleLine = true) }
        Button(onClick = { model.changePassword(current, next) }, enabled = current.isNotBlank() && next.length >= 10 && next == repeat && !uiState.loading) { Text("Save password") }
    }
}
@Composable private fun Empty(title: String, description: String) { Column(Modifier.fillMaxWidth().padding(vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) { Icon(Icons.Default.Inbox, null, Modifier.size(44.dp), tint = MaterialTheme.colorScheme.primary); Text(title, fontWeight = FontWeight.Bold); Text(description, style = MaterialTheme.typography.bodySmall) } }
