
// Game Value - Protected game value that detects tampering attempts

export class GameValue<T> {
  private key: string;
  private originalValue: T;
  private currentValue: T;
  private checksums: string[] = [];
  private lastAccessTime: number = 0;
  private accessCount: number = 0;
  private verificationCallback: (() => boolean) | null = null;
  
  /**
   * Create a new protected game value
   */
  constructor(key: string, initialValue: T, verificationCallback?: () => boolean) {
    this.key = key;
    this.originalValue = this.deepClone(initialValue);
    this.currentValue = this.deepClone(initialValue);
    this.updateChecksums();
    this.lastAccessTime = Date.now();
    
    if (verificationCallback) {
      this.verificationCallback = verificationCallback;
    }
    
    console.log(`[GameValue] Protected value created: ${key}`);
  }
  
  /**
   * Get the current value (with integrity check)
   */
  public get(): T {
    this.accessCount++;
    this.lastAccessTime = Date.now();
    
    // Verify integrity before returning - only check checksum, skip custom verification
    // to avoid recursion
    if (!this.isChecksumValid()) {
      console.warn(`[GameValue] Tampering detected when accessing: ${this.key}`);
      // In a real implementation, this would trigger more serious countermeasures
    }
    
    return this.deepClone(this.currentValue);
  }
  
  /**
   * Set a new value with protection
   */
  public set(newValue: T): void {
    this.accessCount++;
    this.lastAccessTime = Date.now();
    
    // Verify integrity before setting - only check checksum, skip custom verification
    // to avoid recursion
    if (!this.isChecksumValid()) {
      console.warn(`[GameValue] Tampering detected when setting: ${this.key}`);
      // In a real implementation, this would trigger more serious countermeasures
    }
    
    this.currentValue = this.deepClone(newValue);
    this.updateChecksums();
  }
  
  /**
   * Reset to initial value
   */
  public reset(): void {
    this.currentValue = this.deepClone(this.originalValue);
    this.updateChecksums();
    console.log(`[GameValue] Reset value: ${this.key}`);
  }
  
  /**
   * Check if just the checksum is valid (without custom verification)
   * This helps break the recursion loop
   */
  private isChecksumValid(): boolean {
    const currentChecksum = this.calculateChecksum(this.currentValue);
    return this.checksums.includes(currentChecksum);
  }
  
  /**
   * Verify if the value has been tampered with
   */
  public verify(): boolean {
    // Check if checksum is valid
    const isChecksumValid = this.isChecksumValid();
    
    // Check with custom verification if available
    // But only if checksum is valid to avoid unnecessary verification
    const isCustomVerificationValid = !isChecksumValid ? false :
      (this.verificationCallback ? this.verificationCallback() : true);
    
    return isChecksumValid && isCustomVerificationValid;
  }
  
  /**
   * Update checksums after value changes
   */
  private updateChecksums(): void {
    const checksum = this.calculateChecksum(this.currentValue);
    this.checksums = [checksum];
  }
  
  /**
   * Calculate checksum for a value
   */
  private calculateChecksum(value: T): string {
    // Convert value to string representation
    const valueString = JSON.stringify(value);
    
    // Simple hash function for demo
    // In a real implementation, use a stronger hash algorithm
    let hash = 0;
    for (let i = 0; i < valueString.length; i++) {
      const char = valueString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(16);
  }
  
  /**
   * Deep clone a value to prevent reference manipulation
   */
  private deepClone<V>(value: V): V {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      console.error(`[GameValue] Error cloning value: ${error}`);
      return value;
    }
  }
}
