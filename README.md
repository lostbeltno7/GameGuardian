
# STFU GameGuardian - Anti-Cheat Protection System

## Overview
STFU GameGuardian is a comprehensive anti-cheat system designed to protect mobile games from memory manipulation tools like Game Guardian. This system provides real-time protection through native code integration and server-side verification.

## System Components

### 1. Client-Side Protection (Android Integration)
- Native C++ memory protection
- Java wrapper for Android integration
- Memory value protection and verification
- Cheat tool detection

### 2. Server-Side Verification
- Express.js server for logging and verification
- MongoDB database for player data storage
- Game value validation rules
- Tampering detection and countermeasures

## UML Architecture

### System Architecture Diagram
```
┌─────────────────────────────────────────────┐
│                                             │
│                Mobile Game                  │
│                                             │
│  ┌─────────────────┐    ┌───────────────┐   │
│  │  Game Logic     │    │ Protected     │   │
│  │                 │◄───┤ Game Values   │   │
│  └─────────────────┘    └───────────────┘   │
│           ▲                     ▲           │
│           │                     │           │
│           ▼                     │           │
│  ┌─────────────────────────────────────┐    │
│  │        STFU GameGuardian            │    │
│  │                                     │    │
│  │  ┌─────────────┐  ┌─────────────┐   │    │
│  │  │MemoryScanner│  │ToolDetector │   │    │
│  │  └─────────────┘  └─────────────┘   │    │
│  │                                     │    │
│  │  ┌─────────────┐  ┌─────────────┐   │    │
│  │  │MemoryProtect│  │ GameValue   │   │    │
│  │  └─────────────┘  └─────────────┘   │    │
│  │                                     │    │
│  │         GuardianShield              │    │
│  └─────────────────────────────────────┘    │
│           │                                 │
└───────────┼─────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────┐
│                                             │
│              Server-side                    │
│                                             │
│  ┌─────────────────┐    ┌───────────────┐   │
│  │ Verification    │    │ MongoDB       │   │
│  │ API            │◄───┤ Database      │   │
│  └─────────────────┘    └───────────────┘   │
│                                             │
│  ┌─────────────────┐    ┌───────────────┐   │
│  │ Event Logging   │    │ Countermeasure│   │
│  │ & Analysis     │────┤ Coordination  │   │
│  └─────────────────┘    └───────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### Class Diagram
```
┌───────────────────────┐      ┌───────────────────────┐
│     GuardianShield    │      │     GameValue<T>      │
├───────────────────────┤      ├───────────────────────┤
│ - scanner: Scanner    │      │ - key: string         │
│ - detector: Detector  │      │ - originalValue: T    │
│ - protector: Protector│      │ - currentValue: T     │
│ - isRunning: boolean  │      │ - checksums: string[] │
├───────────────────────┤      ├───────────────────────┤
│ + start(): boolean    │      │ + get(): T            │
│ + stop(): void        │◄─────│ + set(value: T): void │
│ + protectValue<T>()   │─────▶│ + reset(): void       │
│ + onCheatDetected()   │      │ + verify(): boolean   │
└───────────────────────┘      └───────────────────────┘
          ┬                              
          │                              
          │                              
┌─────────┴───────────┐                 
│                     │                 
│                     │                 
▼                     ▼                 
┌───────────────────┐ ┌───────────────────┐
│   MemoryScanner   │ │   ToolDetector    │
├───────────────────┤ ├───────────────────┤
│ - checksums: Map  │ │ - toolList: str[] │
├───────────────────┤ ├───────────────────┤
│ + scanMemory()    │ │ + detectTools()   │
└───────────────────┘ └───────────────────┘
                                │
                                │
                                ▼
┌───────────────────────────────────────────┐
│            MemoryProtector                │
├───────────────────────────────────────────┤
│ - tamperingAttempts: number               │
│ - maxAttempts: number                     │
├───────────────────────────────────────────┤
│ + applyCountermeasures(): void            │
│ + reportToServer(event: DetectionEvent)   │
└───────────────────────────────────────────┘
```

### Sequence Diagram: Cheat Detection Flow
```
┌──────┐     ┌─────────────┐     ┌─────────┐      ┌─────────┐     ┌──────┐
│ Game │     │GuardianShield│     │ Detector│      │Protector│     │Server│
└──┬───┘     └──────┬──────┘     └────┬────┘      └────┬────┘     └──┬───┘
   │              start()│            │               │              │
   │─────────────────────>            │               │              │
   │                     │            │               │              │
   │                     │───────────>│               │              │
   │                     │checkForTools               │              │
   │                     │<───────────│               │              │
   │                     │                            │              │
   │      get/set        │                            │              │
   │─────────────────────>                            │              │
   │    (game value)     │                            │              │
   │                     │───────────>│               │              │
   │                     │  periodic  │               │              │
   │                     │   check    │               │              │
   │                     │<───────────│               │              │
   │                     │                            │              │
   │                     │      cheat detected        │              │
   │                     │─────────────────────────────>             │
   │                     │                            │              │
   │                     │                        apply              │
   │                     │                    countermeasures        │
   │                     │                            │              │
   │                     │                            │─────────────>│
   │                     │                            │ report event │
   │<──────────────────────────────────────────────────              │
   │   penalty applied   │                            │              │
```

### Activity Diagram: Protection System Lifecycle
```
      ┌─────────────┐
      │  Initialize │
      │   System    │
      └──────┬──────┘
             │
             ▼
      ┌─────────────┐
      │Start Protection
      │   System    │
      └──────┬──────┘
             │
             ▼
      ┌─────────────┐
      │Create Protected
      │   Values    │
      └──────┬──────┘
             │
             ▼
┌─────────────────────────┐
│                         │
│    Protection Loop      │◄────────────────┐
│                         │                 │
└─────────┬───────────────┘                 │
          │                                 │
          ▼                                 │
   ┌─────────────┐                          │
   │Check Memory │                          │
   │  Integrity  │                          │
   └──────┬──────┘                          │
          │                                 │
          ▼             No                  │
   ┌─────────────┐                          │
   │  Tampering  ├──────────────────────────┘
   │  Detected?  │
   └──────┬──────┘
          │ Yes
          ▼
   ┌─────────────┐     ┌─────────────┐
   │   Report    │     │    Apply    │
   │ to Server   │────▶│Countermeasures
   └─────────────┘     └──────┬──────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │Check Tampering   │
                     │   Attempt Count  │
                     └─────────┬────────┘
                               │
                               ▼
                      ┌─────────────┐
             No       │ Exceeds Max │    Yes
        ┌─────────────┤  Attempts?  ├──────────┐
        │             └─────────────┘          │
        │                                      │
        ▼                                      ▼
┌─────────────────┐               ┌───────────────────────┐
│ Apply Warning   │               │  Apply Terminal       │
│ Countermeasures │               │  Countermeasures      │
└────────┬────────┘               └───────────┬───────────┘
         │                                    │
         └────────────────┬──────────────────┘
                          │
                          ▼
                  ┌─────────────────┐
                  │   Continue      │
                  │   Monitoring    │
                  └─────────────────┘
```

## Getting Started

### Server Setup

#### Prerequisites
- Node.js (v18 or later)
- MongoDB (v5 or later)
- SSL Certificate (for production)

#### Step 1: Configure Server
1. Clone this repository to your server
```bash
git clone https://your-repository-url.git
cd stfu-gameguardian
```

2. Install server dependencies
```bash
cp package.server.json package.json
npm install
```

3. Configure environment variables (create a .env file or set them in your environment)
```
NODE_ENV=production
PORT=443
API_KEY=your-secure-api-key-here
SSL_ENABLED=true
SSL_KEY_PATH=/path/to/privkey.pem
SSL_CERT_PATH=/path/to/fullchain.pem
MONGODB_URI=mongodb://localhost:27017/stfugg
```

4. Start the server
```bash
npm run start:prod
```

5. For production deployment, use a process manager like PM2
```bash
npm install -g pm2
pm2 start server.js --name "stfugg" --env production
pm2 save
pm2 startup
```

### Game Integration (Android)

#### Prerequisites
- Android Studio (latest version)
- Android NDK
- Gradle 7.0+

#### Step 1: Add Source Files to Your Game Project

1. Create the C++ directory in your Android project
```bash
mkdir -p app/src/main/cpp/stfugg
```

2. Copy the C++ implementation files
```bash
cp src/lib/memoryGuard/GameGuardianShield.cpp app/src/main/cpp/stfugg/
cp src/lib/memoryGuard/CMakeLists.txt app/src/main/cpp/
```

3. Create the Java package directory
```bash
mkdir -p app/src/main/java/com/stfugg
```

4. Create the Java interface file `STFUGameGuardian.java` in the directory created in step 3

#### Step 2: Update Your Android Project

1. Edit your app's build.gradle to include the C++ build
```gradle
android {
    // Existing configuration
    
    defaultConfig {
        // Existing config
        
        externalNativeBuild {
            cmake {
                cppFlags ""
                arguments "-DANDROID_STL=c++_shared"
            }
        }
    }
    
    externalNativeBuild {
        cmake {
            path "src/main/cpp/CMakeLists.txt"
        }
    }
}
```

2. Add required permissions to AndroidManifest.xml
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

#### Step 3: Using the Protection System in Your Game

1. Initialize the protection system in your game's MainActivity or Application class

```java
import com.stfugg.STFUGameGuardian;

public class MainActivity extends AppCompatActivity {
    private STFUGameGuardian shield;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        // Initialize with your server URL and API key
        shield = new STFUGameGuardian(
            this,
            "https://your-server.com/api/log-tampering",
            "your-api-key"
        );
        
        // Start the protection
        if (!shield.startProtection()) {
            showErrorDialog("Security system could not be initialized");
            return;
        }
        
        // Create protected values for important game state
        STFUGameGuardian.ProtectedValue<Integer> playerGold = 
            shield.protectInt(1000); // Initial value
        
        // Use the protected value
        int gold = playerGold.get();
        playerGold.set(gold + 100);
        
        // To check for tampering on demand
        if (shield.checkForTampering()) {
            // Tampering detected!
            shield.applyCountermeasures();
        }
    }
    
    @Override
    protected void onDestroy() {
        if (shield != null) {
            shield.destroy(); // Clean up resources
        }
        super.onDestroy();
    }
}
```

## Customizing for Your Game

### Modifying Protection Rules

1. Edit the game rules in `deploy-config.js`:
```javascript
gameRules: {
  maxCoinsPerMinute: 1000, // Max coins a player can earn per minute
  maxXpPerMinute: 500,     // Max XP a player can earn per minute
  // Add your custom rules here
}
```

2. Customize countermeasures in `GameGuardianShield.cpp`:
   - Locate the `nativeApplyCountermeasures` function
   - Update the logic based on your game's needs

### Server-side Verification

The system verifies game values using these approaches:

1. **Time-based validation**: Checks if players gain resources faster than possible
2. **Rule-based validation**: Enforces game-specific rules for valid value ranges
3. **Consistency checks**: Verifies related values make logical sense

To add a new protected value type:

1. Add native methods in `GameGuardianShield.cpp`
2. Update the Java interface in `STFUGameGuardian.java`
3. Add server-side validation rules in `verifyGameValues()` function in `server.js`

## Testing Your Implementation

### Server Testing
```bash
# Health check
curl -I https://your-server.com/health

# Test tampering report (replace with your API key)
curl -X POST https://your-server.com/api/log-tampering \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"severity":"medium","type":"test","deviceId":"test-device"}'
```

### Android Testing
1. Test with known cheat tools installed
2. Test with memory editing apps
3. Test on emulators
4. Test on rooted devices

## Demo for Teacher

For demonstration purposes, you can run the server locally and use the included test client:

1. Start the server in development mode:
```bash
NODE_ENV=development npm run start:dev
```

2. Use the sample Android project in the `demo/` directory to show protection in action

3. The demo includes a simple game with protected values and visualization of protection status

## Support and Troubleshooting

For issues with the integration:
1. Check server logs in the `logs/` directory
2. Verify API key configuration
3. Ensure proper network connectivity between game and server
