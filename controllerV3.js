import { GetAllServers, msToTime} from "utils.js"

/** @param {NS} ns */
export async function main(ns) {
  let target = "n00dles";
  if (ns.args.length > 0) target = ns.args[0];

  ns.disableLog("ALL");

  const maxMoney = ns.getServerMaxMoney(target);
  const moneyMult = 2;
  const delay = 100;

  class Attack {
    constructor(script, duration = 100, threads = 1, delay = 0, start = performance.now()) {
      this.script = script;
      this.duration = duration;
      this.threads = threads;
      this.ram = ns.getScriptRam(script);
      this.delay = delay;
      this.start = start;
    }
  }

  let hack = new Attack("hack.js");
  let grow = new Attack("grow.js");
  let weaken1 = new Attack("weaken.js");
  let weaken2 = new Attack("weaken.js");

  while (true) {
    //Calculate needed time and threads
    let weakenSec = ns.weakenAnalyze(1);
    grow.duration = ns.getGrowTime(target);
    hack.duration = ns.getHackTime(target);
    grow.threads = Math.max(Math.ceil(ns.growthAnalyze(target, moneyMult + 0.5)), 1);
    hack.threads = Math.max(Math.ceil(ns.hackAnalyzeThreads(target, maxMoney / moneyMult)), 1);
    weaken1.threads = Math.ceil(ns.hackAnalyzeSecurity(hack.threads) / weakenSec);
    weaken2.threads = Math.ceil(ns.growthAnalyzeSecurity(grow.threads) / weakenSec);
    weaken1.duration = ns.getWeakenTime(target);
    weaken2.duration = ns.getWeakenTime(target);

    //If not enough RAM to run all of the scripts, 
    //reduce the amount of threads proportionally
    let totalRamNeeded = (grow.threads * grow.ram + hack.threads * hack.ram
      + weaken1.ram * (weaken1.treads + weaken2.threads));
    var totalRam = RamAvailable(ns);
    if (totalRamNeeded > totalRam) {
      let threadMult = totalRam / totalRamNeeded;
      grow.threads = Math.max(Math.ceil(grow.threads * threadMult), 1);
      hack.threads = Math.max(Math.ceil(hack.threads * threadMult), 1);
      weaken1.threads = Math.ceil(ns.hackAnalyzeSecurity(hack.threads) / weakenSec);
      weaken2.threads = Math.ceil(ns.growthAnalyzeSecurity(grow.threads) / weakenSec);
    }

    let duration = (2 * delay) + weaken2.duration;
    let batchCount = Math.floor((duration - hack.duration)/(4 * delay) - 1);
    if (batchCount == 0) batchCount++;
    ns.print(`Batch count: ${batchCount}`);

    weaken1.start = Date.now();
    let att = []; 
    
    //Put all of the attacks into an array
    for (var i = 0; i < batchCount; i++) {
    weaken2.delay = 2 * delay;
    weaken2.start = weaken2.delay + weaken1.start;
    grow.delay = weaken1.duration - grow.duration - delay;
    grow.start = grow.delay + weaken2.start;
    hack.delay = grow.duration - hack.duration - (2 * delay);
    hack.start = hack.delay + grow.start;
    //att.push(weaken1, weaken2, grow, hack);
    att.push(new Attack(weaken1.script, weaken1.duration, weaken1.threads, weaken1.delay, weaken1.start));
    att.push(new Attack(weaken2.script, weaken2.duration, weaken2.threads, weaken2.delay, weaken2.start));
    att.push(new Attack(grow.script, grow.duration, grow.threads, grow.delay, grow.start));
    att.push(new Attack(hack.script, hack.duration, hack.threads, hack.delay, hack.start));  
    weaken1.start += 4*delay;
    }
    
    //Sort by starting time
    att.sort((a,b) => (a.start > b.start) ? 1 : ((a.start < b.start) ? -1 : 0));

    for (var i = 0; i < att.length; i++)
    {
      await RunScript(ns, att[i].script, target, att[i].threads);
      let sl = (i == (att.length - 1)) ? delay : (att[i+1].start - performance.now());
      ns.print(`Waiting for ${msToTime(sl)}`);
      await ns.sleep(sl);
    }
  }
}

export async function RunScript(ns, scriptName, target, threads) {
  // Find all servers
  let allServers = GetAllServers(ns);

  // Sort by maximum memory
  allServers = allServers.sort(RamSort);
  function RamSort(a, b) {
    if (ns.getServerMaxRam(a) > ns.getServerMaxRam(b)) return -1;
    if (ns.getServerMaxRam(a) < ns.getServerMaxRam(b)) return 1;
    return 0;
  }

  // Find script RAM usage
  let ramPerThread = ns.getScriptRam(scriptName);

  // Find usable servers
  let usableServers = allServers.filter(
    (p) => ns.hasRootAccess(p) && ns.getServerMaxRam(p) > 0
  );
  
  // Fired threads counter
  let fired = 0;

  for (const server of usableServers) {
    // Determine how many threads we can run on target server for the given script
    let availableRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
    if ((server === "home") && (availableRam > 20)) availableRam -= 20;
    let possibleThreads = Math.floor(availableRam / ramPerThread);

    // Check if server is already at max capacity
    if (possibleThreads <= 0) continue;

    // Lower thread count if we are over target
    if (possibleThreads > threads) possibleThreads = threads;

    // Fire the script with as many threads as possible
    await ns.print(
      `Starting script ${scriptName} on ${server} with ${possibleThreads} threads`
    );
    await ns.exec(scriptName, server, possibleThreads, target);
    fired += possibleThreads;
    if (fired >= threads) break;
  }
}

export function RamAvailable(ns) {
  let allServers = GetAllServers(ns);
  let usableServers = allServers.filter(
    (p) => ns.hasRootAccess(p) && ns.getServerMaxRam(p) > 0
  );
  let ram = 0;
  for (const server of usableServers) {
    let availableRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
    if ((server === "home") && (availableRam > 20)) availableRam -= 20;
    ram += Math.ceil(availableRam * 0.9);
  }
  if (ram == 0) ram = 1;
  return ram;
}


