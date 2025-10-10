package com.schoolattendance.kiosk

import java.time.Instant

data class PendingEvent(
    val studentId: Int,
    val gateId: String,
    val deviceId: String,
    val type: String,
    val occurredAt: Instant,
    val localSeq: Long,
    val photoPath: String? = null
)

class AttendanceSyncClient {
    suspend fun enqueue(event: PendingEvent) {
        // TODO: persist locally (Room/SQLDelight) y gatillar sync worker
        throw NotImplementedError("Implementar almacenamiento offline")
    }

    suspend fun syncPending() {
        // TODO: leer cola local y enviar a /api/v1/attendance/events en lotes
        throw NotImplementedError("Implementar sincronización")
    }
}
