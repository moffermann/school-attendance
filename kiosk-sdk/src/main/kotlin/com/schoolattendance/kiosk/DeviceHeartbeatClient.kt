package com.schoolattendance.kiosk

data class HeartbeatPayload(
    val deviceId: String,
    val gateId: String,
    val firmwareVersion: String,
    val batteryPct: Int,
    val pendingEvents: Int,
    val online: Boolean
)

class DeviceHeartbeatClient {
    suspend fun sendHeartbeat(payload: HeartbeatPayload) {
        // TODO: enviar POST /api/v1/devices/heartbeat
        throw NotImplementedError("Implementar heartbeat")
    }
}
