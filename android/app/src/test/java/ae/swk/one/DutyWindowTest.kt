package ae.swk.one
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.util.TimeZone
class DutyWindowTest {
    @Test fun timestampsAreIndependentOfPhoneTimezone() {
        val original = TimeZone.getDefault()
        try {
            listOf("Asia/Dubai", "Europe/London", "America/Los_Angeles").forEach { zone ->
                TimeZone.setDefault(TimeZone.getTimeZone(zone))
                assertEquals(Instant.parse("2026-10-26T10:00:00Z").toEpochMilli(), DutyWindow.endMillis("2026-10-26T10:00"))
            }
        } finally { TimeZone.setDefault(original) }
    }
    @Test fun deadlineIsExclusiveAndInvalidWindowsFailClosed() {
        val now = Instant.parse("2026-10-26T10:00:00Z").toEpochMilli()
        assertTrue(DutyWindow.active("2026-10-26T09:00", "2026-10-26T11:00", now))
        assertFalse(DutyWindow.active("2026-10-26T09:00", "2026-10-26T10:00", now))
        assertFalse(DutyWindow.active("bad", "bad", now))
    }
}
