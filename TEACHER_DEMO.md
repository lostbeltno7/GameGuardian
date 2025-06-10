
# STFU GameGuardian - Teacher Demonstration Guide

This document provides a step-by-step demonstration of the STFU GameGuardian anti-cheat system's capabilities.

## Demonstration Setup

### Prerequisites
- Android Studio with Android Emulator or Android device
- Node.js and MongoDB installed
- Basic familiarity with terminal/command line

## Part 1: Server Setup (5 minutes)

1. Clone the repository and navigate to the directory
```bash
git clone https://your-repository-url.git
cd stfu-gameguardian
```

2. Install dependencies and set up the development server
```bash
cp package.server.json package.json
npm install
```

3. Start the server in development mode
```bash
npm run start:dev
```

You should see output like:
```
STFU GameGuardian server running on development mode
Server listening on port 3000
```

## Part 2: In-Game Protection Demo (10 minutes)

### Memory Protection Demonstration

1. Open the demo Android project in Android Studio
```bash
cd demo/android
```

2. Build and run the demo application on an emulator or device

3. The demo app shows:
   - Protected values (coins, health, experience)
   - Memory scan detection
   - Cheat tool detection status

4. Click on "Test Protection" to demonstrate how protected values resist tampering:
   - Shows memory verification process
   - Demonstrates checksum validation
   - Shows obfuscation techniques

5. Click "Simulate Tampering" to demonstrate countermeasures:
   - Triggers warning on first attempt
   - Shows server logging of the attempt
   - Applies increasing countermeasures on repeated attempts

### Cheat Tool Detection (5 minutes)

1. In the demo app, click on "Detect Cheat Tools"
   - Shows scan for installed cheat applications
   - Identifies emulator/root status
   - Verifies app signature integrity

2. View the server logs showing detection events:
```bash
curl http://localhost:3000/api/management/logs?days=1 -H "X-API-Key: demo-key-123"
```

## Part 3: Server-Side Validation (10 minutes)

1. Register a test player:
```bash
curl -X POST http://localhost:3000/api/register-player \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-key-123" \
  -d '{"playerId":"teacher-demo-123","deviceId":"demo-device-456","initialData":{"coins":100,"health":100,"xp":0}}'
```

2. Show valid game sync:
```bash
curl -X POST http://localhost:3000/api/sync-game-values \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-key-123" \
  -d '{"playerId":"teacher-demo-123","sessionId":"demo-session","gameValues":{"coins":150,"health":100,"xp":25},"clientTimestamp":"2025-04-15T14:30:00Z"}'
```

3. Demonstrate invalid value detection:
```bash
curl -X POST http://localhost:3000/api/sync-game-values \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-key-123" \
  -d '{"playerId":"teacher-demo-123","sessionId":"demo-session","gameValues":{"coins":9999999,"health":100,"xp":25},"clientTimestamp":"2025-04-15T14:31:00Z"}'
```

4. Show player data with tampering history:
```bash
curl http://localhost:3000/api/management/player/teacher-demo-123 \
  -H "X-API-Key: demo-key-123"
```

## Part 4: Code Walkthrough (10 minutes)

1. Show the native C++ protection (GameGuardianShield.cpp):
   - Memory protection techniques
   - Cheat detection algorithms
   - Value obfuscation methods

2. Explain the server-side validation (server.js):
   - Time-based validation rules
   - Player history analysis
   - Progressive countermeasures

3. Demonstrate the Java integration API:
   - JNI bindings
   - Protected value containers
   - Tampering callbacks

## Key Takeaways

1. **Multi-layered Protection**: Defense in depth with client and server protection

2. **Non-intrusive Integration**: Easy to add to existing games

3. **Countermeasure Escalation**: Progressive response to cheating attempts

4. **Performance Efficiency**: Minimal impact on game performance

5. **Real-time Monitoring**: Server-side detection and enforcement

## Q&A Session (5 minutes)

Prepare to answer questions about:
- Performance impact on games
- How obfuscation techniques work
- Detection effectiveness against common cheating methods
- Server load handling for large player bases
- Security of the anti-cheat system itself
