
# STFU GameGuardian - Production Deployment Guide

This document provides comprehensive instructions for deploying the STFU GameGuardian anti-cheat system to a production environment.

## 1. Server Deployment

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Linux-based server (recommended Ubuntu 20.04 or later)
- Domain name with SSL certificate (recommended)

### Server Setup

#### Option 1: Direct Server Installation

1. Clone or upload the repository to your server

2. Install server dependencies:
   ```bash
   cp package.server.json package.json
   npm install
   ```

3. Configure environment variables:
   ```bash
   export NODE_ENV=production
   export PORT=443  # Use 80 or 443 for production
   export API_KEY="your-secure-api-key-here"  # Change this to a secure random value
   export SSL_ENABLED=true
   export SSL_KEY_PATH="/path/to/privkey.pem"
   export SSL_CERT_PATH="/path/to/fullchain.pem"
   ```

4. Start the server:
   ```bash
   npm run start:prod
   ```

5. For production use, set up a process manager:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "stfugg" --env production
   pm2 save
   pm2 startup
   ```

#### Option 2: Docker Deployment

1. Create a Dockerfile:
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package.server.json ./package.json
   COPY deploy-config.js ./
   COPY server.js ./
   RUN mkdir -p logs
   RUN npm install
   EXPOSE 8080
   CMD ["node", "server.js"]
   ```

2. Build and run the Docker container:
   ```bash
   docker build -t stfu-game-guardian .
   docker run -p 443:8080 \
     -e NODE_ENV=production \
     -e API_KEY="your-secure-api-key" \
     -e SSL_ENABLED=true \
     -e SSL_KEY_PATH="/certs/privkey.pem" \
     -e SSL_CERT_PATH="/certs/fullchain.pem" \
     -v /path/to/certs:/certs \
     -v /path/to/logs:/app/logs \
     --name stfugg \
     -d stfu-game-guardian
   ```

#### Option 3: Cloud Deployment (AWS/GCP/Azure)

For cloud deployment, we recommend:

1. For AWS: Use Elastic Beanstalk or EC2 with a load balancer
2. For GCP: Use Google App Engine or GKE
3. For Azure: Use Azure App Service

Follow cloud-specific documentation for deploying Node.js applications, and set the required environment variables in your cloud provider's configuration.

### Server Security Recommendations

1. Set up a firewall allowing only ports 80/443
2. Configure HTTPS with strong SSL settings
3. Implement IP whitelisting for management endpoints
4. Set up monitoring and alerting for abnormal traffic patterns
5. Regularly rotate API keys
6. Set up log rotation to manage disk space

## 2. Android Game Integration

### Prerequisites

- Android Studio (latest version)
- Android NDK (latest version)
- Gradle (latest version compatible with your Android Studio)
- Java Development Kit (JDK) 11 or higher

### Integration Steps

#### Step 1: Add Native Code to Your Project

1. Create a directory in your Android project:
   ```bash
   mkdir -p app/src/main/cpp/stfugg
   ```

2. Copy the native source files to this directory:
   - `GameGuardianShield.cpp` → `app/src/main/cpp/stfugg/`
   - `CMakeLists.txt` → `app/src/main/cpp/`

3. Add Java interface class:
   - Copy `STFUGameGuardian.java` → `app/src/main/java/com/stfugg/`
   - Create the directory if it doesn't exist:
     ```bash
     mkdir -p app/src/main/java/com/stfugg/
     ```

#### Step 2: Configure Build System

1. Update your app-level `build.gradle` file to include the C++ compilation:

   ```gradle
   android {
       // ... existing configuration

       defaultConfig {
           // ... existing config

           // Enable NDK build
           externalNativeBuild {
               cmake {
                   cppFlags ""
                   arguments "-DANDROID_STL=c++_shared"
               }
           }
       }

       // Configure CMake
       externalNativeBuild {
           cmake {
               path "src/main/cpp/CMakeLists.txt"
           }
       }
   }
   ```

2. Add required permissions to `AndroidManifest.xml`:

   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
   ```

#### Step 3: Implementing in Your Game

1. Initialize the protection system in your game's main activity:

   ```java
   import com.stfugg.STFUGameGuardian;

   public class MainActivity extends AppCompatActivity {
       private STFUGameGuardian shield;
       private STFUGameGuardian.ProtectedValue<Integer> playerGold;
       private STFUGameGuardian.ProtectedValue<Integer> playerLevel;
       
       @Override
       protected void onCreate(Bundle savedInstanceState) {
           super.onCreate(savedInstanceState);
           setContentView(R.layout.activity_main);
           
           // Initialize the shield with server reporting
           shield = new STFUGameGuardian(
               this,
               "https://your-server.com/api/log-tampering",
               "your-api-key"
           );
           
           // Set up cheat detection callback
           shield.setCheatListener(new STFUGameGuardian.CheatListener() {
               @Override
               public void onCheatDetected(int severity, String type) {
                   if (severity >= 2) {
                       // Critical violation - take severe action
                       showCheatingDetectedDialog();
                       // Reset stats
                       playerGold.reset();
                       playerLevel.reset();
                       saveGame();
                   } else {
                       // Warning level - show warning
                       Toast.makeText(MainActivity.this, 
                           "Suspicious activity detected", 
                           Toast.LENGTH_SHORT).show();
                   }
               }
               
               @Override
               public void onProtectionFailure(String error) {
                   Log.e("GameProtection", "Protection failure: " + error);
                   // Handle protection system failure
               }
           });
           
           // Start protection
           if (!shield.startProtection()) {
               // Protection couldn't be initialized
               // This could indicate the game is running in an unsafe environment
               showIncompatibleDeviceDialog();
               return;
           }
           
           // Create protected values for game state
           playerGold = shield.protectInt(100);
           playerLevel = shield.protectInt(1);
           
           // Load saved values if any
           loadGame();
       }
       
       // Always access protected values through their get/set methods
       private void addGold(int amount) {
           int currentGold = playerGold.get();
           playerGold.set(currentGold + amount);
           updateUI();
       }
       
       private void levelUp() {
           int currentLevel = playerLevel.get();
           playerLevel.set(currentLevel + 1);
           updateUI();
       }
       
       private void updateUI() {
           TextView goldText = findViewById(R.id.gold_text);
           TextView levelText = findViewById(R.id.level_text);
           
           goldText.setText("Gold: " + playerGold.get());
           levelText.setText("Level: " + playerLevel.get());
       }
       
       private void saveGame() {
           // Save protected values securely
           SharedPreferences prefs = getSharedPreferences("game_data", MODE_PRIVATE);
           SharedPreferences.Editor editor = prefs.edit();
           
           // In production, encrypt these values before saving
           editor.putInt("player_gold", playerGold.get());
           editor.putInt("player_level", playerLevel.get());
           editor.apply();
       }
       
       private void loadGame() {
           SharedPreferences prefs = getSharedPreferences("game_data", MODE_PRIVATE);
           
           // Load values and set them in our protected containers
           int savedGold = prefs.getInt("player_gold", 100);
           int savedLevel = prefs.getInt("player_level", 1);
           
           playerGold.set(savedGold);
           playerLevel.set(savedLevel);
           
           updateUI();
       }
       
       @Override
       protected void onPause() {
           super.onPause();
           saveGame();
       }
       
       @Override
       protected void onDestroy() {
           shield.destroy(); // Clean up resources
           super.onDestroy();
       }
       
       // Show dialogs for cheating detection and incompatible devices
       private void showCheatingDetectedDialog() {
           new AlertDialog.Builder(this)
               .setTitle("Violation Detected")
               .setMessage("Cheating detected. Your progress has been reset.")
               .setPositiveButton("OK", null)
               .setCancelable(false)
               .show();
       }
       
       private void showIncompatibleDeviceDialog() {
           new AlertDialog.Builder(this)
               .setTitle("Incompatible Device")
               .setMessage("This game cannot run on modified devices.")
               .setPositiveButton("Exit", (dialog, which) -> finish())
               .setCancelable(false)
               .show();
       }
   }
   ```

## 3. Security Best Practices

### Server-side

1. **API Key Management**:
   - Generate strong API keys (at least 32 characters)
   - Rotate keys regularly
   - Limit API key permissions

2. **Rate Limiting**:
   - Implement aggressive rate limiting to prevent abuse
   - IP-based limiting to prevent DDoS attacks

3. **HTTPS Configuration**:
   - Use strong cipher suites
   - Enable HSTS
   - Configure proper certificate chain

4. **Monitoring**:
   - Set up alerts for unusual traffic patterns
   - Monitor for repeated violations from the same device
   - Implement IP blocking for persistent attackers

### Client-side

1. **Obfuscate Your Code**:
   - Use a tool like ProGuard with aggressive settings
   - Apply additional custom obfuscation to sensitive parts
   - Rename classes and methods to obscure their purpose

2. **Shield the Protection System**:
   - Add integrity checks for the protection system itself
   - Implement multiple layers of verification
   - Use reflection to hide method names

3. **Encryption**:
   - Encrypt all saved data
   - Use strong encryption algorithms for sensitive data
   - Store encryption keys securely using Android Keystore

4. **App Signing**:
   - Use Google Play App Signing
   - Implement additional signature verification

## 4. Testing Your Implementation

### Server Testing

1. Verify server is accepting connections:
   ```bash
   curl -I https://your-server.com/health
   ```

2. Test log submission:
   ```bash
   curl -X POST https://your-server.com/api/log-tampering \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-api-key" \
     -d '{"severity":"warning","type":"test","deviceId":"test-device"}'
   ```

### Client Testing

1. Test with known cheat tools installed
2. Test with debugger attached
3. Test with memory editors
4. Test on emulators
5. Test on rooted devices

## 5. Ongoing Maintenance

### Regular Updates

1. Keep the protection system updated with new cheat tool signatures
2. Update server-side detection logic as new cheating methods emerge
3. Monitor for bypass techniques and update countermeasures

### Monitoring

1. Set up regular log analysis to identify cheating trends
2. Create dashboards to visualize cheating attempts
3. Use analytics to identify suspicious patterns across users

## 6. Troubleshooting

### Server Issues

1. **Server not responding**:
   - Check firewall settings
   - Verify correct port configuration
   - Check process is running: `ps aux | grep node`

2. **HTTPS certificate issues**:
   - Verify certificate paths
   - Check certificate expiration
   - Ensure certificate chain is complete

### Client Issues

1. **Native library not loading**:
   - Check ABI compatibility
   - Verify library is properly included in the APK
   - Add additional logging in Java wrapper

2. **False positives**:
   - Adjust detection sensitivity
   - Whitelist known safe environments
   - Add more verification layers

## 7. Advanced Protection Techniques

For enterprise-level games, consider these additional protection methods:

1. **Server-side validation** of all important game actions
2. **Replay protection** for network requests
3. **Hardware-backed security** using Android KeyStore
4. **Integrity verification** of game assets
5. **Code diversification** across different builds
6. **Custom native code** for critical game logic

## 8. Legal Considerations

Ensure your Privacy Policy and Terms of Service disclose:

1. Anti-cheat technology usage
2. Data collection for security purposes
3. Potential penalties for violation
4. Appeal process for false positives

---

For additional support or custom implementation, contact the STFU GameGuardian development team.
