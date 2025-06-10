#include <jni.h>
#include <string>
#include <vector>
#include <unordered_map>
#include <android/log.h>
#include <sys/ptrace.h>
#include <sys/types.h>
#include <unistd.h>
#include <dlfcn.h>
#include <fcntl.h>
#include <cstring>
#include <mutex>
#include <random>
#include <algorithm>

#define TAG "STFUGameGuardian"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

// Struct to track protected memory regions
struct MemoryRegion {
    void* address;
    size_t size;
    uint32_t checksum;
    bool valid;
};

// Struct to store protected values
template <typename T>
struct ProtectedValue {
    T value;
    T originalValue;
    uint32_t checksum;
    bool valid;
};

// Known cheat tool packages
const std::vector<std::string> CHEAT_PACKAGES = {
    "com.gameguardian.app",
    "org.cheatengine.cegui",
    "catch_.me_.if_.you_.can_",
    "com.zune.gamekiller",
    "com.lmzs.gamehacker",
    "com.leo.simulator",
    "com.cih.game_cih",
    "com.xmodgame",
    "com.zhangkun.gameplay",
    "org.sbtools.gamehack",
    "com.glt.ctrler",
    "com.finalshare.freecoin",
};

// Global variables
static std::vector<MemoryRegion> g_memoryRegions;
static std::unordered_map<long, void*> g_protectedPtrs;
static std::mutex g_mutex;
static bool g_initialized = false;
static std::mt19937 g_rng;

// Calculate memory region checksum
uint32_t calculateChecksum(void* addr, size_t size) {
    if (!addr || size == 0) return 0;
    
    uint32_t checksum = 0;
    uint8_t* ptr = static_cast<uint8_t*>(addr);
    
    for (size_t i = 0; i < size; i++) {
        checksum = ((checksum << 5) + checksum) + ptr[i];
    }
    
    return checksum;
}

// Check if process is being debugged
bool isBeingDebugged() {
    // Try to detect tracers
    if (ptrace(PTRACE_TRACEME, 0, 1, 0) < 0) {
        return true; // Already being traced
    }
    ptrace(PTRACE_DETACH, 0, 1, 0); // Detach
    
    // Check TracerPid in /proc/self/status
    FILE *f = fopen("/proc/self/status", "r");
    if (f) {
        char line[256];
        while (fgets(line, sizeof(line), f)) {
            if (strncmp(line, "TracerPid:", 10) == 0) {
                int pid;
                if (sscanf(line + 10, "%d", &pid) == 1 && pid != 0) {
                    fclose(f);
                    return true; // Being traced
                }
                break;
            }
        }
        fclose(f);
    }
    
    return false;
}

// Check for emulator
bool isEmulator() {
    // Check common emulator properties
    char prop[PROP_VALUE_MAX];
    
    if (__system_property_get("ro.product.model", prop) > 0) {
        if (strcmp(prop, "sdk") == 0 || strcmp(prop, "google_sdk") == 0)
            return true;
    }
    
    if (__system_property_get("ro.product.manufacturer", prop) > 0) {
        if (strcmp(prop, "Genymotion") == 0 || strcmp(prop, "unknown") == 0)
            return true;
    }
    
    if (__system_property_get("ro.hardware", prop) > 0) {
        if (strcmp(prop, "goldfish") == 0 || strcmp(prop, "ranchu") == 0)
            return true;
    }
    
    return false;
}

// Detect cheating tools in memory
bool detectCheatToolsInMemory() {
    // This would scan memory for signatures of cheating tools
    // Simplified version for this implementation
    return false;
}

// Obfuscate a value using XOR with a random key
template <typename T>
T obfuscate(T value) {
    std::uniform_int_distribution<uint32_t> dist;
    uint32_t key = dist(g_rng);
    return *reinterpret_cast<T*>(reinterpret_cast<uintptr_t>(&value) ^ key) ^ key;
}

// Deobfuscate a value
template <typename T>
T deobfuscate(T value, uint32_t key) {
    return *reinterpret_cast<T*>(reinterpret_cast<uintptr_t>(&value) ^ key) ^ key;
}

// JNI Functions

extern "C" {

    // Initialize protection
    JNIEXPORT jboolean JNICALL
    Java_com_stfugg_STFUGameGuardian_initNativeProtection(
            JNIEnv *env, jobject thiz, jobject context) {
        std::lock_guard<std::mutex> lock(g_mutex);
        
        if (g_initialized) {
            return JNI_TRUE; // Already initialized
        }
        
        LOGI("Initializing native protection");
        
        // Initialize random number generator with random seed
        std::random_device rd;
        g_rng.seed(rd());
        
        // Check for debuggers
        if (isBeingDebugged()) {
            LOGW("Debugger detected");
            return JNI_FALSE;
        }
        
        // Check for emulator if needed (may want to allow emulators for testing)
        // if (isEmulator()) {
        //     LOGW("Emulator detected");
        //     return JNI_FALSE;
        // }
        
        g_initialized = true;
        return JNI_TRUE;
    }
    
    // Detect cheating tools
    JNIEXPORT jboolean JNICALL
    Java_com_stfugg_STFUGameGuardian_detectCheatTools(JNIEnv *env, jobject thiz) {
        // Get the package manager
        jclass contextClass = env->GetObjectClass(thiz);
        jmethodID getContextMethod = env->GetMethodID(contextClass, "getContext", 
                                               "()Landroid/content/Context;");
        jobject context = env->CallObjectMethod(thiz, getContextMethod);
        
        jclass contextClass2 = env->GetObjectClass(context);
        jmethodID getPackageManagerId = env->GetMethodID(contextClass2, "getPackageManager", 
                                               "()Landroid/content/pm/PackageManager;");
        jobject packageManager = env->CallObjectMethod(context, getPackageManagerId);
        
        // Check for cheat tool packages
        for (const auto& package : CHEAT_PACKAGES) {
            jclass packageManagerClass = env->GetObjectClass(packageManager);
            jmethodID getPackageInfoId = env->GetMethodID(packageManagerClass, "getPackageInfo", 
                                               "(Ljava/lang/String;I)Landroid/content/pm/PackageInfo;");
            
            jstring packageNameStr = env->NewStringUTF(package.c_str());
            
            try {
                env->CallObjectMethod(packageManager, getPackageInfoId, packageNameStr, 0);
                env->DeleteLocalRef(packageNameStr);
                LOGW("Cheat tool detected: %s", package.c_str());
                return JNI_TRUE; // Package exists
            } catch (...) {
                // Package doesn't exist, continue checking
                env->ExceptionClear();
            }
            
            env->DeleteLocalRef(packageNameStr);
        }
        
        // Check for in-memory signatures
        if (detectCheatToolsInMemory()) {
            LOGW("Cheat tool signatures detected in memory");
            return JNI_TRUE;
        }
        
        return JNI_FALSE;
    }
    
    // Protect memory region
    JNIEXPORT void JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeProtectMemoryRegion(
            JNIEnv *env, jobject thiz, jlong address, jint size) {
        std::lock_guard<std::mutex> lock(g_mutex);
        
        void* addr = reinterpret_cast<void*>(address);
        
        MemoryRegion region;
        region.address = addr;
        region.size = static_cast<size_t>(size);
        region.checksum = calculateChecksum(addr, size);
        region.valid = true;
        
        g_memoryRegions.push_back(region);
        
        LOGI("Protected memory region: %p, size: %u", addr, size);
    }
    
    // Check if protected memory has been tampered
    JNIEXPORT jboolean JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeCheckProtectedMemory(
            JNIEnv *env, jobject thiz) {
        std::lock_guard<std::mutex> lock(g_mutex);
        
        for (auto& region : g_memoryRegions) {
            if (!region.valid) continue;
            
            uint32_t currentChecksum = calculateChecksum(region.address, region.size);
            if (currentChecksum != region.checksum) {
                LOGW("Memory tampering detected at %p", region.address);
                return JNI_TRUE;
            }
        }
        
        return JNI_FALSE;
    }
    
    // Check if protected values have been tampered
    JNIEXPORT jboolean JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeCheckProtectedValues(
            JNIEnv *env, jobject thiz) {
        // Implementation would verify checksums for all protected values
        // This is a simplified version
        return JNI_FALSE;
    }
    
    // Apply countermeasures
    JNIEXPORT void JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeApplyCountermeasures(
            JNIEnv *env, jobject thiz, jint severity, jstring type) {
        const char* typeStr = env->GetStringUTFChars(type, nullptr);
        LOGW("Applying countermeasures: severity=%d, type=%s", severity, typeStr);
        env->ReleaseStringUTFChars(type, typeStr);
        
        // Terminal countermeasures for critical violations
        if (severity >= 2) {
            // In a production implementation, this could do various things
            // like corrupting game state, making the game gradually unplayable, etc.
        }
    }
    
    // Cleanup resources
    JNIEXPORT void JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeDestroy(
            JNIEnv *env, jobject thiz) {
        std::lock_guard<std::mutex> lock(g_mutex);
        
        // Free all allocated memory
        for (auto& ptr : g_protectedPtrs) {
            free(ptr.second);
        }
        g_protectedPtrs.clear();
        g_memoryRegions.clear();
        g_initialized = false;
        
        LOGI("Native resources cleaned up");
    }
    
    // Protected value methods - INT
    JNIEXPORT jlong JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeProtectInt(
            JNIEnv *env, jobject thiz, jint value) {
        int* ptr = new int(value);
        long id = reinterpret_cast<long>(ptr);
        g_protectedPtrs[id] = ptr;
        return id;
    }
    
    JNIEXPORT jint JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeGetInt(
            JNIEnv *env, jobject thiz, jlong ptr) {
        int* valuePtr = reinterpret_cast<int*>(ptr);
        return *valuePtr;
    }
    
    JNIEXPORT void JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeSetInt(
            JNIEnv *env, jobject thiz, jlong ptr, jint value) {
        int* valuePtr = reinterpret_cast<int*>(ptr);
        *valuePtr = value;
    }
    
    // Protected value methods - LONG
    JNIEXPORT jlong JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeProtectLong(
            JNIEnv *env, jobject thiz, jlong value) {
        long* ptr = new long(value);
        long id = reinterpret_cast<long>(ptr);
        g_protectedPtrs[id] = ptr;
        return id;
    }
    
    JNIEXPORT jlong JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeGetLong(
            JNIEnv *env, jobject thiz, jlong ptr) {
        long* valuePtr = reinterpret_cast<long*>(ptr);
        return *valuePtr;
    }
    
    JNIEXPORT void JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeSetLong(
            JNIEnv *env, jobject thiz, jlong ptr, jlong value) {
        long* valuePtr = reinterpret_cast<long*>(ptr);
        *valuePtr = value;
    }
    
    // Protected value methods - FLOAT
    JNIEXPORT jlong JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeProtectFloat(
            JNIEnv *env, jobject thiz, jfloat value) {
        float* ptr = new float(value);
        long id = reinterpret_cast<long>(ptr);
        g_protectedPtrs[id] = ptr;
        return id;
    }
    
    JNIEXPORT jfloat JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeGetFloat(
            JNIEnv *env, jobject thiz, jlong ptr) {
        float* valuePtr = reinterpret_cast<float*>(ptr);
        return *valuePtr;
    }
    
    JNIEXPORT void JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeSetFloat(
            JNIEnv *env, jobject thiz, jlong ptr, jfloat value) {
        float* valuePtr = reinterpret_cast<float*>(ptr);
        *valuePtr = value;
    }
    
    // Protected value methods - DOUBLE
    JNIEXPORT jlong JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeProtectDouble(
            JNIEnv *env, jobject thiz, jdouble value) {
        double* ptr = new double(value);
        long id = reinterpret_cast<long>(ptr);
        g_protectedPtrs[id] = ptr;
        return id;
    }
    
    JNIEXPORT jdouble JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeGetDouble(
            JNIEnv *env, jobject thiz, jlong ptr) {
        double* valuePtr = reinterpret_cast<double*>(ptr);
        return *valuePtr;
    }
    
    JNIEXPORT void JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeSetDouble(
            JNIEnv *env, jobject thiz, jlong ptr, jdouble value) {
        double* valuePtr = reinterpret_cast<double*>(ptr);
        *valuePtr = value;
    }
    
    // Protected value methods - BOOLEAN
    JNIEXPORT jlong JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeProtectBoolean(
            JNIEnv *env, jobject thiz, jboolean value) {
        bool* ptr = new bool(value);
        long id = reinterpret_cast<long>(ptr);
        g_protectedPtrs[id] = ptr;
        return id;
    }
    
    JNIEXPORT jboolean JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeGetBoolean(
            JNIEnv *env, jobject thiz, jlong ptr) {
        bool* valuePtr = reinterpret_cast<bool*>(ptr);
        return *valuePtr;
    }
    
    JNIEXPORT void JNICALL
    Java_com_stfugg_STFUGameGuardian_nativeSetBoolean(
            JNIEnv *env, jobject thiz, jlong ptr, jboolean value) {
        bool* valuePtr = reinterpret_cast<bool*>(ptr);
        *valuePtr = value;
    }
}
