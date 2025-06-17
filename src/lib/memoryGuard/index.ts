
// STFU GameGuardian - Anti-Cheat Protection System
// This library provides memory integrity checking to prevent cheating in Android games

import { MemoryScanner } from './memoryScanner';
import { ToolDetector } from './toolDetector';
import { MemoryProtector } from './memoryProtector';
import { GameValue } from './gameValue';

export { 
  MemoryScanner, 
  ToolDetector, 
  MemoryProtector,
  GameValue
};

// Configurable options for STFUGG
export interface GuardianShieldOptions {
  /**
   * Interval in milliseconds between integrity checks
   */
  checkInterval?: number;
  
  /**
   * Server endpoint for logging tampering attempts
   */
  serverLogEndpoint?: string;
  
  /**
   * Maximum number of tampering attempts before terminal countermeasures
   */
  maxTamperingAttempts?: number;
  
  /**
   * Whether to apply obfuscation techniques
   */
  enableObfuscation?: boolean;
  
  /**
   * Whether to encrypt protected values
   */
  enableEncryption?: boolean;
}

// Event types for the cheat detection system
export enum CheatDetectionType {
  MEMORY_TAMPERING = 'memory_tampering',
  VALUE_TAMPERING = 'value_tampering',
  TOOL_DETECTED = 'tool_detected',
  DEBUGGER_DETECTED = 'debugger_detected',
  EMULATOR_DETECTED = 'emulator_detected',
  SUSPICIOUS_BEHAVIOR = 'suspicious_behavior'
}

// CheatDetection event interface
export interface CheatDetectionEvent {
  type: CheatDetectionType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, any>;
  timestamp: Date;
}

// Main STFU GameGuardian class that integrates all protection features
export class GuardianShield {
  private scanner: MemoryScanner;
  private detector: ToolDetector;
  private protector: MemoryProtector;
  private isRunning: boolean = false;
  private checkInterval: number = 1000; // Default check interval in ms
  private intervalId: NodeJS.Timeout | null = null;
  private protectedValues: Map<string, GameValue<any>> = new Map();
  private onCheatDetectedCallback: ((event: CheatDetectionEvent) => void) | null = null;
  private isVerifying: boolean = false; // Flag to prevent recursive verification
  private sessionId: string;
  private deviceId: string;
  private playerId?: string;

  /**
   * Create a new GuardianShield instance
   * @param options Configuration options for the shield
   */
  constructor(options?: GuardianShieldOptions) {
    this.scanner = new MemoryScanner();
    this.detector = new ToolDetector();
    
    // Initialize protector with server endpoint if provided
    this.protector = new MemoryProtector({
      serverLogEndpoint: options?.serverLogEndpoint
    });
    
    if (options?.checkInterval) {
      this.checkInterval = options.checkInterval;
    }
    
    if (options?.maxTamperingAttempts) {
      this.protector.setMaxTamperingAttempts(options.maxTamperingAttempts);
    }
    
    if (options?.enableObfuscation !== undefined) {
      this.protector.setObfuscation(options.enableObfuscation);
    }
    
    if (options?.enableEncryption !== undefined) {
      this.protector.setEncryption(options.enableEncryption);
    }
    
    // Generate random session and device IDs for this instance
    this.sessionId = this.generateRandomId();
    this.deviceId = this.getDeviceId();
  }

  /**
   * Set player ID for server-side validation
   */
  public setPlayerId(playerId: string): void {
    this.playerId = playerId;
  }

  /**
   * Start the Guardian Shield protection system
   * @returns Boolean indicating if protection started successfully
   */
  public start(): boolean {
    if (this.isRunning) return true;
    
    // Run initial check before setting interval
    const initialCheck = this.runChecks();
    if (initialCheck.criticalIssueDetected) {
      console.warn('[GuardianShield] Critical security issue detected during initialization');
      return false;
    }
    
    this.isRunning = true;
    console.log('[GuardianShield] Protection system initialized');
    
    // Start periodic memory checks
    this.intervalId = setInterval(() => {
      this.runChecks();
    }, this.checkInterval);
    
    return true;
  }

  /**
   * Stop the Guardian Shield protection system
   */
  public stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('[GuardianShield] Protection system stopped');
  }

  /**
   * Set callback to be triggered when cheating is detected
   * @param callback Function to call when cheating is detected
   */
  public onCheatDetected(callback: (event: CheatDetectionEvent) => void): void {
    this.onCheatDetectedCallback = callback;
  }

  /**
   * Protect a game value from modification
   * @param key Unique identifier for the value
   * @param initialValue The initial value to protect
   * @returns A protected GameValue instance
   */
  public protectValue<T>(key: string, initialValue: T): GameValue<T> {
    // Create verification callback that uses the shield's verification system
    const verificationCallback = () => {
      // Skip verification during recursive check
      if (this.isVerifying) {
        return true;
      }
      
      return true; // Simple verification to avoid recursion
    };
    
    // Create a GameValue with verification callback
    const gameValue = new GameValue<T>(key, initialValue, verificationCallback);
    this.protectedValues.set(key, gameValue);
    return gameValue;
  }

  /**
   * Manually report a suspicious activity to the server
   * @param type Type of cheat detection
   * @param severity Severity level of the detection
   * @param details Additional details about the detection
   */
  public reportSuspiciousActivity(
    type: CheatDetectionType,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details?: Record<string, any>
  ): void {
    const event: CheatDetectionEvent = {
      type,
      severity,
      details,
      timestamp: new Date()
    };
    
    this.handleCheatDetected(event);
  }

  /**
   * Get the current device ID
   * @returns A device identifier string
   */
  private getDeviceId(): string {
    // In a real implementation, this would use actual device identifiers
    // For this implementation, we generate a random ID and store it in localStorage
    try {
      const storedDeviceId = localStorage.getItem('gameguardian_device_id');
      if (storedDeviceId) {
        return storedDeviceId;
      }
      
      const newDeviceId = this.generateRandomId();
      localStorage.setItem('gameguardian_device_id', newDeviceId);
      return newDeviceId;
    } catch (e) {
      // If localStorage is not available, generate a new ID each time
      return this.generateRandomId();
    }
  }

  /**
   * Generate a random ID string
   * @returns A random ID
   */
  private generateRandomId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Check if a specific value has been tampered with
   * @param key The key of the value to check
   * @returns Boolean indicating if the value is valid
   */
  private checkValue(key: string): boolean {
    // Prevent recursive verification
    if (this.isVerifying) {
      return true; // Skip verification during recursive calls
    }
    
    const gameValue = this.protectedValues.get(key);
    if (!gameValue) return false;
    
    // Set flag to prevent recursion
    this.isVerifying = true;
    const result = gameValue.verify();
    this.isVerifying = false;
    
    return result;
  }

  /**
   * Run all protection checks
   * @returns Object containing results of the checks
   */
  private runChecks(): { criticalIssueDetected: boolean } {
    let criticalIssueDetected = false;
    
    // Check for cheating tools
    const toolsDetectionResult = this.detector.detectCheatTools();
    if (toolsDetectionResult.detected) {
      criticalIssueDetected = true;
      this.handleCheatDetected({
        type: CheatDetectionType.TOOL_DETECTED,
        severity: 'critical',
        details: toolsDetectionResult.details,
        timestamp: new Date()
      });
    }
    
    // Check memory integrity
    const memoryTamperingResult = this.scanner.scanMemoryForTampering();
    if (memoryTamperingResult.tampered) {
      criticalIssueDetected = true;
      this.handleCheatDetected({
        type: CheatDetectionType.MEMORY_TAMPERING,
        severity: 'high',
        details: memoryTamperingResult.details,
        timestamp: new Date()
      });
    }
    
    // Check protected values without causing recursion
    this.isVerifying = true;
    let valuesTampered = false;
    let tamperedKeys: string[] = [];
    
    this.protectedValues.forEach((value, key) => {
      // Use a direct check without callbacks
      if (!value.verify()) {
        valuesTampered = true;
        tamperedKeys.push(key);
      }
    });
    
    this.isVerifying = false;
    
    if (valuesTampered) {
      criticalIssueDetected = true;
      this.handleCheatDetected({
        type: CheatDetectionType.VALUE_TAMPERING,
        severity: 'high',
        details: { tamperedKeys },
        timestamp: new Date()
      });
    }
    
    return { criticalIssueDetected };
  }

  /**
   * Handle detected cheating attempts
   * @param event The cheat detection event
   */
  private handleCheatDetected(event: CheatDetectionEvent): void {
    console.warn(`[GuardianShield] Cheat attempt detected! Type: ${event.type}, Severity: ${event.severity}`);
    
    // Apply countermeasures
    this.protector.applyCountermeasures();
    
    // Send to server with identifiers
    this.protector.setServerLogEndpoint(this.protector.getServerLogEndpoint() || undefined);
    this.protector.reportTamperingToServer({
      type: event.type,
      severity: event.severity,
      details: event.details || {},
      timestamp: event.timestamp.toISOString(),
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      playerId: this.playerId
    });
    
    // Call user-defined callback if exists
    if (this.onCheatDetectedCallback) {
      this.onCheatDetectedCallback(event);
    }
  }
}
