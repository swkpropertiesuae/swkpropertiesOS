package ae.swk.one

import android.app.Application
import android.content.Intent
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

sealed interface Screen {
    data object Home : Screen
    data object Workspaces : Screen
    data object Field : Screen
    data object Account : Screen
    data object Report : Screen
    data class Records(val entity: JSONObject) : Screen
    data class Detail(val entity: JSONObject, val record: JSONObject) : Screen
    data class Edit(val entity: JSONObject, val record: JSONObject? = null) : Screen
}
data class WorkspaceState(
    val loading: Boolean = false, val user: JSONObject? = null, val meta: JSONObject = JSONObject(),
    val workday: JSONObject = JSONObject(), val screen: Screen = Screen.Home,
    val rows: List<JSONObject> = emptyList(), val page: Int = 1, val more: Boolean = false,
    val query: String = "", val error: String? = null, val message: String? = null, val totp: Boolean = false,
    val notifications: List<JSONObject> = emptyList()
)
class WorkspaceModel(app: Application) : AndroidViewModel(app) {
    val api = Api(app)
    private val mutable = MutableStateFlow(WorkspaceState())
    val state = mutable.asStateFlow()
    private var history = mutableListOf<Screen>()
    init { if (api.vault.get("session") != null) action { loadSession() } }
    fun notice(message: String) { mutable.value = mutable.value.copy(message = message) }
    fun clearNotice() { mutable.value = mutable.value.copy(message = null) }
    fun error(message: String) { mutable.value = mutable.value.copy(error = message) }
    fun dismissError() { mutable.value = mutable.value.copy(error = null) }
    fun action(block: suspend () -> Unit) {
        if (mutable.value.loading) return
        mutable.value = mutable.value.copy(loading = true, error = null)
        viewModelScope.launch {
            try { block() } catch (e: Exception) {
                if (e is ApiException && e.status == 401 && mutable.value.user != null) {
                    getApplication<Application>().stopService(Intent(getApplication(), DutyService::class.java))
                    mutable.value = WorkspaceState(error = "Your session has expired. Sign in again.")
                } else mutable.value = mutable.value.copy(error = e.message ?: "Connection unavailable. Try again.")
            } finally { mutable.value = mutable.value.copy(loading = false) }
        }
    }
    fun login(email: String, password: String, code: String) = action {
        val response = api.obj("/api/auth/login", "POST", JSONObject().put("email", email.trim()).put("password", password).apply { if (code.isNotBlank()) put("totp", code) })
        if (response.optBoolean("needsTotp")) mutable.value = mutable.value.copy(totp = true) else loadSession()
    }
    private suspend fun loadSession() {
        val user = api.obj("/api/auth/me")
        val meta = api.obj("/api/meta")
        mutable.value = mutable.value.copy(user = user, meta = meta, totp = false)
        if (!user.optBoolean("mustChangePassword")) refreshHome()
    }
    suspend fun refreshHome() {
        val perms = mutable.value.meta.optJSONObject("perms") ?: JSONObject()
        val workday = if (perms.optJSONArray("hr")?.toString()?.contains("view") == true) {
            try { api.obj("/api/mobile/workday") } catch (e: ApiException) { if (e.status != 400) throw e; JSONObject().put("setup", e.message) }
        } else JSONObject().put("setup", "Your role does not include HR access. Use Workspaces for your permitted work.")
        val notifications = api.obj("/api/notifications").optJSONArray("rows")?.objects() ?: emptyList()
        mutable.value = mutable.value.copy(workday = workday, notifications = notifications)
    }
    fun refresh() = action {
        when (val screen = mutable.value.screen) {
            is Screen.Records -> loadRows(screen.entity, mutable.value.query, 1)
            else -> refreshHome()
        }
    }
    fun permitted(entity: JSONObject, action: String): Boolean = mutable.value.meta.optJSONObject("perms")?.optJSONArray(entity.text("module"))?.let { a -> (0 until a.length()).any { a.optString(it) == action } } == true
    fun entities(): List<JSONObject> = mutable.value.meta.optJSONArray("entities")?.objects()?.filter { !it.optBoolean("child") && !it.optBoolean("hidden") && permitted(it, "view") } ?: emptyList()
    fun openEntity(key: String) { entities().firstOrNull { it.text("key") == key }?.let { navigate(Screen.Records(it)) } ?: error("This workspace is not available to your role.") }
    fun navigate(screen: Screen) {
        history.add(mutable.value.screen)
        mutable.value = mutable.value.copy(screen = screen, rows = emptyList(), query = "", page = 1, more = false)
        if (screen is Screen.Records) search("")
    }
    fun tab(screen: Screen) { history.clear(); mutable.value = mutable.value.copy(screen = screen, rows = emptyList()) }
    fun back() { val screen = if (history.isNotEmpty()) history.removeAt(history.lastIndex) else Screen.Home; mutable.value = mutable.value.copy(screen = screen); if (screen is Screen.Records) search(mutable.value.query) }
    fun search(query: String) = action { val s = mutable.value.screen as? Screen.Records ?: return@action; loadRows(s.entity, query, 1) }
    fun more() = action { val s = mutable.value.screen as? Screen.Records ?: return@action; loadRows(s.entity, mutable.value.query, mutable.value.page + 1) }
    private suspend fun loadRows(entity: JSONObject, query: String, page: Int) {
        val result = api.obj("/api/e/${entity.text("key")}?pageSize=30&page=$page&q=${URLEncoder.encode(query, "UTF-8")}")
        val rows = result.optJSONArray("rows")?.objects() ?: emptyList()
        mutable.value = mutable.value.copy(rows = if (page == 1) rows else mutable.value.rows + rows, page = page, more = rows.size == 30, query = query)
    }
    fun detail(entity: JSONObject, id: Int) = action { val r = api.obj("/api/e/${entity.text("key")}/$id"); navigate(Screen.Detail(entity, r)) }
    fun save(entity: JSONObject, record: JSONObject?, payload: JSONObject) = action {
        val path = "/api/e/${entity.text("key")}" + if (record == null) "" else "/${record.optInt("id")}" 
        val r = api.obj(path, if (record == null) "POST" else "PUT", payload)
        mutable.value = mutable.value.copy(screen = Screen.Detail(entity, r), message = "Saved to SWK OS")
    }
    fun recordAction(path: String, body: JSONObject = JSONObject()) = action {
        api.obj(path, "POST", body)
        val s = mutable.value.screen
        if (s is Screen.Detail) mutable.value = mutable.value.copy(screen = Screen.Detail(s.entity, api.obj("/api/e/${s.entity.text("key")}/${s.record.optInt("id")}")))
        else refreshHome()
        notice("Updated in SWK OS")
    }
    fun submitReport(outcomes: String, blockers: String, next: String) = action {
        api.obj("/api/mobile/daily-report", "POST", JSONObject().put("outcomes_narrative", outcomes).put("blockers_narrative", blockers).put("next_day_priorities", next))
        api.vault.remove("report_${mutable.value.user?.optInt("id")}")
        refreshHome(); tab(Screen.Home); notice("Daily report submitted and frozen for review")
    }
    fun changePassword(current: String, next: String) = action { api.obj("/api/auth/change-password", "POST", JSONObject().put("current", current).put("next", next)); loadSession(); notice("Password changed") }
    fun logout() = action {
        getApplication<Application>().stopService(Intent(getApplication(), DutyService::class.java))
        // Keep the local session if server revocation fails, so the user can retry.
        api.obj("/api/auth/logout", "POST")
        api.vault.clear(); history.clear(); mutable.value = WorkspaceState()
    }
}
