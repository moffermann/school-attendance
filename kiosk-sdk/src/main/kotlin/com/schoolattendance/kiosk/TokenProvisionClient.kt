package com.schoolattendance.kiosk

data class ProvisionResponse(
    val ndefUri: String,
    val tagTokenPreview: String,
    val checksum: String
)

class TokenProvisionClient {
    suspend fun requestProvision(studentId: Int): ProvisionResponse {
        // TODO: llamar POST /api/v1/tags/provision
        throw NotImplementedError("Implementar solicitud de provisión")
    }

    suspend fun confirmToken(studentId: Int, tagTokenPreview: String, tagUid: String?): Unit {
        // TODO: llamar POST /api/v1/tags/confirm
        throw NotImplementedError("Implementar confirmación de tag")
    }
}
