#
# Kiosk Provisioning Script (PowerShell)
#
# This script provisions a new kiosk device by:
# 1. Generating/retrieving the device API key
# 2. Downloading initial data (students, tags, teachers)
# 3. Configuring the kiosk with backend connectivity
#
# Usage:
#   .\provision_kiosk.ps1 -ApiUrl http://localhost:8000 -DeviceId DEV-01 -GateId GATE-1 -OutputDir .\kiosk-config
#

param(
    [string]$ApiUrl = "http://localhost:8000",
    [string]$DeviceId = "DEV-01",
    [string]$GateId = "GATE-1",
    [string]$OutputDir = ".\kiosk-data",
    [string]$SchoolName = "Colegio Demo",
    [string]$DeviceKey = $env:DEVICE_API_KEY
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

Write-Host ""
Write-Success "========================================"
Write-Success "  Kiosk Provisioning Script"
Write-Success "========================================"
Write-Host ""
Write-Host "API URL:     " -NoNewline; Write-Warning $ApiUrl
Write-Host "Device ID:   " -NoNewline; Write-Warning $DeviceId
Write-Host "Gate ID:     " -NoNewline; Write-Warning $GateId
Write-Host "Output Dir:  " -NoNewline; Write-Warning $OutputDir
Write-Host ""

# Create output directory
$DataDir = Join-Path $OutputDir "data"
if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}

# Check device API key
if (-not $DeviceKey) {
    Write-Warning "No DEVICE_API_KEY found in environment."
    $DeviceKey = Read-Host "Please enter the device API key (from backend .env file)"

    if (-not $DeviceKey) {
        Write-Error "Error: Device API key is required"
        exit 1
    }
}

# Function to make API requests
function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null
    )

    $headers = @{
        "Content-Type" = "application/json"
        "X-Device-Key" = $DeviceKey
    }

    $uri = "$ApiUrl/api/v1$Endpoint"

    try {
        if ($Body) {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body ($Body | ConvertTo-Json) -ErrorAction Stop
        } else {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -ErrorAction Stop
        }
        return $response
    } catch {
        return $null
    }
}

# Test API connectivity
Write-Warning "Testing API connectivity..."
$OfflineMode = $false

try {
    $healthResponse = Invoke-RestMethod -Uri "$ApiUrl/api/v1/health" -Method Get -TimeoutSec 5 -ErrorAction Stop
    Write-Success "API connection successful"
} catch {
    Write-Error "Cannot connect to API at $ApiUrl"
    Write-Warning "Continuing with offline provisioning (mock data)..."
    $OfflineMode = $true
}

if ($OfflineMode) {
    Write-Host ""
    Write-Warning "Running in offline mode - generating mock data"

    # Generate mock students.json
    $mockStudents = @(
        @{ id = 1; full_name = "Juan Perez Gonzalez"; course_id = 1; photo_ref = $null; photo_pref_opt_in = $true }
        @{ id = 2; full_name = "Maria Garcia Lopez"; course_id = 1; photo_ref = $null; photo_pref_opt_in = $true }
        @{ id = 3; full_name = "Pedro Rodriguez Soto"; course_id = 2; photo_ref = $null; photo_pref_opt_in = $false }
        @{ id = 4; full_name = "Ana Martinez Diaz"; course_id = 2; photo_ref = $null; photo_pref_opt_in = $true }
        @{ id = 5; full_name = "Carlos Silva Mora"; course_id = 3; photo_ref = $null; photo_pref_opt_in = $true }
    )
    $mockStudents | ConvertTo-Json -Depth 10 | Out-File -FilePath (Join-Path $DataDir "students.json") -Encoding UTF8
    Write-Host "  " -NoNewline; Write-Success "OK"; Write-Host " Generated mock students.json"

    # Generate mock tags.json
    $mockTags = @(
        @{ token = "nfc_001"; student_id = 1; status = "ACTIVE" }
        @{ token = "nfc_002"; student_id = 2; status = "ACTIVE" }
        @{ token = "nfc_003"; student_id = 3; status = "ACTIVE" }
        @{ token = "nfc_004"; student_id = 4; status = "ACTIVE" }
        @{ token = "nfc_005"; student_id = 5; status = "ACTIVE" }
        @{ token = "qr_011"; student_id = 1; status = "ACTIVE" }
        @{ token = "qr_012"; student_id = 2; status = "ACTIVE" }
        @{ token = "nfc_teacher_001"; teacher_id = 1; status = "ACTIVE" }
        @{ token = "nfc_teacher_002"; teacher_id = 2; status = "ACTIVE" }
        @{ token = "qr_teacher_003"; teacher_id = 3; status = "ACTIVE" }
    )
    $mockTags | ConvertTo-Json -Depth 10 | Out-File -FilePath (Join-Path $DataDir "tags.json") -Encoding UTF8
    Write-Host "  " -NoNewline; Write-Success "OK"; Write-Host " Generated mock tags.json"

    # Generate mock teachers.json
    $mockTeachers = @(
        @{ id = 1; full_name = "Maria Gonzalez Lopez" }
        @{ id = 2; full_name = "Pedro Ramirez Castro" }
        @{ id = 3; full_name = "Carmen Silva Morales" }
    )
    $mockTeachers | ConvertTo-Json -Depth 10 | Out-File -FilePath (Join-Path $DataDir "teachers.json") -Encoding UTF8
    Write-Host "  " -NoNewline; Write-Success "OK"; Write-Host " Generated mock teachers.json"

} else {
    Write-Host ""
    Write-Warning "Downloading data from API..."

    # Download students
    Write-Host "  Downloading students... " -NoNewline
    $students = Invoke-ApiRequest -Method Get -Endpoint "/students"
    if ($students) {
        $students | ConvertTo-Json -Depth 10 | Out-File -FilePath (Join-Path $DataDir "students.json") -Encoding UTF8
        $count = ($students | Measure-Object).Count
        Write-Success "OK ($count students)"
    } else {
        "[]" | Out-File -FilePath (Join-Path $DataDir "students.json") -Encoding UTF8
        Write-Warning "No data - using empty array"
    }

    # Download tags
    Write-Host "  Downloading tags... " -NoNewline
    $tags = Invoke-ApiRequest -Method Get -Endpoint "/tags"
    if ($tags) {
        $tags | ConvertTo-Json -Depth 10 | Out-File -FilePath (Join-Path $DataDir "tags.json") -Encoding UTF8
        $count = ($tags | Measure-Object).Count
        Write-Success "OK ($count tags)"
    } else {
        "[]" | Out-File -FilePath (Join-Path $DataDir "tags.json") -Encoding UTF8
        Write-Warning "No data - using empty array"
    }

    # Download teachers
    Write-Host "  Downloading teachers... " -NoNewline
    $teachers = Invoke-ApiRequest -Method Get -Endpoint "/teachers"
    if ($teachers) {
        $teachers | ConvertTo-Json -Depth 10 | Out-File -FilePath (Join-Path $DataDir "teachers.json") -Encoding UTF8
        $count = ($teachers | Measure-Object).Count
        Write-Success "OK ($count teachers)"
    } else {
        "[]" | Out-File -FilePath (Join-Path $DataDir "teachers.json") -Encoding UTF8
        Write-Warning "No data - using empty array"
    }
}

# Generate device.json
Write-Host ""
Write-Warning "Generating device configuration..."

$deviceConfig = @{
    gate_id = $GateId
    device_id = $DeviceId
    version = "1.0.0"
    battery_pct = 100
    online = $true
}
$deviceConfig | ConvertTo-Json | Out-File -FilePath (Join-Path $DataDir "device.json") -Encoding UTF8
Write-Host "  " -NoNewline; Write-Success "OK"; Write-Host " Generated device.json"

# Generate config.json
$appConfig = @{
    photoEnabled = $true
    highContrast = $false
    schoolName = $SchoolName
    autoResumeDelay = 5000
    apiBaseUrl = "$ApiUrl/api/v1"
    deviceApiKey = $DeviceKey
}
$appConfig | ConvertTo-Json | Out-File -FilePath (Join-Path $DataDir "config.json") -Encoding UTF8
Write-Host "  " -NoNewline; Write-Success "OK"; Write-Host " Generated config.json"

# Generate empty queue
"[]" | Out-File -FilePath (Join-Path $DataDir "queue.json") -Encoding UTF8
Write-Host "  " -NoNewline; Write-Success "OK"; Write-Host " Generated queue.json"

# Register device with heartbeat
if (-not $OfflineMode) {
    Write-Host ""
    Write-Warning "Registering device with backend..."

    $heartbeatPayload = @{
        device_id = $DeviceId
        gate_id = $GateId
        firmware_version = "1.0.0"
        battery_pct = 100
        pending_events = 0
        online = $true
    }

    $heartbeatResponse = Invoke-ApiRequest -Method Post -Endpoint "/devices/heartbeat" -Body $heartbeatPayload

    if ($heartbeatResponse -and $heartbeatResponse.id) {
        Write-Host "  " -NoNewline; Write-Success "OK"; Write-Host " Device registered (DB ID: $($heartbeatResponse.id))"
    } else {
        Write-Host "  " -NoNewline; Write-Warning "!"; Write-Host " Could not register device (may already exist)"
    }
}

# Summary
Write-Host ""
Write-Success "========================================"
Write-Success "  Provisioning Complete!"
Write-Success "========================================"
Write-Host ""
Write-Host "Generated files in $DataDir/:"
Get-ChildItem $DataDir | Format-Table Name, Length, LastWriteTime
Write-Host ""
Write-Warning "Next steps:"
Write-Host "1. Copy the contents of $DataDir\ to src\kiosk-app\data\"
Write-Host "2. Open the kiosk app in a browser"
Write-Host "3. The kiosk will automatically sync with the backend"
Write-Host ""
Write-Warning "To copy files:"
Write-Host "  Copy-Item -Path '$DataDir\*' -Destination 'src\kiosk-app\data\' -Recurse -Force"
Write-Host ""
