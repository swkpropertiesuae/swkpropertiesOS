package ae.swk.one

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Private preferences hold only authenticated ciphertext; the AES key stays in Android Keystore. */
class Vault(context: Context) {
    private val prefs = context.getSharedPreferences("swk_vault", Context.MODE_PRIVATE)
    private val key: SecretKey get() {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        return (store.getKey("swk_one_v1", null) as? SecretKey) ?: KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("swk_one_v1", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    @Synchronized fun put(name: String, value: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key) }
        val bytes = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        check(prefs.edit().putString(name, Base64.encodeToString(bytes, Base64.NO_WRAP)).commit())
    }
    @Synchronized fun get(name: String): String? = try {
        prefs.getString(name, null)?.let { raw ->
            val bytes = Base64.decode(raw, Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, bytes.copyOfRange(0, 12))) }
            String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
        }
    } catch (_: Exception) { remove(name); null }
    fun remove(name: String) { check(prefs.edit().remove(name).commit()) }
    fun clear() { check(prefs.edit().clear().commit()) }
}
class ApiException(val status: Int, message: String) : Exception(message)
class Api(context: Context) {
    val vault = Vault(context.applicationContext)
    private val origin = BuildConfig.API_BASE_URL.trimEnd('/')
    private val client = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(false).followSslRedirects(false)
        .cookieJar(object : CookieJar {
            override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
                cookies.firstOrNull { it.name == "swk_sid" }?.let {
                    if (it.expiresAt <= System.currentTimeMillis()) vault.remove("session") else vault.put("session", it.toString())
                }
            }
            override fun loadForRequest(url: HttpUrl): List<Cookie> = vault.get("session")?.let { Cookie.parse(url, it) }
                ?.takeIf { it.expiresAt > System.currentTimeMillis() && it.matches(url) }?.let { listOf(it) } ?: emptyList()
        }).build()
    suspend fun request(path: String, method: String = "GET", payload: JSONObject? = null): Any = withContext(Dispatchers.IO) {
        require(path.startsWith("/api/"))
        val body = if (method in listOf("GET", "HEAD")) null else (payload ?: JSONObject()).toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder().url(origin + path).header("X-SWK-Client", "web").header("User-Agent", "SWK-ONE-Android/1.0").method(method, body).build()
        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                if (response.code == 401) vault.remove("session")
                throw ApiException(response.code, runCatching { JSONObject(raw).optString("error") }.getOrDefault("Request failed (${response.code})").ifBlank { "Request failed (${response.code})" })
            }
            if (raw.trimStart().startsWith("[")) JSONArray(raw) else JSONObject(raw.ifBlank { "{}" })
        }
    }
    suspend fun upload(entity: String, id: Int, filename: String, mime: String, data: ByteArray): JSONArray = withContext(Dispatchers.IO) {
        require(data.size <= 10 * 1024 * 1024) { "Choose a file smaller than 10 MB" }
        val body = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("link_entity", entity).addFormDataPart("link_id", id.toString())
            .addFormDataPart("file", filename, data.toRequestBody(mime.toMediaType())).build()
        val request = Request.Builder().url(origin + "/api/files").header("X-SWK-Client", "web").post(body).build()
        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw ApiException(response.code, runCatching { JSONObject(raw).optString("error") }.getOrDefault("Upload failed"))
            JSONArray(raw)
        }
    }
    suspend fun download(id: Int): ByteArray = withContext(Dispatchers.IO) {
        client.newCall(Request.Builder().url(origin + "/api/files/$id/download").build()).execute().use { response ->
            if (!response.isSuccessful) throw ApiException(response.code, "Document access failed")
            val source = response.body ?: throw IllegalStateException("Empty document")
            require(source.contentLength() <= 20 * 1024 * 1024) { "Document is too large for mobile preview" }
            source.byteStream().use { input ->
                val output = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
                while (true) { val count = input.read(buffer); if (count < 0) break; require(output.size() + count <= 20 * 1024 * 1024) { "Document is too large for mobile preview" }; output.write(buffer, 0, count) }; val bytes = output.toByteArray()
                require(bytes.size <= 20 * 1024 * 1024) { "Document is too large for mobile preview" }; bytes
            }
        }
    }
    suspend fun obj(path: String, method: String = "GET", body: JSONObject? = null) = request(path, method, body) as JSONObject
}
fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
fun JSONObject.text(key: String): String = if (isNull(key)) "" else optString(key)
