import { useState, useEffect } from "react";
import { GuardianShield, GameValue } from "@/lib/memoryGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Check, X, BarChart, Code, Terminal, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface GameStats {
  score: number;
  coins: number;
  health: number;
  level: number;
}

const Index = () => {
  const [guardianShield, setGuardianShield] = useState<GuardianShield | null>(null);
  const [isProtectionActive, setIsProtectionActive] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastDetection, setLastDetection] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    coins: 100,
    health: 100,
    level: 1,
  });
  const [protectedValues, setProtectedValues] = useState<Record<string, GameValue<any>>>({});
  const [modifyTrigger, setModifyTrigger] = useState<number>(0);

  // Initialize the anti-cheat system
  useEffect(() => {
    const shield = new GuardianShield({ checkInterval: 2000 });
    setGuardianShield(shield);

    // Override console methods to capture logs
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    console.log = (...args) => {
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      setLogs(prev => [message, ...prev].slice(0, 100));
      originalConsoleLog(...args);
    };

    console.warn = (...args) => {
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      setLogs(prev => [`⚠️ ${message}`, ...prev].slice(0, 100));
      originalConsoleWarn(...args);
    };

    console.error = (...args) => {
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      setLogs(prev => [`🛑 ${message}`, ...prev].slice(0, 100));
      originalConsoleError(...args);
    };

    return () => {
      // Restore console methods
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
      
      // Clean up the shield
      if (shield) {
        shield.stop();
      }
    };
  }, []);

  // Register protected values when guardian shield is ready
  useEffect(() => {
    if (!guardianShield) return;

    const protectedScore = guardianShield.protectValue('score', stats.score);
    const protectedCoins = guardianShield.protectValue('coins', stats.coins);
    const protectedHealth = guardianShield.protectValue('health', stats.health);
    const protectedLevel = guardianShield.protectValue('level', stats.level);

    setProtectedValues({
      score: protectedScore,
      coins: protectedCoins,
      health: protectedHealth,
      level: protectedLevel,
    });

    guardianShield.onCheatDetected(() => {
      setDetectionCount(prev => prev + 1);
      setLastDetection(new Date().toLocaleTimeString());
    });

  }, [guardianShield]);

  // Update stats from protected values when they change or when shield is active
  useEffect(() => {
    if (!isProtectionActive) return;

    const interval = setInterval(() => {
      setScanCount(prev => prev + 1);
    }, 2000);

    return () => clearInterval(interval);
  }, [isProtectionActive]);

  // Update stats when protected values change
  useEffect(() => {
    if (Object.keys(protectedValues).length === 0) return;
    
    setStats({
      score: protectedValues.score?.get() || stats.score,
      coins: protectedValues.coins?.get() || stats.coins,
      health: protectedValues.health?.get() || stats.health,
      level: protectedValues.level?.get() || stats.level,
    });
  }, [protectedValues, modifyTrigger]);

  const toggleProtection = () => {
    if (guardianShield) {
      if (isProtectionActive) {
        guardianShield.stop();
        setIsProtectionActive(false);
      } else {
        guardianShield.start();
        setIsProtectionActive(true);
      }
    }
  };

  const incrementStat = (stat: keyof GameStats, amount: number) => {
    if (!protectedValues[stat]) return;
    
    protectedValues[stat].set(protectedValues[stat].get() + amount);
    setModifyTrigger(prev => prev + 1);
  };

  const simulateTamper = () => {
    // Simulate memory tampering by directly setting stats
    // This would be caught by the anti-cheat if protection is active
    setStats(prev => ({
      ...prev,
      coins: 99999,
      health: 999,
    }));

    // Trigger update to show detection
    setTimeout(() => {
      setModifyTrigger(prev => prev + 1);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-10 h-10 text-blue-400" />
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            STFU GameGuardian
          </h1>
        </div>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Memory protection system to prevent cheating in Android games with tools like Game Guardian, Cheat Engine, and more.
        </p>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Controls */}
        <Card className="bg-gray-800 border-gray-700 col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-yellow-400" />
              Control Center
            </CardTitle>
            <CardDescription className="text-gray-400">
              Manage protection and simulate game actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center mb-6">
              <Button 
                onClick={toggleProtection} 
                className={`w-full py-6 text-lg ${isProtectionActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {isProtectionActive ? 'Stop Protection' : 'Start Protection'}
              </Button>
              
              <div className="mt-4 flex items-center justify-center gap-2">
                <Badge className={`${isProtectionActive ? 'bg-green-600' : 'bg-gray-600'}`}>
                  {isProtectionActive ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
                <span className="text-xs text-gray-400">Shield Status</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Game Actions:</h3>
              
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => incrementStat('score', 10)}>
                  Add Score (+10)
                </Button>
                <Button variant="outline" onClick={() => incrementStat('coins', 5)}>
                  Add Coins (+5)
                </Button>
                <Button variant="outline" onClick={() => incrementStat('health', 10)} disabled={stats.health >= 100}>
                  Heal (+10)
                </Button>
                <Button variant="outline" onClick={() => incrementStat('level', 1)}>
                  Level Up
                </Button>
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-700">
              <Button 
                variant="destructive" 
                className="w-full" 
                onClick={simulateTamper}
              >
                <AlertTriangle size={16} className="mr-2" />
                Simulate Memory Tampering
              </Button>
              <p className="text-xs text-gray-400 mt-1 text-center">
                This simulates what a cheat tool would attempt to do
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Middle column - Game preview */}
        <Card className="bg-gray-800 border-gray-700 col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart size={18} className="text-purple-400" />
              Game Stats
            </CardTitle>
            <CardDescription className="text-gray-400">
              Protected memory values
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-blue-300">Score</span>
                  <span className="text-sm font-bold">{stats.score}</span>
                </div>
                <Progress value={Math.min(stats.score / 10, 100)} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-yellow-300">Coins</span>
                  <span className="text-sm font-bold">{stats.coins}</span>
                </div>
                <Progress value={Math.min(stats.coins / 2, 100)} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-red-300">Health</span>
                  <span className="text-sm font-bold">{stats.health}/100</span>
                </div>
                <Progress value={stats.health} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-green-300">Level</span>
                  <span className="text-sm font-bold">{stats.level}</span>
                </div>
                <Progress value={Math.min(stats.level * 10, 100)} className="h-2" />
              </div>
            </div>

            {detectionCount > 0 && (
              <Alert className="bg-red-900/50 text-red-100 border-red-700 mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Cheating Detected</AlertTitle>
                <AlertDescription>
                  Memory tampering attempt detected at {lastDetection}. This would trigger anti-cheat measures in a real game.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <div className="text-3xl font-bold text-blue-400">{scanCount}</div>
                <div className="text-xs text-gray-400">Memory Scans</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <div className="text-3xl font-bold text-red-400">{detectionCount}</div>
                <div className="text-xs text-gray-400">Detections</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right column - Technical details & logs */}
        <Card className="bg-gray-800 border-gray-700 col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Terminal size={18} className="text-green-400" />
              Technical Details
            </CardTitle>
            <CardDescription className="text-gray-400">
              Implementation insights and logs
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-0">
            <Tabs defaultValue="logs">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="logs" className="flex-1">System Logs</TabsTrigger>
                <TabsTrigger value="code" className="flex-1">Integration Code</TabsTrigger>
              </TabsList>
              
              <TabsContent value="logs" className="mt-0">
                <div className="bg-black rounded-md p-1 h-80 overflow-y-auto text-xs font-mono">
                  {logs.length > 0 ? (
                    <div className="space-y-1 p-2">
                      {logs.map((log, index) => (
                        <div key={index} className={`
                          ${log.startsWith('🛑') ? 'text-red-400' : 
                            log.startsWith('⚠️') ? 'text-yellow-400' : 'text-green-400'}
                        `}>
                          {log}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">Start protection to see logs</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="code" className="mt-0">
                <div className="bg-black rounded-md p-4 h-80 overflow-y-auto text-xs font-mono text-gray-300">
                  <pre className="whitespace-pre-wrap">
{`// Example usage in your game project

// 1. Initialize the STFU GameGuardian system
const shield = new GuardianShield({
  checkInterval: 1000,      // How often to check memory (ms)
  enableObfuscation: true,  // Enable code obfuscation
  enableEncryption: true,   // Enable value encryption
  maxTamperingAttempts: 3   // Max attempts before terminal action
});

// 2. Start the protection when your game starts
shield.start();

// 3. Protect important game values
const playerHealth = shield.protectValue('health', 100);
const playerCoins = shield.protectValue('coins', 0);
const playerXP = shield.protectValue('xp', 0);
const playerLevel = shield.protectValue('level', 1);

// 4. Add callback for cheat detection
shield.onCheatDetected((event) => {
  console.warn(\`Cheating detected! Type: \${event.type}\`);
  
  // Apply penalties or show warnings to the player
  if (event.severity === 'critical') {
    // Apply terminal countermeasures for serious violations
    applyCheatPenalty();
  } else {
    // Show warning for minor violations
    showWarningMessage();
  }
});

// 5. Use protected values in your game
function updatePlayerUI() {
  // Get values safely
  document.getElementById('health').textContent = playerHealth.get();
  document.getElementById('coins').textContent = playerCoins.get();
  document.getElementById('level').textContent = playerLevel.get();
}

// 6. Update protected values safely
function addCoins(amount) {
  // Safe way to modify protected values
  playerCoins.set(playerCoins.get() + amount);
}

function takeDamage(amount) {
  playerHealth.set(Math.max(0, playerHealth.get() - amount));
  if (playerHealth.get() <= 0) {
    gameOver();
  }
}

// 7. Clean up when game ends
function exitGame() {
  shield.stop();
  // Other cleanup...
}`}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
