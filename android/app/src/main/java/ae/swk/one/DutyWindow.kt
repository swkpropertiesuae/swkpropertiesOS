package ae.swk.one

import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset

/** SWK OS entity timestamps are persisted as UTC wall time without a suffix. */
object DutyWindow {
    fun endMillis(value: String): Long = if (Regex(".*(Z|[+-]\\d{2}:\\d{2})$").matches(value)) Instant.parse(value).toEpochMilli()
        else LocalDateTime.parse(value).toInstant(ZoneOffset.UTC).toEpochMilli()
    fun active(start: String, end: String, now: Long): Boolean = runCatching { now >= endMillis(start) && now < endMillis(end) }.getOrDefault(false)
}
