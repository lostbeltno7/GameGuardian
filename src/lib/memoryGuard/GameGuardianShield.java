package com.gameguardianshield;

import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Game Guardian Shield - Production Ready Implementation
 * Anti-cheat protection for Android games
 */
public class GameGuardianShield {
    private static final String TAG = "GameGuardianShield";
    
    // Native library
    static {
        System.loadLibrary("gameguardianshield"); // Load native library
    }
    
    // Shield configuration
    private Context context;
    private Handler mainHandler;
    private ExecutorService executorService;
    private Runnable integrityChecker;
    private boolean isProtectionActive = false;
    private CheatListener cheatListener;
    private String serverEndpoint;
    private String apiKey;
    private int checkInterval = 2000; // Default: 2 seconds
    private int maxViolations = 3;
    private int currentViolations = 0;
    private String uniqueId = null;
    private String playerId = null;
    private String sessionId = null;
    private final Map<String, ProtectedValue<?>> protectedValues = new HashMap<>();
    private final Map<String, Object> gameValues = new HashMap<>();
    private final List<String> memoryRegions = new ArrayList<>();
    
    // Callbacks for cheat detection
    public interface CheatListener {
        void onCheatDetected(int severity, String type);
        void onProtectionFailure(String error);
        void onServerResponse(JSONObject response);
    }
    
    /**
     * Initialize the protection shield with default settings
     * @param context Application context
     */
    public GameGuardianShield(Context context) {
        this(context, null, null);
    }
    
    /**
     * Initialize the protection shield with server reporting
     * @param context Application context
     * @param serverEndpoint Server endpoint for reporting violations
     * @param apiKey API key for authentication with server
     */
    public GameGuardianShield(Context context, String serverEndpoint, String apiKey) {
        this.context = context;
        this.serverEndpoint = serverEndpoint;
        this.apiKey = apiKey;
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.executorService = Executors.newSingleThreadExecutor();
        this.uniqueId = UUID.randomUUID().toString();
        this.sessionId = UUID.randomUUID().toString();
        
        // Setup integrity checker
        this.integrityChecker = new Runnable() {
            @Override
            public void run() {
                if (isProtectionActive) {
                    checkIntegrity();
                    mainHandler.postDelayed(this, checkInterval);
                }
            }
        };
        
        Log.i(TAG, "Shield initialized");
    }
    
    /**
     * Set callback listener for cheat detection events
     */
    public void setCheatListener(CheatListener listener) {
        this.cheatListener = listener;
    }
    
    /**
     * Start the protection system
     * @return true if protection started successfully
     */
    public boolean startProtection() {
        Log.i(TAG, "Starting protection system");
        
        try {
            // Initialize native protection
            if (!initNativeProtection(context)) {
                Log.e(TAG, "Failed to initialize native protection");
                if (cheatListener != null) {
                    cheatListener.onProtectionFailure("Failed to initialize native protection");
                }
                return false;
            }
            
            // Start the integrity checker
            isProtectionActive = true;
            mainHandler.post(integrityChecker);
            Log.i(TAG, "Protection system activated");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Error starting protection", e);
            if (cheatListener != null) {
                cheatListener.onProtectionFailure(e.getMessage());
            }
            return false;
        }
    }
    
    /**
     * Stop the protection system
     */
    public void stopProtection() {
        if (isProtectionActive) {
            isProtectionActive = false;
            mainHandler.removeCallbacks(integrityChecker);
            Log.i(TAG, "Protection system deactivated");
        }
    }
    
    /**
     * Set check interval for integrity checks
     * @param intervalMs interval in milliseconds
     */
    public void setCheckInterval(int intervalMs) {
        this.checkInterval = Math.max(500, intervalMs); // Don't allow intervals less than 500ms
    }
    
    /**
     * Set maximum violations before terminal action
     * @param maxViolations maximum number of violations
     */
    public void setMaxViolations(int maxViolations) {
        this.maxViolations = Math.max(1, maxViolations);
    }
    
    /**
     * Set player ID for server verification
     * @param playerId the player's unique identifier
     */
    public void setPlayerId(String playerId) {
        this.playerId = playerId;
        
        // Register player with the server
        if (serverEndpoint != null && apiKey != null) {
            registerPlayerWithServer();
        }
    }
    
    /**
     * Register a game value for tracking and verification
     * @param key the key name for the value
     * @param value the current value
     */
    public void registerGameValue(String key, Object value) {
        gameValues.put(key, value);
        
        // If we're already connected to the server, sync this value
        if (serverEndpoint != null && apiKey != null && playerId != null) {
            syncGameValuesWithServer();
        }
    }
    
    /**
     * Update a tracked game value
     * @param key the key name for the value
     * @param newValue the new value
     */
    public void updateGameValue(String key, Object newValue) {
        // Only allow update if the key already exists
        if (gameValues.containsKey(key)) {
            gameValues.put(key, newValue);
            
            // If connected to server, sync this value
            if (serverEndpoint != null && apiKey != null && playerId != null) {
                syncGameValuesWithServer();
            }
        } else {
            Log.w(TAG, "Attempted to update unregistered game value: " + key);
        }
    }
    
    /**
     * Register player with the server
     */
    private void registerPlayerWithServer() {
        if (playerId == null) {
            Log.e(TAG, "Cannot register player: Player ID not set");
            return;
        }
        
        executorService.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    // Prepare JSON payload
                    JSONObject payload = new JSONObject();
                    payload.put("playerId", playerId);
                    payload.put("deviceId", uniqueId);
                    
                    // Include initial game values if any
                    if (!gameValues.isEmpty()) {
                        JSONObject initialData = new JSONObject();
                        for (Map.Entry<String, Object> entry : gameValues.entrySet()) {
                            initialData.put(entry.getKey(), entry.getValue().toString());
                        }
                        payload.put("initialData", initialData);
                    }
                    
                    // Send registration to server
                    URL url = new URL(serverEndpoint + "/api/register-player");
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setRequestMethod("POST");
                    connection.setRequestProperty("Content-Type", "application/json");
                    connection.setRequestProperty("X-API-Key", apiKey);
                    connection.setDoOutput(true);
                    connection.setConnectTimeout(5000);
                    connection.setReadTimeout(5000);
                    
                    // Send payload
                    OutputStream os = connection.getOutputStream();
                    os.write(payload.toString().getBytes("UTF-8"));
                    os.close();
                    
                    // Get response
                    int responseCode = connection.getResponseCode();
                    
                    if (responseCode >= 200 && responseCode < 300) {
                        StringBuilder response = new StringBuilder();
                        try (BufferedReader br = new BufferedReader(
                                new InputStreamReader(connection.getInputStream(), "utf-8"))) {
                            String responseLine = null;
                            while ((responseLine = br.readLine()) != null) {
                                response.append(responseLine.trim());
                            }
                        }
                        
                        Log.i(TAG, "Player registered successfully: " + response.toString());
                        
                        // Notify via callback if available
                        if (cheatListener != null) {
                            final JSONObject jsonResponse = new JSONObject(response.toString());
                            mainHandler.post(new Runnable() {
                                @Override
                                public void run() {
                                    cheatListener.onServerResponse(jsonResponse);
                                }
                            });
                        }
                    } else {
                        Log.e(TAG, "Failed to register player: " + responseCode);
                    }
                    
                    connection.disconnect();
                } catch (Exception e) {
                    Log.e(TAG, "Error registering player with server", e);
                }
            }
        });
    }
    
    /**
     * Sync game values with the server for verification
     */
    public void syncGameValuesWithServer() {
        if (playerId == null || gameValues.isEmpty()) {
            Log.w(TAG, "Cannot sync: Missing player ID or game values");
            return;
        }
        
        executorService.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    // Prepare JSON payload
                    JSONObject payload = new JSONObject();
                    payload.put("playerId", playerId);
                    payload.put("sessionId", sessionId);
                    payload.put("clientTimestamp", System.currentTimeMillis());
                    
                    // Add all current game values
                    JSONObject valuesObject = new JSONObject();
                    for (Map.Entry<String, Object> entry : gameValues.entrySet()) {
                        valuesObject.put(entry.getKey(), entry.getValue());
                    }
                    payload.put("gameValues", valuesObject);
                    
                    // Add checksum - simple hash of the values
                    String checksum = calculateChecksum(valuesObject.toString());
                    payload.put("checksum", checksum);
                    
                    // Configure connection
                    URL url = new URL(serverEndpoint + "/api/sync-game-values");
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setRequestMethod("POST");
                    connection.setRequestProperty("Content-Type", "application/json");
                    connection.setRequestProperty("X-API-Key", apiKey);
                    connection.setDoOutput(true);
                    connection.setConnectTimeout(5000);
                    connection.setReadTimeout(5000);
                    
                    // Send payload
                    OutputStream os = connection.getOutputStream();
                    os.write(payload.toString().getBytes("UTF-8"));
                    os.close();
                    
                    // Get response
                    int responseCode = connection.getResponseCode();
                    StringBuilder response = new StringBuilder();
                    
                    try (BufferedReader br = new BufferedReader(
                            new InputStreamReader(connection.getInputStream(), "utf-8"))) {
                        String responseLine = null;
                        while ((responseLine = br.readLine()) != null) {
                            response.append(responseLine.trim());
                        }
                    }
                    
                    JSONObject jsonResponse = new JSONObject(response.toString());
                    final String status = jsonResponse.optString("status", "unknown");
                    
                    if (responseCode >= 200 && responseCode < 300 && "valid".equals(status)) {
                        Log.i(TAG, "Game values synced successfully");
                    } else if ("invalid".equals(status)) {
                        Log.w(TAG, "Server rejected game values as invalid");
                        
                        // If server returns correct values, apply them
                        if (jsonResponse.has("serverValues")) {
                            JSONObject serverValues = jsonResponse.getJSONObject("serverValues");
                            applyServerValues(serverValues);
                        }
                    } else {
                        Log.e(TAG, "Failed to sync game values: " + responseCode);
                    }
                    
                    // Notify via callback if available
                    if (cheatListener != null) {
                        final JSONObject finalResponse = jsonResponse;
                        mainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                cheatListener.onServerResponse(finalResponse);
                            }
                        });
                    }
                    
                    connection.disconnect();
                } catch (Exception e) {
                    Log.e(TAG, "Error syncing game values with server", e);
                }
            }
        });
    }
    
    /**
     * Apply server-provided values to local game state
     */
    private void applyServerValues(JSONObject serverValues) throws JSONException {
        // Update local gameValues with server values
        for (String key : gameValues.keySet()) {
            if (serverValues.has(key)) {
                Object serverValue = serverValues.get(key);
                gameValues.put(key, serverValue);
                
                Log.i(TAG, "Corrected value from server: " + key + " = " + serverValue);
                
                // If there's a protected value for this key, update it too
                for (Map.Entry<String, ProtectedValue<?>> entry : protectedValues.entrySet()) {
                    if (entry.getKey().contains(key)) {
                        // This is simplified - in a real implementation you'd need 
                        // type-specific handling for each protected value type
                        try {
                            if (serverValue instanceof Integer) {
                                ((ProtectedValue<Integer>)entry.getValue()).set((Integer)serverValue);
                            } else if (serverValue instanceof Long) {
                                ((ProtectedValue<Long>)entry.getValue()).set((Long)serverValue);
                            } else if (serverValue instanceof Float) {
                                ((ProtectedValue<Float>)entry.getValue()).set((Float)serverValue);
                            } else if (serverValue instanceof Double) {
                                ((ProtectedValue<Double>)entry.getValue()).set((Double)serverValue);
                            } else if (serverValue instanceof Boolean) {
                                ((ProtectedValue<Boolean>)entry.getValue()).set((Boolean)serverValue);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Error updating protected value from server", e);
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Calculate a checksum for a string
     */
    private String calculateChecksum(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes("UTF-8"));
            StringBuilder hexString = new StringBuilder();
            
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            
            return hexString.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error calculating checksum", e);
            return "";
        }
    }
    
    /**
     * Check system integrity
     */
    private void checkIntegrity() {
        executorService.execute(new Runnable() {
            @Override
            public void run() {
                boolean integrityFailed = false;
                String detectionType = "";
                
                // Check for tampering tools
                if (detectCheatTools()) {
                    integrityFailed = true;
                    detectionType = "cheat_tool";
                }
                
                // Check protected memory regions
                if (!integrityFailed && checkProtectedMemory()) {
                    integrityFailed = true;
                    detectionType = "memory_tampering";
                }
                
                // Check protected values
                if (!integrityFailed && checkProtectedValues()) {
                    integrityFailed = true;
                    detectionType = "value_tampering";
                }
                
                // If integrity check failed, notify and apply countermeasures
                if (integrityFailed) {
                    currentViolations++;
                    final int severity = (currentViolations >= maxViolations) ? 2 : 1; // 1=warning, 2=critical
                    final String violationType = detectionType;
                    
                    // Apply countermeasures based on severity
                    applyCountermeasures(severity, violationType);
                    
                    // Report to server if endpoint is configured
                    if (serverEndpoint != null && apiKey != null) {
                        reportViolationToServer(severity, violationType);
                    }
                    
                    // Sync with server to verify game values
                    if (playerId != null && serverEndpoint != null && apiKey != null) {
                        syncGameValuesWithServer();
                    }
                    
                    // Notify listener on main thread
                    final int finalSeverity = severity;
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            if (cheatListener != null) {
                                cheatListener.onCheatDetected(finalSeverity, violationType);
                            }
                        }
                    });
                }
            }
        });
    }
    
    /**
     * Apply countermeasures based on severity level
     */
    private void applyCountermeasures(int severity, String type) {
        Log.w(TAG, "Applying countermeasures: severity=" + severity + ", type=" + type);
        
        // Call native method to apply countermeasures
        nativeApplyCountermeasures(severity, type);
        
        // Apply Java-level countermeasures
        if (severity >= 2) {
            // Reset all protected values to prevent continued cheating
            for (ProtectedValue<?> value : protectedValues.values()) {
                value.reset();
            }
        }
    }
    
    /**
     * Report violation to the server
     */
    private void reportViolationToServer(final int severity, final String type) {
        executorService.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    // Prepare JSON payload
                    JSONObject payload = new JSONObject();
                    payload.put("deviceId", uniqueId);
                    if (playerId != null) payload.put("playerId", playerId);
                    payload.put("sessionId", sessionId);
                    payload.put("severity", severity == 2 ? "critical" : "warning");
                    payload.put("type", type);
                    payload.put("timestamp", System.currentTimeMillis());
                    payload.put("violations", currentViolations);
                    payload.put("deviceInfo", collectDeviceInfo());
                    
                    // Include current game values for server verification
                    if (!gameValues.isEmpty()) {
                        JSONObject valuesObject = new JSONObject();
                        for (Map.Entry<String, Object> entry : gameValues.entrySet()) {
                            valuesObject.put(entry.getKey(), entry.getValue());
                        }
                        payload.put("gameValues", valuesObject);
                    }
                    
                    // Configure connection
                    URL url = new URL(serverEndpoint + "/api/log-tampering");
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setRequestMethod("POST");
                    connection.setRequestProperty("Content-Type", "application/json");
                    connection.setRequestProperty("X-API-Key", apiKey);
                    connection.setDoOutput(true);
                    connection.setConnectTimeout(5000);
                    connection.setReadTimeout(5000);
                    
                    // Send payload
                    OutputStream os = connection.getOutputStream();
                    os.write(payload.toString().getBytes("UTF-8"));
                    os.close();
                    
                    // Get response
                    int responseCode = connection.getResponseCode();
                    if (responseCode >= 200 && responseCode < 300) {
                        Log.i(TAG, "Violation reported to server successfully");
                    } else {
                        Log.e(TAG, "Failed to report violation to server: " + responseCode);
                    }
                    
                    connection.disconnect();
                } catch (Exception e) {
                    Log.e(TAG, "Error reporting violation to server", e);
                }
            }
        });
    }
    
    /**
     * Collect device information for reporting
     */
    private JSONObject collectDeviceInfo() {
        try {
            JSONObject deviceInfo = new JSONObject();
            deviceInfo.put("manufacturer", Build.MANUFACTURER);
            deviceInfo.put("model", Build.MODEL);
            deviceInfo.put("device", Build.DEVICE);
            deviceInfo.put("brand", Build.BRAND);
            deviceInfo.put("sdkVersion", Build.VERSION.SDK_INT);
            deviceInfo.put("appVersion", context.getPackageManager().getPackageInfo(
                    context.getPackageName(), 0).versionName);
            return deviceInfo;
        } catch (Exception e) {
            Log.e(TAG, "Error collecting device info", e);
            return new JSONObject();
        }
    }
    
    /**
     * Check if device is rooted
     */
    private boolean isDeviceRooted() {
        // Check common root directories
        for (String path : new String[]{
                "/system/app/Superuser.apk",
                "/system/xbin/su",
                "/system/bin/su",
                "/sbin/su",
                "/system/su",
                "/system/bin/.ext/.su"}) {
            if (new File(path).exists()) {
                return true;
            }
        }
        
        // Check for "su" command
        Process process = null;
        try {
            process = Runtime.getRuntime().exec(new String[]{"which", "su"});
            BufferedReader reader = new BufferedReader(new FileReader(process.getInputStream().toString()));
            return reader.readLine() != null;
        } catch (Exception ignored) {
            // Exception doesn't mean device is not rooted
        } finally {
            if (process != null) {
                process.destroy();
            }
        }
        
        return false;
    }
    
    /**
     * Check if a specific package is installed
     */
    private boolean isPackageInstalled(String packageName) {
        try {
            context.getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
    
    /**
     * Generic protected value wrapper class
     */
    public static class ProtectedValue<T> {
        private final long nativePtr;
        private final T originalValue;
        private boolean isValid = true;
        
        @SuppressWarnings("unchecked")
        private ProtectedValue(long ptr, T initialValue) {
            this.nativePtr = ptr;
            this.originalValue = initialValue;
        }
        
        @SuppressWarnings("unchecked")
        public T get() {
            if (!isValid) {
                return originalValue;
            }
            
            // For Integer type
            if (originalValue instanceof Integer) {
                return (T) Integer.valueOf(nativeGetInt(nativePtr));
            } 
            // For Long type
            else if (originalValue instanceof Long) {
                return (T) Long.valueOf(nativeGetLong(nativePtr));
            }
            // For Float type
            else if (originalValue instanceof Float) {
                return (T) Float.valueOf(nativeGetFloat(nativePtr));
            }
            // For Double type
            else if (originalValue instanceof Double) {
                return (T) Double.valueOf(nativeGetDouble(nativePtr));
            }
            // For Boolean type
            else if (originalValue instanceof Boolean) {
                return (T) Boolean.valueOf(nativeGetBoolean(nativePtr));
            }
            
            return originalValue;
        }
        
        public void set(T value) {
            if (!isValid) {
                return;
            }
            
            // For Integer type
            if (value instanceof Integer) {
                nativeSetInt(nativePtr, (Integer) value);
            }
            // For Long type
            else if (value instanceof Long) {
                nativeSetLong(nativePtr, (Long) value);
            }
            // For Float type
            else if (value instanceof Float) {
                nativeSetFloat(nativePtr, (Float) value);
            }
            // For Double type
            else if (value instanceof Double) {
                nativeSetDouble(nativePtr, (Double) value);
            }
            // For Boolean type
            else if (value instanceof Boolean) {
                nativeSetBoolean(nativePtr, (Boolean) value);
            }
        }
        
        public void reset() {
            set(originalValue);
        }
        
        public void invalidate() {
            isValid = false;
        }
    }
    
    /**
     * Create a protected integer value
     */
    public ProtectedValue<Integer> protectInt(int initialValue) {
        long ptr = nativeProtectInt(initialValue);
        ProtectedValue<Integer> value = new ProtectedValue<>(ptr, initialValue);
        protectedValues.put("int:" + ptr, value);
        return value;
    }
    
    /**
     * Create a protected long value
     */
    public ProtectedValue<Long> protectLong(long initialValue) {
        long ptr = nativeProtectLong(initialValue);
        ProtectedValue<Long> value = new ProtectedValue<>(ptr, initialValue);
        protectedValues.put("long:" + ptr, value);
        return value;
    }
    
    /**
     * Create a protected float value
     */
    public ProtectedValue<Float> protectFloat(float initialValue) {
        long ptr = nativeProtectFloat(initialValue);
        ProtectedValue<Float> value = new ProtectedValue<>(ptr, initialValue);
        protectedValues.put("float:" + ptr, value);
        return value;
    }
    
    /**
     * Create a protected double value
     */
    public ProtectedValue<Double> protectDouble(double initialValue) {
        long ptr = nativeProtectDouble(initialValue);
        ProtectedValue<Double> value = new ProtectedValue<>(ptr, initialValue);
        protectedValues.put("double:" + ptr, value);
        return value;
    }
    
    /**
     * Create a protected boolean value
     */
    public ProtectedValue<Boolean> protectBoolean(boolean initialValue) {
        long ptr = nativeProtectBoolean(initialValue);
        ProtectedValue<Boolean> value = new ProtectedValue<>(ptr, initialValue);
        protectedValues.put("boolean:" + ptr, value);
        return value;
    }
    
    /**
     * Add a memory region to protection
     */
    public void protectMemoryRegion(long address, int size) {
        nativeProtectMemoryRegion(address, size);
        memoryRegions.add(address + ":" + size);
    }
    
    /**
     * Check if any protected values have been tampered with
     */
    private boolean checkProtectedValues() {
        return nativeCheckProtectedValues();
    }
    
    /**
     * Check if protected memory regions have been tampered with
     */
    private boolean checkProtectedMemory() {
        return nativeCheckProtectedMemory();
    }
    
    /**
     * Clean up resources when done
     */
    public void destroy() {
        stopProtection();
        nativeDestroy();
        
        // Shutdown executor
        try {
            executorService.shutdown();
            if (!executorService.awaitTermination(2, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
        }
    }
    
    // Native method declarations
    private native boolean initNativeProtection(Context context);
    private native boolean detectCheatTools();
    private native void nativeProtectMemoryRegion(long address, int size);
    private native boolean nativeCheckProtectedMemory();
    private native boolean nativeCheckProtectedValues();
    private native void nativeApplyCountermeasures(int severity, String type);
    private native void nativeDestroy();
    
    // Protected value native methods
    private native long nativeProtectInt(int value);
    private native long nativeProtectLong(long value);
    private native long nativeProtectFloat(float value);
    private native long nativeProtectDouble(double value);
    private native long nativeProtectBoolean(boolean value);
    
    private native int nativeGetInt(long ptr);
    private native long nativeGetLong(long ptr);
    private native float nativeGetFloat(long ptr);
    private native double nativeGetDouble(long ptr);
    private native boolean nativeGetBoolean(long ptr);
    
    private native void nativeSetInt(long ptr, int value);
    private native void nativeSetLong(long ptr, long value);
    private native void nativeSetFloat(long ptr, float value);
    private native void nativeSetDouble(long ptr, double value);
    private native void nativeSetBoolean(long ptr, boolean value);
}
