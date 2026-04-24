// ================= NeowsBigForge V2.0 定性构筑沙盘核心引擎 =================

let allCards = {};
let myDeck = [];
let myDrafts = [];
// 增加两个平行的宇宙内存
let sandboxMemoryDeck = []; // 脑测模式专属内存
let liveMemoryDeck = [];    // 实战模式专属内存
let currentAppMode = 'sandbox'; // 默认进入脑测模式

// --- 核心修复：新增双轨环境的独立参数内存 ---
let liveMemoryEnergy = localStorage.getItem('SpireV2_LiveEnergy') || "3.0";
let liveMemoryDraw = localStorage.getItem('SpireV2_LiveDraw') || "5";
let sandboxMemoryEnergy = "3.0";
let sandboxMemoryDraw = "5";

// 同步侦听器：实时将输入框的改动写入对应的平行宇宙内存
function bindParameterInputs() {
    const eInput = document.getElementById('energy-input');
    const dInput = document.getElementById('draw-input');

    const saveParams = () => {
        if (currentAppMode === 'live') {
            liveMemoryEnergy = eInput.value;
            liveMemoryDraw = dInput.value;
            localStorage.setItem('SpireV2_LiveEnergy', liveMemoryEnergy);
            localStorage.setItem('SpireV2_LiveDraw', liveMemoryDraw);
        } else {
            sandboxMemoryEnergy = eInput.value;
            sandboxMemoryDraw = dInput.value;
        }
    };

    if(eInput) eInput.addEventListener('input', saveParams);
    if(dInput) dInput.addEventListener('input', saveParams);
}
window.addEventListener('DOMContentLoaded', bindParameterInputs);

const classIcons = {
    "ironclad": "战", "silent": "猎", "defect": "机",
    "necrobinder": "灵", "regent": "君", "colorless": "无",
    "curse": "诅", "status": "状"
};

// ================= 初始卡组配置 (全员添加进阶之灾) =================
const starterTemplates = {
    "ironclad": ["StrikeIronclad", "StrikeIronclad", "StrikeIronclad", "StrikeIronclad", "StrikeIronclad", "DefendIronclad", "DefendIronclad", "DefendIronclad", "DefendIronclad", "Bash", "AscendersBane"],
    "silent": ["StrikeSilent", "StrikeSilent", "StrikeSilent", "StrikeSilent", "StrikeSilent", "DefendSilent", "DefendSilent", "DefendSilent", "DefendSilent", "DefendSilent", "Survivor", "Neutralize", "AscendersBane"],
    "defect": ["StrikeDefect", "StrikeDefect", "StrikeDefect", "StrikeDefect", "DefendDefect", "DefendDefect", "DefendDefect", "DefendDefect", "Zap", "Dualcast", "AscendersBane"],
    "necrobinder": ["StrikeNecrobinder", "StrikeNecrobinder", "StrikeNecrobinder", "StrikeNecrobinder", "DefendNecrobinder", "DefendNecrobinder", "DefendNecrobinder", "DefendNecrobinder", "Bodyguard", "Unleash", "AscendersBane"],
    "regent": ["StrikeRegent", "StrikeRegent", "StrikeRegent", "StrikeRegent", "DefendRegent", "DefendRegent", "DefendRegent", "DefendRegent", "Falling Star", "Venerate", "AscendersBane"]
};

// ================= V2.0 方案管理系统 =================
let slotNames = JSON.parse(localStorage.getItem('SpireV2_SlotNames')) || {};

function switchClassWorkspace() {
    const currentJob = document.getElementById('job-select').value;
    localStorage.setItem('SpireV2_LastJob', currentJob);
    renderSaveSlots();
    loadDeckFromDisk(true);
}

function renderSaveSlots() {
    const select = document.getElementById('save-slot');
    if (!select) return;

    const currentJob = document.getElementById('job-select')?.value || 'regent';
    const previousSelection = select.value;

    select.innerHTML = '';

    for (let i = 1; i <= 4; i++) {
        let slotId = `${currentJob}_slot${i}`;
        let defaultName = `方案 ${i}`;
        let displayName = slotNames[slotId] || defaultName;

        let opt = document.createElement('option');
        opt.value = slotId;
        opt.innerText = displayName;
        select.appendChild(opt);
    }

    if (previousSelection && previousSelection.startsWith(currentJob)) {
        select.value = previousSelection;
    } else {
        select.value = `${currentJob}_slot1`;
    }
}

function renameCurrentSlot() {
    const select = document.getElementById('save-slot');
    const currentSlot = select.value;
    const currentName = select.options[select.selectedIndex].text;

    const newName = prompt("给这个卡组方案起个名字吧：", currentName);
    if (newName !== null && newName.trim() !== "") {
        slotNames[currentSlot] = newName.trim();
        localStorage.setItem('SpireV2_SlotNames', JSON.stringify(slotNames));
        renderSaveSlots();
    }
}

function resetToStarter() {
    if (!confirm("确定要恢复为该职业的初始卡组吗？\n(注意：这只会改变当前沙盘面板，点击[覆盖存档]才会正式保存此状态)")) return;

    myDeck = [];
    let currentJob = document.getElementById('job-select')?.value || 'regent';

    if (typeof starterTemplates !== 'undefined' && starterTemplates[currentJob]) {
        const template = starterTemplates[currentJob];
        template.forEach(targetId => {
            let normalizedTarget = targetId.toLowerCase().replace(/[^a-z0-9]/g, '');
            let realKey = Object.keys(allCards).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedTarget);
            if (realKey) {
                myDeck.push({ ...allCards[realKey], id: realKey, isUpgraded: false });
            }
        });
    }

    let energyInput = document.getElementById('energy-input');
    let drawInput = document.getElementById('draw-input');
    if (energyInput) energyInput.value = "3.0";
    if (drawInput) drawInput.value = "5";

    if (typeof myDrafts !== 'undefined') myDrafts.forEach(d => d.selected = false);
    updateWorkshop();
}

function clearDeck() {
    if (myDeck.length > 0 && confirm("确定要完全清空当前卡组吗？\n(注意：这只会清空当前沙盘面板，点击[覆盖存档]才会正式保存此状态)")) {
        myDeck = [];
        if (typeof myDrafts !== 'undefined') myDrafts.forEach(d => d.selected = false);
        updateWorkshop();
    }
}

// ================= V2.0 沙盘读写分离引擎 =================
function loadDeckFromDisk(isInitialLoad = false) {
    let slot = document.getElementById('save-slot').value || 'save1';
    let savedData = localStorage.getItem(`sts2_v2_save_${slot}`);

    myDeck = [];
    let energyInput = document.getElementById('energy-input');
    let drawInput = document.getElementById('draw-input');

    if (savedData) {
        try {
            let state = JSON.parse(savedData);
            let savedDeck = Array.isArray(state) ? state : (state.deck || []);

            savedDeck.forEach(sc => {
                if (allCards[sc.id]) {
                    myDeck.push({ ...allCards[sc.id], id: sc.id, isUpgraded: sc.isUpgraded });
                }
            });

            if (!Array.isArray(state)) {
                if (state.energy !== undefined) {
                    sandboxMemoryEnergy = state.energy;
                    if (currentAppMode === 'sandbox' && energyInput) energyInput.value = state.energy;
                }
                if (state.draw !== undefined) {
                    sandboxMemoryDraw = state.draw;
                    if (currentAppMode === 'sandbox' && drawInput) drawInput.value = state.draw;
                }
                if (state.job !== undefined) {
                    document.getElementById('job-select').value = state.job;
                }
            }
        } catch (e) {
            console.error("读取存档失败", e);
        }
    } else {
        let currentJob = document.getElementById('job-select')?.value || 'regent';
        if (typeof starterTemplates !== 'undefined' && starterTemplates[currentJob]) {
            const template = starterTemplates[currentJob];
            template.forEach(targetId => {
                let normalizedTarget = targetId.toLowerCase().replace(/[^a-z0-9]/g, '');
                let realKey = Object.keys(allCards).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedTarget);
                if (realKey) myDeck.push({ ...allCards[realKey], id: realKey, isUpgraded: false });
            });
        }
    }

    updateWorkshop();

    if (!isInitialLoad) {
        let btn = document.querySelector('button[onclick^="loadDeckFromDisk"]');
        if(btn) {
            let originalText = btn.innerText;
            btn.innerText = "已重载";
            setTimeout(() => { btn.innerText = originalText; }, 1500);
        }
    }
}

function commitSaveToDisk() {
    let slot = document.getElementById('save-slot').value || 'save1';
    let energy = document.getElementById('energy-input').value;
    let draw = document.getElementById('draw-input').value;
    let job = document.getElementById('job-select').value;

    let stateToSave = {
        deck: myDeck,
        energy: parseFloat(energy),
        draw: parseInt(draw),
        job: job
    };

    localStorage.setItem(`sts2_v2_save_${slot}`, JSON.stringify(stateToSave));

    let btn = document.querySelector('button[onclick="commitSaveToDisk()"]');
    if(btn) {
        let originalText = btn.innerText;
        btn.innerText = "已保存";
        btn.style.backgroundColor = "#27ae60";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.backgroundColor = "";
        }, 1500);
    }
}

// ================= 基础配置与辞典加载 =================
const AVAILABLE_TAGS = ["过渡输出", "过渡防御", "终端输出", "终端防御", "润滑运转"];
const AVAILABLE_TIERS = ["S", "A", "B", "C", "F"];

const TIER_WEIGHTS = {
    'S': 1.5, 'A': 1.2, 'B': 1.0, 'C': 0.8, 'F': 0.3
};

const CLASS_COLORS = {
    "ironclad": { hex: "#e74c3c", rgb: "231, 76, 60" },
    "silent": { hex: "#2ecc71", rgb: "46, 204, 113" },
    "defect": { hex: "#3498db", rgb: "52, 152, 219" },
    "necrobinder": { hex: "#9b59b6", rgb: "155, 89, 182" },
    "regent": { hex: "#f1c40f", rgb: "241, 196, 15" },
    "colorless": { hex: "#95a5a6", rgb: "149, 165, 166" },
    "curse": { hex: "#34495e", rgb: "52, 73, 94" },
    "status": { hex: "#7f8c8d", rgb: "127, 140, 141" },
    "default": { hex: "#2980b9", rgb: "41, 128, 185" }
};

// ================= 位置：app.js 顶部偏下 (替换原有的 cardDictionary 声明) =================

// 引入由高阶 AI 预计算的核心卡牌价值字典 (Cold-Start Default Dictionary)
const DEFAULT_CARD_DICTIONARY = {
    "Abrasive": { "tier": "A", "tags": ["终端输出"] },
    "Accelerant": { "tier": "A", "tags": ["终端输出"] },
    "Accuracy": { "tier": "A", "tags": ["终端输出"] },
    "Acrobatics": { "tier": "S", "tags": ["过渡防御", "润滑运转"] },
    "AdaptiveStrike": { "tier": "B", "tags": ["过渡输出"] },
    "Adrenaline": { "tier": "S", "tags": ["润滑运转", "过渡输出"] },
    "Afterimage": { "tier": "S", "tags": ["终端防御", "润滑运转"] },
    "Afterlife": { "tier": "B", "tags": ["润滑运转"] },
    "Aggression": { "tier": "B", "tags": ["过渡输出"] },
    "Alchemize": { "tier": "A", "tags": ["润滑运转"] },
    "Alignment": { "tier": "A", "tags": ["润滑运转"] },
    "AllForOne": { "tier": "B", "tags": ["润滑运转"] },
    "Anger": { "tier": "B", "tags": ["过渡输出"] },
    "Anointed": { "tier": "B", "tags": ["过渡防御"] },
    "Anticipate": { "tier": "A", "tags": ["润滑运转"] },
    "Apotheosis": { "tier": "S", "tags": ["润滑运转"] },
    "Apparition": { "tier": "S", "tags": ["过渡防御"] },
    "Armaments": { "tier": "A", "tags": ["过渡防御"] },
    "Arsenal": { "tier": "A", "tags": ["终端输出"] },
    "AscendersBane": { "tier": "F", "tags": [] },
    "AshenStrike": { "tier": "B", "tags": ["过渡输出"] },
    "Assassinate": { "tier": "A", "tags": ["过渡输出"] },
    "AstralPulse": { "tier": "A", "tags": ["过渡输出"] },
    "Automation": { "tier": "A", "tags": ["润滑运转"] },
    "Backflip": { "tier": "A", "tags": ["过渡防御", "润滑运转"] },
    "Backstab": { "tier": "B", "tags": ["过渡输出"] },
    "BadLuck": { "tier": "F", "tags": [] },
    "BallLightning": { "tier": "A", "tags": ["过渡输出", "润滑运转"] },
    "BansheesCry": { "tier": "B", "tags": ["过渡防御"] },
    "Barrage": { "tier": "B", "tags": ["过渡输出"] },
    "Barricade": { "tier": "S", "tags": ["终端防御"] },
    "Bash": { "tier": "A", "tags": ["过渡输出"] },
    "BattleTrance": { "tier": "S", "tags": ["润滑运转"] },
    "BeaconOfHope": { "tier": "A", "tags": ["过渡防御"] },
    "BeamCell": { "tier": "B", "tags": ["过渡输出"] },
    "BeatDown": { "tier": "B", "tags": ["过渡输出"] },
    "BeatIntoShape": { "tier": "A", "tags": ["终端输出"] },
    "Beckon": { "tier": "B", "tags": ["润滑运转"] },
    "Begone": { "tier": "B", "tags": ["润滑运转"] },
    "BelieveInYou": { "tier": "B", "tags": ["过渡防御"] },
    "BiasedCognition": { "tier": "S", "tags": ["润滑运转"] },
    "BigBang": { "tier": "S", "tags": ["润滑运转", "过渡输出"] },
    "BlackHole": { "tier": "A", "tags": ["过渡输出"] },
    "BladeDance": { "tier": "A", "tags": ["过渡输出"] },
    "BladeOfInk": { "tier": "C", "tags": ["过渡输出"] },
    "BlightStrike": { "tier": "A", "tags": ["过渡输出"] },
    "Bloodletting": { "tier": "S", "tags": ["润滑运转"] },
    "BloodWall": { "tier": "A", "tags": ["过渡防御"] },
    "Bludgeon": { "tier": "B", "tags": ["过渡输出"] },
    "Blur": { "tier": "S", "tags": ["终端防御", "润滑运转"] },
    "Bodyguard": { "tier": "A", "tags": ["过渡防御"] },
    "BodySlam": { "tier": "S", "tags": ["终端输出"] },
    "Bolas": { "tier": "A", "tags": ["过渡输出"] },
    "Bombardment": { "tier": "B", "tags": ["过渡输出"] },
    "BoneShards": { "tier": "B", "tags": ["过渡输出"] },
    "BoostAway": { "tier": "B", "tags": ["润滑运转"] },
    "BootSequence": { "tier": "A", "tags": ["润滑运转"] },
    "BorrowedTime": { "tier": "S", "tags": ["润滑运转"] },
    "BouncingFlask": { "tier": "B", "tags": ["过渡输出"] },
    "Brand": { "tier": "S", "tags": ["润滑运转", "终端输出"] },
    "Break": { "tier": "S", "tags": ["终端输出"] },
    "Breakthrough": { "tier": "B", "tags": ["过渡输出"] },
    "BrightestFlame": { "tier": "S", "tags": ["终端输出"] },
    "BubbleBubble": { "tier": "C", "tags": ["过渡输出"] },
    "Buffer": { "tier": "A", "tags": ["终端防御"] },
    "BulkUp": { "tier": "B", "tags": ["过渡防御"] },
    "BulletTime": { "tier": "A", "tags": ["润滑运转"] },
    "Bully": { "tier": "B", "tags": ["过渡输出"] },
    "Bulwark": { "tier": "S", "tags": ["过渡防御", "终端防御"] },
    "BundleOfJoy": { "tier": "A", "tags": ["过渡输出"] },
    "Burn": { "tier": "F", "tags": [] },
    "BurningPact": { "tier": "A", "tags": ["润滑运转"] },
    "Burst": { "tier": "S", "tags": ["润滑运转"] },
    "Bury": { "tier": "C", "tags": ["过渡输出"] },
    "ByrdonisEgg": { "tier": "B", "tags": ["过渡输出"] },
    "ByrdSwoop": { "tier": "B", "tags": ["过渡输出"] },
    "Calamity": { "tier": "B", "tags": ["过渡输出"] },
    "Calcify": { "tier": "B", "tags": ["终端防御"] },
    "CalculatedGamble": { "tier": "S", "tags": ["润滑运转"] },
    "CallOfTheVoid": { "tier": "B", "tags": ["过渡输出"] },
    "Caltrops": { "tier": "B", "tags": ["终端防御"] },
    "Capacitor": { "tier": "S", "tags": ["终端防御", "润滑运转"] },
    "CaptureSpirit": { "tier": "S", "tags": ["润滑运转"] },
    "Cascade": { "tier": "B", "tags": ["过渡输出"] },
    "Catastrophe": { "tier": "B", "tags": ["过渡输出"] },
    "CelestialMight": { "tier": "C", "tags": ["终端输出"] },
    "Chaos": { "tier": "B", "tags": ["润滑运转"] },
    "Charge": { "tier": "A", "tags": ["润滑运转", "终端输出"] },
    "ChargeBattery": { "tier": "B", "tags": ["润滑运转"] },
    "ChildOfTheStars": { "tier": "S", "tags": ["终端防御", "终端输出"] },
    "Chill": { "tier": "S", "tags": ["过渡防御", "润滑运转"] },
    "Cinder": { "tier": "B", "tags": ["过渡输出"] },
    "Clash": { "tier": "A", "tags": ["过渡输出"] },
    "Claw": { "tier": "A", "tags": ["过渡输出"] },
    "Cleanse": { "tier": "S", "tags": ["润滑运转"] },
    "CloakAndDagger": { "tier": "B", "tags": ["过渡输出"] },
    "CloakOfStars": { "tier": "A", "tags": ["过渡防御"] },
    "Clumsy": { "tier": "F", "tags": [] },
    "ColdSnap": { "tier": "S", "tags": ["过渡防御", "润滑运转"] },
    "CollisionCourse": { "tier": "A", "tags": ["过渡输出"] },
    "Colossus": { "tier": "B", "tags": ["终端输出"] },
    "Comet": { "tier": "A", "tags": ["终端输出"] },
    "Compact": { "tier": "A", "tags": ["润滑运转"] },
    "CompileDriver": { "tier": "B", "tags": ["过渡输出"] },
    "Conflagration": { "tier": "B", "tags": ["过渡输出"] },
    "Conqueror": { "tier": "A", "tags": ["终端输出"] },
    "ConsumingShadow": { "tier": "B", "tags": ["过渡输出"] },
    "Convergence": { "tier": "S", "tags": ["润滑运转", "终端输出"] },
    "Coolant": { "tier": "A", "tags": ["终端防御"] },
    "Coolheaded": { "tier": "A", "tags": ["过渡防御", "润滑运转"] },
    "Coordinate": { "tier": "B", "tags": ["润滑运转"] },
    "CorrosiveWave": { "tier": "A", "tags": ["过渡输出"] },
    "Corruption": { "tier": "S", "tags": ["润滑运转"] },
    "CosmicIndifference": { "tier": "S", "tags": ["过渡防御", "润滑运转"] },
    "Countdown": { "tier": "B", "tags": ["过渡输出"] },
    "CrashLanding": { "tier": "B", "tags": ["过渡输出"] },
    "CreativeAi": { "tier": "A", "tags": ["润滑运转"] },
    "CrescentSpear": { "tier": "A", "tags": ["过渡输出", "终端输出"] },
    "CrimsonMantle": { "tier": "B", "tags": ["过渡防御"] },
    "Cruelty": { "tier": "B", "tags": ["过渡输出"] },
    "CrushUnder": { "tier": "A", "tags": ["过渡输出"] },
    "CurseOfTheBell": { "tier": "F", "tags": [] },
    "DaggerSpray": { "tier": "B", "tags": ["过渡输出"] },
    "DaggerThrow": { "tier": "A", "tags": ["过渡输出", "润滑运转"] },
    "DanseMacabre": { "tier": "B", "tags": ["终端输出"] },
    "DarkEmbrace": { "tier": "S", "tags": ["润滑运转", "终端输出"] },
    "Darkness": { "tier": "B", "tags": ["终端输出"] },
    "DarkShackles": { "tier": "B", "tags": ["过渡防御"] },
    "Dash": { "tier": "B", "tags": ["过渡输出"] },
    "Dazed": { "tier": "F", "tags": [] },
    "DeadlyPoison": { "tier": "A", "tags": ["终端输出"] },
    "Deathbringer": { "tier": "A", "tags": ["终端输出"] },
    "DeathMarch": { "tier": "B", "tags": ["终端输出"] },
    "DeathsDoor": { "tier": "A", "tags": ["终端防御"] },
    "Debilitate": { "tier": "B", "tags": ["过渡防御"] },
    "Debris": { "tier": "F", "tags": [] },
    "Debt": { "tier": "F", "tags": [] },
    "Decay": { "tier": "F", "tags": [] },
    "DecisionsDecisions": { "tier": "A", "tags": ["润滑运转"] },
    "DefendDefect": { "tier": "B", "tags": ["过渡防御"] },
    "DefendIronclad": { "tier": "B", "tags": ["过渡防御"] },
    "DefendNecrobinder": { "tier": "B", "tags": ["过渡防御"] },
    "DefendRegent": { "tier": "B", "tags": ["过渡防御"] },
    "DefendSilent": { "tier": "B", "tags": ["过渡防御"] },
    "Defile": { "tier": "B", "tags": ["润滑运转"] },
    "Deflect": { "tier": "B", "tags": ["过渡防御"] },
    "Defragment": { "tier": "S", "tags": ["润滑运转", "终端输出"] },
    "Defy": { "tier": "B", "tags": ["过渡防御"] },
    "Delay": { "tier": "C", "tags": ["润滑运转"] },
    "Demesne": { "tier": "B", "tags": ["终端防御"] },
    "DemonForm": { "tier": "S", "tags": ["终端输出", "润滑运转"] },
    "DemonicShield": { "tier": "B", "tags": ["终端防御"] },
    "DeprecatedCard": { "tier": "F", "tags": [] },
    "Devastate": { "tier": "B", "tags": ["过渡输出"] },
    "DevourLife": { "tier": "B", "tags": ["过渡输出"] },
    "Dirge": { "tier": "S", "tags": ["润滑运转", "终端输出"] },
    "Discovery": { "tier": "A", "tags": ["润滑运转"] },
    "Disintegration": { "tier": "B", "tags": ["过渡输出"] },
    "Dismantle": { "tier": "B", "tags": ["润滑运转"] },
    "Distraction": { "tier": "A", "tags": ["过渡防御"] },
    "DodgeAndRoll": { "tier": "A", "tags": ["过渡防御"] },
    "Dominate": { "tier": "A", "tags": ["润滑运转"] },
    "DoubleEnergy": { "tier": "S", "tags": ["润滑运转"] },
    "Doubt": { "tier": "F", "tags": [] },
    "DrainPower": { "tier": "B", "tags": ["润滑运转"] },
    "DramaticEntrance": { "tier": "B", "tags": ["过渡输出"] },
    "Dredge": { "tier": "B", "tags": ["润滑运转"] },
    "DrumOfBattle": { "tier": "S", "tags": ["润滑运转"] },
    "Dualcast": { "tier": "A", "tags": ["过渡输出"] },
    "DualWield": { "tier": "A", "tags": ["润滑运转"] },
    "DyingStar": { "tier": "A", "tags": ["过渡防御"] },
    "EchoForm": { "tier": "S", "tags": ["终端输出", "终端防御"] },
    "EchoingSlash": { "tier": "A", "tags": ["终端输出"] },
    "Eidolon": { "tier": "B", "tags": ["终端输出"] },
    "EndOfDays": { "tier": "S", "tags": ["终端输出"] },
    "EnergySurge": { "tier": "B", "tags": ["润滑运转"] },
    "EnfeeblingTouch": { "tier": "A", "tags": ["过渡防御"] },
    "Enlightenment": { "tier": "A", "tags": ["润滑运转"] },
    "Enthralled": { "tier": "F", "tags": [] },
    "Entrench": { "tier": "A", "tags": ["终端防御"] },
    "Entropy": { "tier": "B", "tags": ["终端输出"] },
    "Envenom": { "tier": "A", "tags": ["终端输出"] },
    "Equilibrium": { "tier": "B", "tags": ["润滑运转"] },
    "Eradicate": { "tier": "B", "tags": ["过渡输出"] },
    "EscapePlan": { "tier": "A", "tags": ["润滑运转"] },
    "EternalArmor": { "tier": "B", "tags": ["终端防御"] },
    "EvilEye": { "tier": "A", "tags": ["润滑运转"] },
    "ExpectAFight": { "tier": "B", "tags": ["过渡输出"] },
    "Expertise": { "tier": "B", "tags": ["过渡输出"] },
    "Expose": { "tier": "B", "tags": ["过渡输出"] },
    "Exterminate": { "tier": "A", "tags": ["过渡输出"] },
    "FallingStar": { "tier": "B", "tags": ["过渡输出"] },
    "FanOfKnives": { "tier": "A", "tags": ["过渡输出"] },
    "Fasten": { "tier": "A", "tags": ["终端防御"] },
    "Fear": { "tier": "B", "tags": ["过渡防御"] },
    "Feed": { "tier": "A", "tags": ["终端输出"] },
    "FeedingFrenzy": { "tier": "B", "tags": ["润滑运转"] },
    "FeelNoPain": { "tier": "S", "tags": ["终端防御", "润滑运转"] },
    "Feral": { "tier": "B", "tags": ["过渡输出"] },
    "Fetch": { "tier": "B", "tags": ["润滑运转"] },
    "FiendFire": { "tier": "B", "tags": ["过渡输出"] },
    "FightMe": { "tier": "B", "tags": ["过渡防御"] },
    "FightThrough": { "tier": "B", "tags": ["过渡防御"] },
    "Finesse": { "tier": "A", "tags": ["过渡防御", "润滑运转"] },
    "Finisher": { "tier": "B", "tags": ["终端输出"] },
    "Fisticuffs": { "tier": "B", "tags": ["过渡输出"] },
    "FlakCannon": { "tier": "B", "tags": ["过渡输出"] },
    "FlameBarrier": { "tier": "A", "tags": ["过渡防御"] },
    "Flanking": { "tier": "B", "tags": ["过渡输出"] },
    "FlashOfSteel": { "tier": "B", "tags": ["过渡输出"] },
    "Flatten": { "tier": "B", "tags": ["过渡输出"] },
    "Flechettes": { "tier": "B", "tags": ["过渡输出"] },
    "FlickFlack": { "tier": "B", "tags": ["过渡防御"] },
    "FocusedStrike": { "tier": "B", "tags": ["过渡输出"] },
    "FollowThrough": { "tier": "B", "tags": ["过渡输出"] },
    "Folly": { "tier": "F", "tags": [] },
    "Footwork": { "tier": "S", "tags": ["终端防御", "润滑运转"] },
    "ForbiddenGrimoire": { "tier": "S", "tags": ["润滑运转"] },
    "ForegoneConclusion": { "tier": "A", "tags": ["润滑运转"] },
    "ForgottenRitual": { "tier": "B", "tags": ["润滑运转"] },
    "FranticEscape": { "tier": "B", "tags": ["润滑运转"] },
    "Friendship": { "tier": "B", "tags": ["终端防御"] },
    "Ftl": { "tier": "B", "tags": ["润滑运转"] },
    "Fuel": { "tier": "B", "tags": ["润滑运转"] },
    "Furnace": { "tier": "B", "tags": ["润滑运转"] },
    "Fusion": { "tier": "B", "tags": ["终端输出"] },
    "GammaBlast": { "tier": "S", "tags": ["过渡输出", "过渡防御"] },
    "GangUp": { "tier": "B", "tags": ["过渡输出"] },
    "GatherLight": { "tier": "A", "tags": ["过渡防御"] },
    "Genesis": { "tier": "A", "tags": ["润滑运转"] },
    "GeneticAlgorithm": { "tier": "S", "tags": ["润滑运转"] },
    "GiantRock": { "tier": "B", "tags": ["过渡输出"] },
    "Glacier": { "tier": "S", "tags": ["过渡防御"] },
    "Glasswork": { "tier": "B", "tags": ["润滑运转"] },
    "Glimmer": { "tier": "A", "tags": ["润滑运转"] },
    "GlimpseBeyond": { "tier": "B", "tags": ["润滑运转"] },
    "Glitterstream": { "tier": "A", "tags": ["过渡防御"] },
    "Glow": { "tier": "A", "tags": ["润滑运转"] },
    "GoForTheEyes": { "tier": "B", "tags": ["过渡输出"] },
    "GoldAxe": { "tier": "B", "tags": ["过渡输出"] },
    "GrandFinale": { "tier": "A", "tags": ["终端输出"] },
    "Graveblast": { "tier": "B", "tags": ["过渡输出"] },
    "GraveWarden": { "tier": "S", "tags": ["过渡防御", "润滑运转"] },
    "Greed": { "tier": "B", "tags": ["润滑运转"] },
    "Guards": { "tier": "S", "tags": ["过渡防御", "润滑运转"] },
    "GuidingStar": { "tier": "A", "tags": ["过渡输出", "润滑运转"] },
    "Guilty": { "tier": "F", "tags": [] },
    "GunkUp": { "tier": "B", "tags": ["过渡输出"] },
    "Hailstorm": { "tier": "B", "tags": ["过渡输出"] },
    "HammerTime": { "tier": "B", "tags": ["过渡输出"] },
    "HandOfGreed": { "tier": "A", "tags": ["过渡输出"] },
    "HandTrick": { "tier": "B", "tags": ["润滑运转"] },
    "Hang": { "tier": "A", "tags": ["终端输出"] },
    "Haunt": { "tier": "B", "tags": ["终端输出"] },
    "Havoc": { "tier": "B", "tags": ["过渡输出"] },
    "Haze": { "tier": "B", "tags": ["过渡防御"] },
    "Headbutt": { "tier": "B", "tags": ["过渡输出"] },
    "HeavenlyDrill": { "tier": "A", "tags": ["终端输出"] },
    "Hegemony": { "tier": "B", "tags": ["终端输出"] },
    "HeirloomHammer": { "tier": "A", "tags": ["过渡输出"] },
    "HelixDrill": { "tier": "B", "tags": ["终端输出"] },
    "HelloWorld": { "tier": "A", "tags": ["润滑运转"] },
    "Hellraiser": { "tier": "B", "tags": ["终端输出"] },
    "Hemokinesis": { "tier": "A", "tags": ["润滑运转"] },
    "HiddenCache": { "tier": "A", "tags": ["润滑运转", "终端输出"] },
    "HiddenDaggers": { "tier": "A", "tags": ["润滑运转"] },
    "HiddenGem": { "tier": "B", "tags": ["润滑运转"] },
    "HighFive": { "tier": "B", "tags": ["过渡输出"] },
    "Hologram": { "tier": "S", "tags": ["润滑运转"] },
    "Hotfix": { "tier": "A", "tags": ["润滑运转"] },
    "HowlFromBeyond": { "tier": "B", "tags": ["过渡输出"] },
    "HuddleUp": { "tier": "B", "tags": ["过渡防御"] },
    "Hyperbeam": { "tier": "B", "tags": ["过渡输出"] },
    "IAmInvincible": { "tier": "A", "tags": ["过渡防御"] },
    "IceLance": { "tier": "A", "tags": ["过渡防御"] },
    "Ignition": { "tier": "B", "tags": ["过渡输出"] },
    "Impatience": { "tier": "B", "tags": ["润滑运转"] },
    "Impervious": { "tier": "A", "tags": ["过渡防御"] },
    "Infection": { "tier": "B", "tags": ["终端输出"] },
    "InfernalBlade": { "tier": "B", "tags": ["过渡输出"] },
    "Inferno": { "tier": "B", "tags": ["终端输出"] },
    "InfiniteBlades": { "tier": "A", "tags": ["终端输出"] },
    "Inflame": { "tier": "A", "tags": ["润滑运转"] },
    "Injury": { "tier": "F", "tags": [] },
    "Intercept": { "tier": "B", "tags": ["过渡防御"] },
    "Invoke": { "tier": "A", "tags": ["润滑运转"] },
    "IronWave": { "tier": "B", "tags": ["过渡输出"] },
    "Iteration": { "tier": "A", "tags": ["润滑运转"] },
    "JackOfAllTrades": { "tier": "A", "tags": ["润滑运转"] },
    "Jackpot": { "tier": "A", "tags": ["润滑运转"] },
    "Juggernaut": { "tier": "B", "tags": ["终端防御"] },
    "Juggling": { "tier": "B", "tags": ["过渡输出"] },
    "KinglyKick": { "tier": "B", "tags": ["过渡输出"] },
    "KinglyPunch": { "tier": "B", "tags": ["过渡输出"] },
    "KnifeTrap": { "tier": "C", "tags": ["过渡输出"] },
    "Knockdown": { "tier": "B", "tags": ["过渡输出"] },
    "KnockoutBlow": { "tier": "B", "tags": ["终端输出"] },
    "KnowThyPlace": { "tier": "A", "tags": ["过渡防御", "过渡输出"] },
    "LanternKey": { "tier": "B", "tags": ["润滑运转"] },
    "Largesse": { "tier": "A", "tags": ["润滑运转"] },
    "LeadingStrike": { "tier": "B", "tags": ["过渡输出"] },
    "Leap": { "tier": "B", "tags": ["过渡防御"] },
    "LegionOfBone": { "tier": "B", "tags": ["终端输出"] },
    "LegSweep": { "tier": "B", "tags": ["过渡输出"] },
    "Lethality": { "tier": "B", "tags": ["终端输出"] },
    "Lift": { "tier": "B", "tags": ["过渡输出"] },
    "LightningRod": { "tier": "A", "tags": ["润滑运转"] },
    "Loop": { "tier": "B", "tags": ["润滑运转"] },
    "Luminesce": { "tier": "B", "tags": ["终端输出"] },
    "LunarBlast": { "tier": "B", "tags": ["过渡输出"] },
    "MachineLearning": { "tier": "A", "tags": ["润滑运转"] },
    "MadScience": { "tier": "B", "tags": ["润滑运转"] },
    "MakeItSo": { "tier": "A", "tags": ["过渡输出"] },
    "Malaise": { "tier": "B", "tags": ["过渡防御"] },
    "Mangle": { "tier": "B", "tags": ["过渡输出"] },
    "ManifestAuthority": { "tier": "A", "tags": ["过渡防御"] },
    "MasterOfStrategy": { "tier": "A", "tags": ["润滑运转"] },
    "MasterPlanner": { "tier": "S", "tags": ["润滑运转"] },
    "Maul": { "tier": "S", "tags": ["终端输出"] },
    "Mayhem": { "tier": "B", "tags": ["过渡输出"] },
    "Melancholy": { "tier": "F", "tags": [] },
    "MementoMori": { "tier": "B", "tags": ["终端输出"] },
    "Metamorphosis": { "tier": "A", "tags": ["润滑运转"] },
    "MeteorShower": { "tier": "S", "tags": ["终端输出"] },
    "MeteorStrike": { "tier": "B", "tags": ["过渡输出"] },
    "Mimic": { "tier": "B", "tags": ["润滑运转"] },
    "MindBlast": { "tier": "B", "tags": ["过渡输出"] },
    "MindRot": { "tier": "B", "tags": ["过渡输出"] },
    "MinionDiveBomb": { "tier": "B", "tags": ["终端输出"] },
    "MinionSacrifice": { "tier": "C", "tags": ["润滑运转"] },
    "MinionStrike": { "tier": "B", "tags": ["终端输出"] },
    "Mirage": { "tier": "B", "tags": ["过渡输出"] },
    "Misery": { "tier": "F", "tags": [] },
    "Modded": { "tier": "B", "tags": ["润滑运转"] },
    "MoltenFist": { "tier": "B", "tags": ["过渡输出"] },
    "MomentumStrike": { "tier": "B", "tags": ["过渡输出"] },
    "MonarchsGaze": { "tier": "B", "tags": ["过渡防御"] },
    "Monologue": { "tier": "B", "tags": ["终端输出"] },
    "MultiCast": { "tier": "A", "tags": ["过渡输出"] },
    "Murder": { "tier": "B", "tags": ["过渡输出"] },
    "NecroMastery": { "tier": "A", "tags": ["终端输出"] },
    "NegativePulse": { "tier": "A", "tags": ["过渡输出"] },
    "NeowsFury": { "tier": "S", "tags": ["过渡输出", "润滑运转"] },
    "Neurosurge": { "tier": "A", "tags": ["润滑运转"] },
    "Neutralize": { "tier": "B", "tags": ["过渡防御"] },
    "NeutronAegis": { "tier": "B", "tags": ["终端防御"] },
    "Nightmare": { "tier": "B", "tags": ["过渡输出"] },
    "NoEscape": { "tier": "B", "tags": ["过渡防御"] },
    "Normality": { "tier": "F", "tags": [] },
    "Nostalgia": { "tier": "F", "tags": [] },
    "NotYet": { "tier": "B", "tags": ["润滑运转"] },
    "NoxiousFumes": { "tier": "A", "tags": ["终端输出"] },
    "Null": { "tier": "F", "tags": [] },
    "Oblivion": { "tier": "B", "tags": ["过渡输出"] },
    "Offering": { "tier": "S", "tags": ["润滑运转"] },
    "Omnislice": { "tier": "B", "tags": ["终端输出"] },
    "OneTwoPunch": { "tier": "B", "tags": ["过渡输出"] },
    "Orbit": { "tier": "S", "tags": ["终端输出", "润滑运转"] },
    "Outbreak": { "tier": "B", "tags": ["终端输出"] },
    "Outmaneuver": { "tier": "A", "tags": ["过渡输出"] },
    "Overclock": { "tier": "B", "tags": ["润滑运转"] },
    "PactsEnd": { "tier": "B", "tags": ["过渡输出"] },
    "Pagestorm": { "tier": "B", "tags": ["终端输出"] },
    "PaleBlueDot": { "tier": "A", "tags": ["润滑运转"] },
    "Panache": { "tier": "B", "tags": ["终端输出"] },
    "PanicButton": { "tier": "S", "tags": ["过渡防御"] },
    "Parry": { "tier": "B", "tags": ["终端防御"] },
    "Parse": { "tier": "B", "tags": ["润滑运转"] },
    "ParticleWall": { "tier": "A", "tags": ["过渡防御"] },
    "Patter": { "tier": "A", "tags": ["过渡防御"] },
    "Peck": { "tier": "B", "tags": ["过渡输出"] },
    "PerfectedStrike": { "tier": "A", "tags": ["过渡输出"] },
    "PhantomBlades": { "tier": "B", "tags": ["过渡输出"] },
    "PhotonCut": { "tier": "A", "tags": ["过渡输出", "润滑运转"] },
    "PiercingWail": { "tier": "S", "tags": ["过渡防御"] },
    "Pillage": { "tier": "A", "tags": ["润滑运转"] },
    "PillarOfCreation": { "tier": "S", "tags": ["终端防御"] },
    "Pinpoint": { "tier": "A", "tags": ["润滑运转"] },
    "PoisonedStab": { "tier": "A", "tags": ["过渡输出"] },
    "Poke": { "tier": "B", "tags": ["过渡输出"] },
    "PommelStrike": { "tier": "A", "tags": ["过渡输出", "润滑运转"] },
    "PoorSleep": { "tier": "F", "tags": [] },
    "Pounce": { "tier": "B", "tags": ["过渡输出"] },
    "PreciseCut": { "tier": "A", "tags": ["过渡输出"] },
    "Predator": { "tier": "B", "tags": ["过渡输出"] },
    "Prepared": { "tier": "S", "tags": ["过渡防御", "润滑运转"] },
    "PrepTime": { "tier": "A", "tags": ["过渡防御"] },
    "PrimalForce": { "tier": "B", "tags": ["终端输出"] },
    "Production": { "tier": "S", "tags": ["润滑运转"] },
    "Prolong": { "tier": "B", "tags": ["润滑运转"] },
    "Prophesize": { "tier": "B", "tags": ["润滑运转"] },
    "Protector": { "tier": "S", "tags": ["终端防御"] },
    "Prowess": { "tier": "B", "tags": ["过渡输出"] },
    "PullAggro": { "tier": "B", "tags": ["过渡防御"] },
    "PullFromBelow": { "tier": "B", "tags": ["终端输出"] },
    "Purity": { "tier": "A", "tags": ["润滑运转"] },
    "Putrefy": { "tier": "B", "tags": ["过渡输出"] },
    "Pyre": { "tier": "B", "tags": ["过渡输出"] },
    "Quadcast": { "tier": "S", "tags": ["终端输出"] },
    "Quasar": { "tier": "A", "tags": ["过渡输出"] },
    "Radiate": { "tier": "A", "tags": ["过渡输出"] },
    "Rage": { "tier": "A", "tags": ["润滑运转"] },
    "Rainbow": { "tier": "B", "tags": ["润滑运转"] },
    "Rally": { "tier": "B", "tags": ["过渡防御"] },
    "Rampage": { "tier": "B", "tags": ["过渡输出"] },
    "Rattle": { "tier": "B", "tags": ["过渡输出"] },
    "Reanimate": { "tier": "B", "tags": ["终端输出"] },
    "Reap": { "tier": "B", "tags": ["终端输出"] },
    "ReaperForm": { "tier": "B", "tags": ["终端输出"] },
    "Reave": { "tier": "B", "tags": ["过渡输出"] },
    "Reboot": { "tier": "A", "tags": ["润滑运转"] },
    "Rebound": { "tier": "B", "tags": ["润滑运转"] },
    "RefineBlade": { "tier": "A", "tags": ["过渡输出"] },
    "Reflect": { "tier": "S", "tags": ["过渡防御"] },
    "Reflex": { "tier": "A", "tags": ["润滑运转"] },
    "Refract": { "tier": "B", "tags": ["终端输出"] },
    "Regret": { "tier": "F", "tags": [] },
    "Relax": { "tier": "A", "tags": ["过渡防御"] },
    "Rend": { "tier": "B", "tags": ["过渡输出"] },
    "Resonance": { "tier": "B", "tags": ["润滑运转"] },
    "Restlessness": { "tier": "F", "tags": [] },
    "Ricochet": { "tier": "B", "tags": ["过渡输出"] },
    "RightHandHand": { "tier": "B", "tags": ["终端输出"] },
    "RipAndTear": { "tier": "B", "tags": ["过渡输出"] },
    "RocketPunch": { "tier": "A", "tags": ["过渡输出"] },
    "RollingBoulder": { "tier": "B", "tags": ["过渡输出"] },
    "RoyalGamble": { "tier": "A", "tags": ["润滑运转"] },
    "Royalties": { "tier": "A", "tags": ["润滑运转"] },
    "Rupture": { "tier": "A", "tags": ["润滑运转", "终端输出"] },
    "Sacrifice": { "tier": "B", "tags": ["润滑运转"] },
    "Salvo": { "tier": "A", "tags": ["过渡输出"] },
    "Scavenge": { "tier": "B", "tags": ["润滑运转"] },
    "Scourge": { "tier": "B", "tags": ["过渡输出"] },
    "Scrape": { "tier": "A", "tags": ["润滑运转"] },
    "Scrawl": { "tier": "S", "tags": ["润滑运转"] },
    "SculptingStrike": { "tier": "A", "tags": ["过渡防御"] },
    "Seance": { "tier": "S", "tags": ["润滑运转"] },
    "SecondWind": { "tier": "S", "tags": ["润滑运转"] },
    "SecretTechnique": { "tier": "A", "tags": ["润滑运转"] },
    "SecretWeapon": { "tier": "A", "tags": ["润滑运转"] },
    "SeekerStrike": { "tier": "B", "tags": ["过渡输出"] },
    "SeekingEdge": { "tier": "A", "tags": ["终端输出"] },
    "SentryMode": { "tier": "B", "tags": ["终端防御"] },
    "SerpentForm": { "tier": "S", "tags": ["终端输出", "润滑运转"] },
    "SetupStrike": { "tier": "B", "tags": ["过渡输出"] },
    "SevenStars": { "tier": "A", "tags": ["终端输出"] },
    "Severance": { "tier": "B", "tags": ["终端输出"] },
    "Shadowmeld": { "tier": "A", "tags": ["过渡防御"] },
    "ShadowShield": { "tier": "A", "tags": ["过渡防御"] },
    "ShadowStep": { "tier": "B", "tags": ["过渡输出"] },
    "Shame": { "tier": "F", "tags": [] },
    "SharedFate": { "tier": "B", "tags": ["终端防御"] },
    "Shatter": { "tier": "B", "tags": ["过渡输出"] },
    "ShiningStrike": { "tier": "A", "tags": ["过渡输出", "润滑运转"] },
    "Shiv": { "tier": "B", "tags": ["过渡输出"] },
    "Shockwave": { "tier": "B", "tags": ["过渡防御"] },
    "Shroud": { "tier": "B", "tags": ["终端防御"] },
    "ShrugItOff": { "tier": "S", "tags": ["过渡防御", "润滑运转"] },
    "SicEm": { "tier": "A", "tags": ["过渡输出"] },
    "SignalBoost": { "tier": "A", "tags": ["润滑运转"] },
    "Skewer": { "tier": "B", "tags": ["过渡输出"] },
    "Skim": { "tier": "A", "tags": ["润滑运转"] },
    "SleightOfFlesh": { "tier": "B", "tags": ["润滑运转"] },
    "Slice": { "tier": "B", "tags": ["过渡输出"] },
    "Slimed": { "tier": "F", "tags": [] },
    "Sloth": { "tier": "F", "tags": [] },
    "Smokestack": { "tier": "A", "tags": ["润滑运转"] },
    "Snakebite": { "tier": "B", "tags": ["过渡输出"] },
    "Snap": { "tier": "B", "tags": ["过渡输出"] },
    "Sneaky": { "tier": "B", "tags": ["过渡输出"] },
    "SolarStrike": { "tier": "B", "tags": ["过渡输出"] },
    "Soot": { "tier": "F", "tags": [] },
    "Soul": { "tier": "B", "tags": ["润滑运转"] },
    "SoulStorm": { "tier": "S", "tags": ["终端输出"] },
    "SovereignBlade": { "tier": "A", "tags": ["终端输出"] },
    "Sow": { "tier": "B", "tags": ["润滑运转"] },
    "SpectrumShift": { "tier": "A", "tags": ["润滑运转"] },
    "Speedster": { "tier": "A", "tags": ["润滑运转", "终端输出"] },
    "Spinner": { "tier": "B", "tags": ["润滑运转"] },
    "SpiritOfAsh": { "tier": "B", "tags": ["终端输出"] },
    "Spite": { "tier": "B", "tags": ["过渡输出"] },
    "Splash": { "tier": "B", "tags": ["过渡输出"] },
    "SpoilsMap": { "tier": "B", "tags": ["润滑运转"] },
    "SpoilsOfBattle": { "tier": "A", "tags": ["润滑运转"] },
    "SporeMind": { "tier": "B", "tags": ["终端输出"] },
    "Spur": { "tier": "B", "tags": ["终端输出"] },
    "Squash": { "tier": "A", "tags": ["过渡输出"] },
    "Squeeze": { "tier": "S", "tags": ["终端输出", "润滑运转"] },
    "Stack": { "tier": "A", "tags": ["润滑运转"] },
    "Stampede": { "tier": "B", "tags": ["过渡输出"] },
    "Stardust": { "tier": "A", "tags": ["终端输出"] },
    "Stoke": { "tier": "A", "tags": ["润滑运转"] },
    "Stomp": { "tier": "B", "tags": ["过渡输出"] },
    "StoneArmor": { "tier": "A", "tags": ["过渡防御"] },
    "Storm": { "tier": "B", "tags": ["终端输出"] },
    "StormOfSteel": { "tier": "B", "tags": ["过渡输出"] },
    "Strangle": { "tier": "B", "tags": ["过渡输出"] },
    "Stratagem": { "tier": "B", "tags": ["过渡输出"] },
    "StrikeDefect": { "tier": "F", "tags": [] },
    "StrikeIronclad": { "tier": "F", "tags": [] },
    "StrikeNecrobinder": { "tier": "F", "tags": [] },
    "StrikeRegent": { "tier": "F", "tags": [] },
    "StrikeSilent": { "tier": "F", "tags": [] },
    "Subroutine": { "tier": "B", "tags": ["过渡输出"] },
    "SuckerPunch": { "tier": "B", "tags": ["过渡输出"] },
    "SummonForth": { "tier": "A", "tags": ["润滑运转", "终端输出"] },
    "Sunder": { "tier": "B", "tags": ["过渡输出"] },
    "Supercritical": { "tier": "S", "tags": ["终端输出", "润滑运转"] },
    "Supermassive": { "tier": "A", "tags": ["终端输出"] },
    "Suppress": { "tier": "S", "tags": ["终端输出"] },
    "Survivor": { "tier": "B", "tags": ["过渡防御"] },
    "SweepingBeam": { "tier": "B", "tags": ["过渡输出"] },
    "SweepingGaze": { "tier": "B", "tags": ["过渡防御"] },
    "SwordBoomerang": { "tier": "B", "tags": ["过渡输出"] },
    "SwordSage": { "tier": "S", "tags": ["终端输出"] },
    "Synchronize": { "tier": "S", "tags": ["润滑运转"] },
    "Synthesis": { "tier": "B", "tags": ["润滑运转"] },
    "Tactician": { "tier": "A", "tags": ["润滑运转"] },
    "TagTeam": { "tier": "B", "tags": ["过渡输出"] },
    "Tank": { "tier": "B", "tags": ["过渡防御"] },
    "Taunt": { "tier": "A", "tags": ["过渡防御"] },
    "TearAsunder": { "tier": "B", "tags": ["过渡输出"] },
    "Tempest": { "tier": "B", "tags": ["终端输出"] },
    "Terraforming": { "tier": "A", "tags": ["终端输出"] },
    "TeslaCoil": { "tier": "B", "tags": ["终端输出"] },
    "TheBomb": { "tier": "B", "tags": ["过渡输出"] },
    "TheGambit": { "tier": "B", "tags": ["润滑运转"] },
    "TheHunt": { "tier": "B", "tags": ["过渡输出"] },
    "TheScythe": { "tier": "B", "tags": ["终端输出"] },
    "TheSealedThrone": { "tier": "S", "tags": ["润滑运转"] },
    "TheSmith": { "tier": "B", "tags": ["润滑运转"] },
    "ThinkingAhead": { "tier": "A", "tags": ["润滑运转"] },
    "Thrash": { "tier": "B", "tags": ["过渡输出"] },
    "ThrummingHatchet": { "tier": "B", "tags": ["过渡输出"] },
    "Thunder": { "tier": "B", "tags": ["过渡输出"] },
    "Thunderclap": { "tier": "B", "tags": ["过渡输出"] },
    "TimesUp": { "tier": "B", "tags": ["终端输出"] },
    "ToolsOfTheTrade": { "tier": "S", "tags": ["润滑运转"] },
    "ToricToughness": { "tier": "B", "tags": ["终端防御"] },
    "Toxic": { "tier": "B", "tags": ["终端输出"] },
    "Tracking": { "tier": "B", "tags": ["过渡输出"] },
    "Transfigure": { "tier": "A", "tags": ["润滑运转"] },
    "TrashToTreasure": { "tier": "A", "tags": ["润滑运转"] },
    "Tremble": { "tier": "B", "tags": ["过渡防御"] },
    "TrueGrit": { "tier": "A", "tags": ["过渡防御", "润滑运转"] },
    "Turbo": { "tier": "A", "tags": ["润滑运转"] },
    "TwinStrike": { "tier": "B", "tags": ["过渡输出"] },
    "Tyranny": { "tier": "A", "tags": ["润滑运转", "终端输出"] },
    "UltimateDefend": { "tier": "B", "tags": ["终端防御"] },
    "UltimateStrike": { "tier": "B", "tags": ["终端输出"] },
    "Undeath": { "tier": "B", "tags": ["终端防御"] },
    "Unleash": { "tier": "A", "tags": ["过渡输出"] },
    "Unmovable": { "tier": "A", "tags": ["终端防御"] },
    "Unrelenting": { "tier": "B", "tags": ["终端输出"] },
    "Untouchable": { "tier": "A", "tags": ["终端防御"] },
    "UpMySleeve": { "tier": "B", "tags": ["过渡输出"] },
    "Uppercut": { "tier": "A", "tags": ["过渡输出"] },
    "Uproar": { "tier": "B", "tags": ["过渡输出"] },
    "Veilpiercer": { "tier": "B", "tags": ["过渡输出"] },
    "Venerate": { "tier": "B", "tags": ["润滑运转"] },
    "Vicious": { "tier": "A", "tags": ["润滑运转"] },
    "Void": { "tier": "F", "tags": [] },
    "VoidForm": { "tier": "S", "tags": ["终端防御", "润滑运转"] },
    "Volley": { "tier": "B", "tags": ["过渡输出"] },
    "Voltaic": { "tier": "A", "tags": ["终端输出"] },
    "WasteAway": { "tier": "B", "tags": ["终端输出"] },
    "WellLaidPlans": { "tier": "S", "tags": ["过渡防御", "润滑运转"] },
    "Whirlwind": { "tier": "A", "tags": ["过渡输出"] },
    "Whistle": { "tier": "A", "tags": ["润滑运转"] },
    "WhiteNoise": { "tier": "B", "tags": ["润滑运转"] },
    "Wish": { "tier": "S", "tags": ["润滑运转"] },
    "Wisp": { "tier": "A", "tags": ["润滑运转"] },
    "Wound": { "tier": "F", "tags": [] },
    "WraithForm": { "tier": "S", "tags": ["终端防御"] },
    "Writhe": { "tier": "F", "tags": [] },
    "WroughtInWar": { "tier": "A", "tags": ["过渡输出"] },
    "Zap": { "tier": "B", "tags": ["过渡输出"] }
};

// 核心加载逻辑：优先加载玩家在本地自定义的字典（CRDT 时间戳优先），如果没有或者有新卡缺失，则用默认字典兜底！
let storedDict = {};
try {
    storedDict = JSON.parse(localStorage.getItem('SpireV2_Dictionary')) || {};
} catch(e) {}

// 执行一次静默浅层合并，确保哪怕是全新的浏览器，字典也永远不为空
let cardDictionary = { ...DEFAULT_CARD_DICTIONARY, ...storedDict };
let currentInspectingCardId = null;

function parseCardStats(card, isUpgraded) {
    let cost = card.Cost !== undefined ? card.Cost : (card.BaseCost !== undefined ? card.BaseCost : 0);
    let desc = card.Description || "";

    if (isUpgraded) {
        if (card.UpgradedCost !== undefined) cost = card.UpgradedCost;
        else if (card.UpgradeCostTo !== undefined) cost = card.UpgradeCostTo;
        else if (card.UpgradeCost !== undefined) cost = card.UpgradeCost;
        else if (card.CostUpgrade !== undefined) cost = card.CostUpgrade;
        else if (card.UpgradeCostBy !== undefined) cost += card.UpgradeCostBy;
        else if (card.UpgradeEnergyBy !== undefined) cost += card.UpgradeEnergyBy;

        if (card.UpgradedDescription) desc = card.UpgradedDescription;
        else if (card.UpgradeDescription) desc = card.UpgradeDescription;
    }
    return { cost, desc };
}

// ================= 动态卡牌鉴定面板 =================
function openInspector(cardId, cardNameZHS) {
    currentInspectingCardId = cardId;
    let cardObj = allCards[cardId];
    let cClass = (cardObj && cardObj.Class) ? cardObj.Class.toLowerCase() : "default";
    let theme = CLASS_COLORS[cClass] || CLASS_COLORS["default"];

    let box = document.getElementById('inspector-content-box');
    if (box) {
        box.style.borderColor = theme.hex;
        box.style.boxShadow = `0 0 40px rgba(${theme.rgb}, 0.4), 0 10px 20px rgba(0,0,0,0.1)`;
    }

    let titleEl = document.getElementById('inspector-card-name');
    if(titleEl) {
        titleEl.style.color = theme.hex;
        // 核心修改：移除等宽字体，提升透明度，继承中文字体风格并保持加粗，形成和谐的主副标题
        titleEl.innerHTML = `${cardNameZHS} <span style="font-size: 0.75em; opacity: 0.85; margin-left: 8px; vertical-align: baseline;">${cardId}</span>`;
    }

    let cardData = cardDictionary[cardId] || { tier: "", tags: [] };

    const tierContainer = document.getElementById('tier-container');
    tierContainer.innerHTML = '';
    AVAILABLE_TIERS.forEach(t => {
        let btn = document.createElement('button');
        btn.className = `tier-btn tier-${t} ${cardData.tier === t ? 'active' : ''}`;
        btn.innerText = t;
        btn.onclick = (e) => {
            if (e.target.classList.contains('active')) {
                e.target.classList.remove('active');
            } else {
                document.querySelectorAll('.tier-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            }
        };
        tierContainer.appendChild(btn);
    });

    const tagContainer = document.getElementById('tag-container');
    tagContainer.innerHTML = '';
    AVAILABLE_TAGS.forEach(tag => {
        let btn = document.createElement('button');
        btn.className = `tag-btn ${cardData.tags.includes(tag) ? 'active' : ''}`;
        btn.innerText = tag;
        btn.onclick = (e) => {
            if (e.target.classList.contains('active')) {
                e.target.classList.remove('active');
            } else {
                if (document.querySelectorAll('.tag-btn.active').length >= 3) {
                    alert("一张卡牌最多只能拥有 3 个核心端口定位！");
                    return;
                }
                e.target.classList.add('active');
            }
        };
        tagContainer.appendChild(btn);
    });

    document.getElementById('inspector-modal').style.display = 'flex';
}

function closeInspector() {
    document.getElementById('inspector-modal').style.display = 'none';
}

function saveInspectorData() {
    let selectedTier = document.querySelector('.tier-btn.active')?.innerText || "";
    let selectedTags = Array.from(document.querySelectorAll('.tag-btn.active')).map(btn => btn.innerText);

    cardDictionary[currentInspectingCardId] = {
        tier: selectedTier,
        tags: selectedTags,
        lastModified: Date.now(),
        hasTags: (selectedTier !== "" || selectedTags.length > 0)
    };

    localStorage.setItem('SpireV2_Dictionary', JSON.stringify(cardDictionary));
    closeInspector();
    renderLibrary();
    filterCards();
    updateWorkshop();
}

// ================= 卡牌组件生成器 =================
function createCardButton(cardId, cardData, modeOrIsDeck = false, index = -1) {
    let mode = "library";
    if (modeOrIsDeck === true || modeOrIsDeck === "deck") mode = "deck";
    if (modeOrIsDeck === "draft") mode = "draft";

    let btn = document.createElement('div');
    let cType = cardData.Type ? cardData.Type.toLowerCase() : "unknown";
    let cClass = cardData.Class ? cardData.Class.toLowerCase() : "unknown";
    let isUpgraded = cardData.isUpgraded === true;

    let stats = parseCardStats(cardData, isUpgraded);
    let cCost = stats.cost !== "Unplayable" && stats.cost !== -1 ? stats.cost : "X";

    let cName = cardData.Name_ZHS || cardId;
    if (isUpgraded) cName += "+";

    btn.className = `card-btn ${cType} ${cClass}`;
    if (mode === "library") btn.classList.add('lib-card');

    if ((mode === "deck" || mode === "draft") && isUpgraded) {
        btn.style.boxShadow = "0 0 5px #7acc00";
        btn.style.color = "#7acc00";
        btn.style.borderColor = "#7acc00";
    }

    btn.dataset.id = cardId.toLowerCase();
    btn.dataset.name = cName.toLowerCase();
    btn.dataset.cardClass = cClass;
    btn.dataset.type = cType;
    btn.dataset.cost = cCost;

    let icon = classIcons[cClass] || "?";
    let savedInfo = cardDictionary[cardId];
    let tagHtml = "";

    if (mode === "library" && savedInfo && (savedInfo.tier || (savedInfo.tags && savedInfo.tags.length > 0))) {
        let tierLabel = savedInfo.tier && savedInfo.tier !== "-" && savedInfo.tier !== "" ? `<span class="mini-tag tier-${savedInfo.tier}">${savedInfo.tier}级</span>` : "";
        let tagsLabels = (savedInfo.tags || []).map(t => `<span class="mini-tag">${t}</span>`).join("");
        tagHtml = `<div class="card-tags-display">${tierLabel}${tagsLabels}</div>`;
    }

    btn.innerHTML = `<span class="class-icon">[${icon}]</span> ${cName} [${cCost}] ${tagHtml}`;
    btn.draggable = true;

    btn.ondragstart = (e) => {
        if (currentAppMode === 'live') {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('cardId', cardId);
        e.dataTransfer.setData('isUpgraded', isUpgraded);
    };

    if (mode === "library") {
        btn.onclick = () => {
            let newCard = JSON.parse(JSON.stringify(cardData));
            newCard.id = cardId;
            newCard.isUpgraded = false;
            newCard.selected = false;
            myDrafts.push(newCard);
            updateDrafts();
        };
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            openInspector(cardId, cName);
        };
    } else {
        let targetArray = mode === "deck" ? myDeck : myDrafts;
        let updateFn = () => {
            if (mode === "deck") { updateWorkshop(); } else { updateDrafts(); }
        };

        btn.onclick = () => {
            let realIndex = targetArray.indexOf(cardData);
            if(realIndex > -1) { targetArray.splice(realIndex, 1); updateFn(); }
        };

        btn.oncontextmenu = (e) => {
            e.preventDefault();
            cardData.isUpgraded = !cardData.isUpgraded;
            updateFn();
        };
    }
    return btn;
}

window.dropToDeck = function(e) {
    if (currentAppMode === 'live') return;
    e.preventDefault();
    let cardId = e.dataTransfer.getData('cardId');
    let isUpg = e.dataTransfer.getData('isUpgraded') === 'true';
    if (cardId && allCards[cardId]) {
        myDeck.push({ ...allCards[cardId], id: cardId, isUpgraded: isUpg });
        updateWorkshop();
    }
};

// ================= 主卡组运转引擎 =================
function updateWorkshop() {
    const deckDiv = document.getElementById('my-deck');
    const deckCountSpan = document.getElementById('deck-count');

    let renderList = [];
    myDeck.forEach(c => renderList.push({ ref: c, _isVirtual: false }));

    let virtualCardCount = 0;
    myDrafts.forEach(draftItem => {
        if (draftItem.selected && currentAppMode === 'live') {
            renderList.push({ ref: draftItem, _isVirtual: true });
            virtualCardCount++;
        }
    });

    if (deckCountSpan) {
        deckCountSpan.innerText = myDeck.length + (virtualCardCount > 0 ? ` (+${virtualCardCount} 构想)` : "");
    }

    deckDiv.innerHTML = '';

    if (renderList.length === 0) {
        deckDiv.innerHTML = '<p style="color: #666; font-size: 0.9rem; text-align: center; margin-top: 20px;">左键单击图纸加入推演台<br>拖拽图纸进入此区域以直接加入<br><br><b>实战模式下拖拽已锁定</b></p>';
        updateDashboard([], 0, 0, 0);
        return;
    }

    let sortType = document.getElementById('deck-sort-select')?.value || "acquire";

    if (sortType === "cost") {
        renderList.sort((a, b) => {
            let cA = parseCardStats(a.ref, a.ref.isUpgraded).cost;
            let cB = parseCardStats(b.ref, b.ref.isUpgraded).cost;
            if (cA !== cB) return cA - cB;
            return (a.ref.Name_ZHS || a.ref.id).localeCompare(b.ref.Name_ZHS || b.ref.id);
        });
    } else if (sortType === "type") {
        const typeOrder = { "attack": 1, "skill": 2, "power": 3, "status": 4, "curse": 5 };
        renderList.sort((a, b) => {
            let tA = typeOrder[(a.ref.Type || "").toLowerCase()] || 99;
            let tB = typeOrder[(b.ref.Type || "").toLowerCase()] || 99;
            if (tA !== tB) return tA - tB;
            return (a.ref.Name_ZHS || a.ref.id).localeCompare(b.ref.Name_ZHS || b.ref.id);
        });
    }

    let totalEnergyCost = 0;
    let drawCount = 0;
    let exhaustCount = 0;
    let combinedVirtualDeck = [];

    renderList.forEach(item => {
        let card = item.ref;
        combinedVirtualDeck.push(card);

        let btn = createCardButton(card.id, card, "deck");

        if (item._isVirtual) {
            btn.style.border = "2px dashed #f39c12";
            btn.style.opacity = "0.9";
            let oldHtml = btn.innerHTML;
            btn.innerHTML = `<span style="color:#f39c12; font-weight:bold; font-size:0.7rem; padding: 1px 4px; border: 1px solid #f39c12; border-radius: 4px; margin-right:4px;">构想</span>` + oldHtml;

            btn.onclick = () => {
                card.selected = false;
                updateWorkshop();
            };
            btn.oncontextmenu = (e) => { e.preventDefault(); };
        }

        deckDiv.appendChild(btn);

        let stats = parseCardStats(card, card.isUpgraded);
        if (typeof stats.cost === 'number' && stats.cost >= 0) {
            totalEnergyCost += stats.cost;
        }
        let lowerDesc = stats.desc.toLowerCase();
        if (lowerDesc.includes("抽") || lowerDesc.includes("draw")) drawCount++;
        if (lowerDesc.includes("消耗") || lowerDesc.includes("exhaust")) exhaustCount++;
    });

    let deckSize = combinedVirtualDeck.length;
    let avgCost = deckSize > 0 ? (totalEnergyCost / deckSize) : 0;

    updateDashboard(combinedVirtualDeck, avgCost, drawCount, exhaustCount);
    updateDrafts();
}

// ================= 全息仪表盘与概率引擎 =================
function updateDashboard(deckToAnalyze, avgCost, drawCount, exhaustCount) {
    const baseEnergyInput = parseFloat(document.getElementById('energy-input')?.value || 3);
    const baseDrawInput = parseInt(document.getElementById('draw-input')?.value || 5);
    let deckSize = deckToAnalyze.length;

    let energyText = document.getElementById('energy-text');
    let energyFill = document.getElementById('energy-fill');

    if (energyText && energyFill) {
        let labelSpan = energyText.previousElementSibling;
        if (labelSpan) labelSpan.innerText = "出牌自由度 (能量支撑度)";

        if (avgCost === 0) {
            energyText.innerText = "0 均费 (极度轻盈)";
            energyFill.style.width = "100%";
            energyFill.style.background = "#27ae60";
        } else {
            let playableCards = baseEnergyInput / avgCost;
            energyText.innerText = `均费 ${avgCost.toFixed(2)} | 可出 ${playableCards.toFixed(1)} 张`;
            let pct = Math.min((playableCards / 3.5) * 100, 100);
            energyFill.style.width = pct + "%";
            if (playableCards >= 3.0) energyFill.style.background = "#27ae60";
            else if (playableCards >= 2.0) energyFill.style.background = "#f39c12";
            else energyFill.style.background = "#c0392b";
        }
    }

    let dPct = deckSize > 0 ? (drawCount / deckSize) * 100 : 0;
    let ePct = deckSize > 0 ? (exhaustCount / deckSize) * 100 : 0;
    let drawFill = document.getElementById('draw-fill');
    let exFill = document.getElementById('exhaust-fill');
    let engText = document.getElementById('engine-text');
    if (drawFill && exFill && engText) {
        drawFill.style.width = Math.min(dPct, 100) + '%';
        exFill.style.width = Math.min(ePct, 100) + '%';
        engText.innerText = `${dPct.toFixed(0)}% 过牌 | ${ePct.toFixed(0)}% 压缩`;
    }

    let tagCounts = { "过渡输出": 0, "过渡防御": 0, "终端输出": 0, "终端防御": 0, "润滑运转": 0 };
    let tagCardNames = { "过渡输出": [], "过渡防御": [], "终端输出": [], "终端防御": [], "润滑运转": [] };
    let cantripCounts = { "过渡输出": 0, "过渡防御": 0, "终端输出": 0, "终端防御": 0, "润滑运转": 0 };

    let fTierCount = 0;

    deckToAnalyze.forEach(card => {
        let info = cardDictionary[card.id];
        let dStats = (typeof parseCardStats === 'function') ? parseCardStats(card, card.isUpgraded) : { cost: 0 };
        let cost = (typeof dStats.cost === 'number' && dStats.cost >= 0) ? dStats.cost : 0;
        let isCantrip = (cost === 0 && info && info.tags && info.tags.includes("润滑运转"));

        let weight = 1.0;
        if (info && info.tier && typeof TIER_WEIGHTS !== 'undefined') {
            weight = TIER_WEIGHTS[info.tier] || 1.0;
        }

        if (info && info.tier === "F") fTierCount++;

        if (info && info.tags) {
            info.tags.forEach(t => {
                if (tagCounts[t] !== undefined) {
                    let actualWeight = (info.tier === 'F' && t !== "润滑运转") ? 0 : weight;

                    tagCounts[t] += actualWeight;
                    if (isCantrip) cantripCounts[t] += actualWeight;
                    let cName = card.Name_ZHS || card.id;

                    if (actualWeight > 0 && !tagCardNames[t].includes(cName)) {
                        tagCardNames[t].push(cName);
                    }
                }
            });
        }
    });

    let rawEngineScore = tagCounts["润滑运转"] || 0;
    let realThinningPower = drawCount + (exhaustCount * 0.5);
    let validEngineScore = Math.min(rawEngineScore, realThinningPower * 1.5);
    let engineBonus = Math.floor(validEngineScore * 0.3);

    let terminalCardCount = tagCounts["终端输出"] + tagCounts["终端防御"];
    let extraBaseDraw = baseDrawInput > 5 ? (baseDrawInput - 5) : 0;

    // [改动后的代码]：引入物理厚度宽容度
    let junkPenalty = Math.ceil(fTierCount * 0.5);
    let dynamicDrawTarget = Math.max(4, 4 + Math.ceil(terminalCardCount * 0.8) + junkPenalty - extraBaseDraw);

    // 核心修复：如果卡组绝对厚度不足 28 张，放宽冗余判定上限，允许并鼓励玩家抓取防烧牌或针对牌。
    let thicknessTolerance = deckSize < 28 ? Math.floor((28 - deckSize) / 1.5) : 0;

    const BASE_REQ = {
        "过渡输出": 5, "过渡防御": 8, "终端输出": 3, "终端防御": 4, "润滑运转": dynamicDrawTarget
    };

    const MAX_CAP = {
        "过渡输出": 5 + engineBonus + thicknessTolerance,
        "过渡防御": 8 + engineBonus + thicknessTolerance,
        "终端输出": 3 + Math.floor(engineBonus * 0.5) + thicknessTolerance,
        "终端防御": 4 + Math.floor(engineBonus * 0.5) + thicknessTolerance,
        "润滑运转": 99
    };

    const portContainer = document.getElementById('port-summary-container');
    if (portContainer) {
        portContainer.innerHTML = '';

        // [改动后的代码]：植入物理拦截器
        const PRIORITY_HIERARCHY = [
            { tag: "过渡输出", msg: "前期伤害匮乏！（强烈建议：优先抓取 AOE 群攻牌）" },
            { tag: "过渡防御", msg: "战损控制不足！（注意补充虚弱或群体降攻手段）" },
            { tag: "终端防御", msg: "急需大额护盾或无实体保命！" },
            { tag: "终端输出", msg: "缺乏后期制胜手段！（需补充多段伤害或核心爆发）" },
            { tag: "润滑运转", msg: "卡组笨重，废牌过多，极大概率卡手暴毙！" }
        ];

        let topPriorityHTML = "";

        if (deckSize > 0) {
            // 第一权重拦截：如果卡组薄于 25 张，无视所有质量评分，直接发出防烧警告！
            if (deckSize < 25) {
                topPriorityHTML = `<div style="background:#8e44ad; color:white; padding:10px 12px; border-radius:6px; margin-bottom:12px; box-shadow: 0 4px 10px rgba(142, 68, 173, 0.3);">
                    <div style="font-weight:bold; font-size:1.1rem; margin-bottom:4px;">[最高指令] 结构脆弱警告：物理厚度极低</div>
                    <div style="font-size:0.85rem; opacity:0.9;">当前仅 ${deckSize} 张牌。极易在门扉等消耗战中被彻底掏空断档，建议适度抓取防烧牌扩充底盘！</div>
                </div>`;
            } else {
                for (let i = 0; i < PRIORITY_HIERARCHY.length; i++) {
                    let p = PRIORITY_HIERARCHY[i];
                    let currentCount = tagCounts[p.tag] || 0;
                    let reqCount = BASE_REQ[p.tag] || 1;

                    if (currentCount < reqCount * 0.5) {
                        topPriorityHTML = `<div style="background:#c0392b; color:white; padding:10px 12px; border-radius:6px; margin-bottom:12px;">
                            <div style="font-weight:bold; font-size:1.1rem; margin-bottom:4px;">[最高指令] 断档警告：${p.tag}</div>
                            <div style="font-size:0.85rem; opacity:0.9;">${p.msg}</div>
                        </div>`;
                        break;
                    }
                }
            }

            if (!topPriorityHTML) {
                topPriorityHTML = `<div style="background:#27ae60; color:white; padding:10px 12px; border-radius:6px; margin-bottom:12px; box-shadow: 0 4px 6px rgba(39, 174, 96, 0.2);">
                    <div style="font-weight:bold; font-size:1.1rem; margin-bottom:4px;">[运转良好] 卡组结构健康</div>
                    <div style="font-size:0.85rem; opacity:0.9;">基础生存线均已达标。建议根据环境适量补充 AOE 或多段伤害以提升容错率。</div>
                </div>`;
            }

            portContainer.innerHTML += topPriorityHTML;
        }

        AVAILABLE_TAGS.forEach(tag => {
            let current = tagCounts[tag];
            let req = BASE_REQ[tag];
            let cap = MAX_CAP[tag];

            let pct = Math.min((current / req) * 100, 100);

            let cantripExemptCount = cantripCounts[tag] || 0;
            let toxicCurrent = current - cantripExemptCount;

            let statusColor, statusText;

            if (current < req * 0.5) {
                statusColor = "#e74c3c";
                statusText = "[高危断档]";
            } else if (current < req * 0.8) {
                statusColor = "#f39c12";
                statusText = "[运转迟缓]";
            } else if (toxicCurrent <= cap) {
                statusColor = "#27ae60";
                if (tag === "润滑运转" && current > req + 2) {
                    statusColor = "#8e44ad";
                    statusText = `[极致运转 +${(current - req).toFixed(1)}]`;
                } else {
                    statusText = "[完美成型]";
                }
            } else {
                let realToxic = toxicCurrent - cap;
                if (tag === "终端输出") {
                    statusColor = "#8e44ad";
                    statusText = `[火力压制 +${realToxic.toFixed(1)}]`;
                } else if (tag === "终端防御") {
                    statusColor = "#8e44ad";
                    statusText = `[绝对壁垒 +${realToxic.toFixed(1)}]`;
                } else {
                    statusColor = "#e67e22";
                    statusText = `[冗余卡手 +${realToxic.toFixed(1)}]`;
                }
            }

            let cardListStr = tagCardNames[tag].length > 0 ? tagCardNames[tag].join(", ") : "已清空废牌杂质";
            let displayTarget = tag === "润滑运转" ? req : `${req} ~ ${cap}`;

            let div = document.createElement('div');
            div.style.marginBottom = "10px";
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.85rem;">
                    <strong style="color:#333;">${tag} <span style="color:${statusColor}; font-weight:normal; font-size:0.75rem;">${statusText}</span></strong>
                    <span style="color:#666; font-weight:bold;">${current.toFixed(1)} / ${displayTarget}</span>
                </div>
                <div class="port-bar" style="background:#eef0eb; height:10px; border-radius:5px; overflow:hidden;">
                    <div class="port-fill" style="height:100%; width:${pct}%; background-color:${statusColor}; transition:width 0.3s;"></div>
                </div>
                <div style="color:#888; font-size:0.75rem; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">包含: ${cardListStr}</div>
            `;
            portContainer.appendChild(div);
        });
    }
}

// ================= 推演台引擎 =================
function updateDrafts() {
    try {
        let tbody = document.getElementById('draft-tbody');
        let tip = document.getElementById('draft-empty-tip');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (myDrafts.length === 0) {
            if(tip) tip.style.display = 'block';
            return;
        }
        if(tip) tip.style.display = 'none';

        let deckSize = myDeck.length;
        let deckTagsCount = { "过渡输出": 0, "过渡防御": 0, "终端输出": 0, "终端防御": 0, "润滑运转": 0 };
        let currentTotalEnergyCost = 0;
        let fTierCountDeck = 0;
        let drawCountDraft = 0;
        let exhaustCountDraft = 0;

        myDeck.forEach(card => {
            let info = cardDictionary[card.id];
            let weight = (info && info.tier && typeof TIER_WEIGHTS !== 'undefined') ? (TIER_WEIGHTS[info.tier] || 1.0) : 1.0;

            if (info && info.tier === "F") fTierCountDeck++;

            if (info && info.tags) {
                info.tags.forEach(t => {
                    if (deckTagsCount[t] !== undefined) {
                        let actualWeight = (info.tier === 'F' && t !== "润滑运转") ? 0 : weight;
                        deckTagsCount[t] += actualWeight;
                    }
                });
            }
            let stats = (typeof parseCardStats === 'function') ? parseCardStats(card, card.isUpgraded) : { cost: 0, desc: "" };
            if (typeof stats.cost === 'number' && stats.cost >= 0) {
                currentTotalEnergyCost += stats.cost;
            }
            let lowerDesc = (stats.desc || "").toLowerCase();
            if (lowerDesc.includes("抽") || lowerDesc.includes("draw")) drawCountDraft++;
            if (lowerDesc.includes("消耗") || lowerDesc.includes("exhaust")) exhaustCountDraft++;
        });

        let currentAvgCost = deckSize > 0 ? (currentTotalEnergyCost / deckSize) : 0;
        const baseEnergyInput = parseFloat(document.getElementById('energy-input')?.value || 3);
        let isEnergyAbundant = currentAvgCost > 0 ? ((baseEnergyInput / currentAvgCost) > 3.2) : true;

        let rawEngineScoreDraft = deckTagsCount["润滑运转"] || 0;
        let realThinningPowerDraft = drawCountDraft + (exhaustCountDraft * 0.5);
        let validEngineScoreDraft = Math.min(rawEngineScoreDraft, realThinningPowerDraft * 1.5);
        let engineBonusDraft = Math.floor(validEngineScoreDraft * 0.3);

        let terminalCountInDeck = (deckTagsCount["终端输出"] || 0) + (deckTagsCount["终端防御"] || 0);
        const baseDrawInputForDraft = parseInt(document.getElementById('draw-input')?.value || 5);
        let extraBaseDrawDraft = baseDrawInputForDraft > 5 ? (baseDrawInputForDraft - 5) : 0;

        let junkPenaltyDraft = Math.ceil(fTierCountDeck * 0.5);
        let dynamicDrawTargetRef = Math.max(4, 4 + Math.ceil(terminalCountInDeck * 0.8) + junkPenaltyDraft - extraBaseDrawDraft);

        const TARGET_REQ_REF = {
            "过渡输出": 5, "过渡防御": 8, "终端输出": 3, "终端防御": 4, "润滑运转": dynamicDrawTargetRef
        };

        const TARGET_CAP_REF = {
            "过渡输出": 5 + engineBonusDraft,
            "过渡防御": 8 + engineBonusDraft,
            "终端输出": 3 + Math.floor(engineBonusDraft * 0.5),
            "终端防御": 4 + Math.floor(engineBonusDraft * 0.5),
            "润滑运转": 99
        };

        myDrafts.forEach((draftCard, index) => {
            let tr = document.createElement('tr');
            tr.style.borderBottom = "1px dashed #e0e4d8";
            if (draftCard.selected) tr.style.backgroundColor = "rgba(39, 174, 96, 0.05)";

            let tdCard = document.createElement('td');
            tdCard.style.padding = "4px 2px";
            tdCard.appendChild(createCardButton(draftCard.id, draftCard, "draft", index));
            tr.appendChild(tdCard);

            let savedInfo = cardDictionary[draftCard.id] || { tier: "-", tags: [] };
            if (!savedInfo.tags) savedInfo.tags = [];

            let tdTags = document.createElement('td');
            tdTags.style.padding = "6px 4px";
            let tierColor = savedInfo.tier === "S" ? "#ff9f43" : (savedInfo.tier === "A" ? "#ee5253" : (savedInfo.tier === "F" ? "#7f8c8d" : "#2980b9"));
            let tierHtml = savedInfo.tier !== "-" && savedInfo.tier !== "" ? `<span style="color:${tierColor}; font-weight:bold;">[${savedInfo.tier}级]</span><br>` : "";
            let tagsHtml = savedInfo.tags.length > 0 ? savedInfo.tags.join(" | ") : "<span style='color:#999'>暂无标签</span>";
            tdTags.innerHTML = `${tierHtml}${tagsHtml}`;
            tr.appendChild(tdTags);

            let tdEval = document.createElement('td');
            tdEval.style.padding = "6px 4px";

            let dStats = (typeof parseCardStats === 'function') ? parseCardStats(draftCard, draftCard.isUpgraded) : { cost: 0 };
            let draftCardCost = (typeof dStats.cost === 'number' && dStats.cost >= 0) ? dStats.cost : 0;
            let isFreeCantrip = (draftCardCost === 0 && savedInfo.tags.includes("润滑运转"));

            if (savedInfo.tags.length === 0 && savedInfo.tier === "-") {
                tdEval.innerHTML = `<span style="color:#e74c3c;">未鉴定</span>`;
            } else if (savedInfo.tier === "F") {
                tdEval.innerHTML = `<span style="color:#7f8c8d; font-weight:bold;">严重污染</span><br><span style="font-size:0.8rem; color:#666;">纯净度杀手</span>`;
            } else {
                let score = 0;
                let matchReasons = [];
                let hasLifeSaver = false;

                savedInfo.tags.forEach(tag => {
                    let currentCount = deckTagsCount[tag] || 0;
                    let reqCount = TARGET_REQ_REF[tag] || 5;
                    let pctRatio = reqCount > 0 ? (currentCount / reqCount) : 1;
                    if (currentCount === 0 || pctRatio < 0.5) hasLifeSaver = true;
                });

                savedInfo.tags.forEach(tag => {
                    let currentCount = deckTagsCount[tag] || 0;
                    let reqCount = TARGET_REQ_REF[tag] || 5;
                    let capCount = TARGET_CAP_REF[tag] || 5;
                    let pctRatio = reqCount > 0 ? (currentCount / reqCount) : 1;

                    if (currentCount === 0) {
                        score += 80;
                        matchReasons.push(`[救命] 填补致命空缺(${tag})`);
                    } else if (currentCount >= capCount) {
                        if (isFreeCantrip) {
                            score += 5;
                            matchReasons.push(`[白嫖] 零费运转无视冗余(${tag})`);
                        } else if (hasLifeSaver) {
                            score -= 5;
                            matchReasons.push(`[附带] 溢出但可接受(${tag})`);
                        } else {
                            score -= 100;
                            matchReasons.push(`[毒药] 拒绝冗余卡手(${tag})`);
                        }
                    } else if (currentCount >= reqCount) {
                        score += 5;
                        matchReasons.push(`[容错] 引擎无损吸收(${tag})`);
                    } else if (pctRatio < 0.5) {
                        score += 50;
                        matchReasons.push(`[抢救] 挽救高危断档(${tag})`);
                    } else if (pctRatio < 0.8) {
                        score += 20;
                        matchReasons.push(`[润滑] 缓解运转迟缓(${tag})`);
                    } else {
                        score += 10;
                        matchReasons.push(`[微调] 趋近完美成型(${tag})`);
                    }
                });

                if (savedInfo.tier === "S") score += 40;
                if (savedInfo.tier === "A") score += 20;
                if (savedInfo.tier === "C") score -= 20;

                if (score >= 80) {
                    tdEval.innerHTML = `<span style="color:#27ae60; font-weight:bold;">[绝对核心]</span><br><span style="font-size:0.8rem; color:#666;">${matchReasons.join("<br>")}</span>`;
                } else if (score >= 40) {
                    tdEval.innerHTML = `<span style="color:#2980b9; font-weight:bold;">[优质补强]</span><br><span style="font-size:0.8rem; color:#666;">${matchReasons.join("<br>")}</span>`;
                } else if (score < 0) {
                    tdEval.innerHTML = `<span style="color:#c0392b; font-weight:bold; font-size:1.1rem;">[系统警告]</span><br><span style="font-size:0.8rem; color:#c0392b; font-weight:bold;">${matchReasons.join("<br>")}</span>`;
                } else {
                    tdEval.innerHTML = `<span style="color:#f39c12; font-weight:bold;">[收益平庸]</span><br><span style="font-size:0.8rem; color:#666;">非必要抓取</span>`;
                }
            }
            tr.appendChild(tdEval);

            let tdLoad = document.createElement('td');
            tdLoad.style.padding = "6px 4px";
            tdLoad.style.textAlign = "center";

            let newAvgCost = (deckSize + 1 > 0) ? ((currentTotalEnergyCost + draftCardCost) / (deckSize + 1)) : 0;
            let deltaCost = newAvgCost - currentAvgCost;

            if (deltaCost > 0.03) {
                if (isEnergyAbundant) {
                    if (draftCardCost >= 2) {
                        tdLoad.innerHTML = `<span style="color:#27ae60; font-weight:bold;">+${deltaCost.toFixed(2)}</span><br><span style="font-size:0.75rem; color:#27ae60;">[+] 深度吸收溢出</span>`;
                    } else {
                        tdLoad.innerHTML = `<span style="color:#27ae60; font-weight:bold;">+${deltaCost.toFixed(2)}</span><br><span style="font-size:0.75rem; color:#27ae60;">[+] 平滑吸收溢出</span>`;
                    }
                } else {
                    tdLoad.innerHTML = `<span style="color:#e74c3c; font-weight:bold;">+${deltaCost.toFixed(2)}</span><br><span style="font-size:0.75rem; color:#e74c3c;">[-] 增加卡手风险</span>`;
                }
            } else if (deltaCost < -0.03) {
                tdLoad.innerHTML = `<span style="color:#27ae60; font-weight:bold;">${deltaCost.toFixed(2)}</span><br><span style="font-size:0.75rem; color:#27ae60;">[+] 均费下降变流畅</span>`;
            } else {
                tdLoad.innerHTML = `<span style="color:#7f8c8d; font-weight:bold;">${deltaCost > 0 ? '+' : ''}${deltaCost.toFixed(2)}</span><br><span style="font-size:0.75rem; color:#999;">[=] 负载无变化</span>`;
            }
            tr.appendChild(tdLoad);

            let tdAction = document.createElement('td');
            tdAction.style.textAlign = "center";

            if (currentAppMode === 'sandbox') {
                if (draftCard.selected && draftCard._linkedCard && !myDeck.includes(draftCard._linkedCard)) {
                    draftCard.selected = false;
                    draftCard._linkedCard = null;
                }
            }

            let isChecked = draftCard.selected === true;
            let chkBtn = document.createElement('button');
            chkBtn.title = currentAppMode === 'live' ? "作为幻影加入推演" : "物理加入当前卡组";

            chkBtn.style.cssText = `
                border: 2px solid ${isChecked ? '#27ae60' : '#e0e4d8'}; 
                background: ${isChecked ? '#27ae60' : 'transparent'}; 
                color: ${isChecked ? 'white' : 'transparent'}; 
                border-radius: 6px; width: 28px; height: 28px; 
                cursor: pointer; display: flex; align-items: center; justify-content: center; 
                transition: all 0.2s ease; margin: 0 auto;
                box-shadow: ${isChecked ? '0 2px 6px rgba(39, 174, 96, 0.2)' : 'none'};
            `;

            chkBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

            chkBtn.onmouseover = () => {
                chkBtn.style.background = "#27ae60";
                chkBtn.style.color = "white";
                chkBtn.style.border = "2px solid #27ae60";
                chkBtn.style.boxShadow = "0 4px 10px rgba(39, 174, 96, 0.3)";
                chkBtn.style.transform = "translateY(-1px)";
            };

            chkBtn.onmouseout = () => {
                if (draftCard.selected) {
                    chkBtn.style.background = "#27ae60";
                    chkBtn.style.color = "white";
                    chkBtn.style.border = "2px solid #27ae60";
                    chkBtn.style.boxShadow = "0 2px 6px rgba(39, 174, 96, 0.2)";
                } else {
                    chkBtn.style.background = "transparent";
                    chkBtn.style.color = "transparent";
                    chkBtn.style.border = "2px solid #e0e4d8";
                    chkBtn.style.boxShadow = "none";
                }
                chkBtn.style.transform = "translateY(0)";
            };

            chkBtn.onclick = () => {
                draftCard.selected = !draftCard.selected;
                if (currentAppMode === 'live') {
                    updateWorkshop();
                } else {
                    if (draftCard.selected) {
                        let cardToGrab = JSON.parse(JSON.stringify(draftCard));
                        delete cardToGrab.selected;
                        draftCard._linkedCard = cardToGrab;
                        myDeck.push(cardToGrab);
                    } else {
                        if (draftCard._linkedCard) {
                            let idx = myDeck.indexOf(draftCard._linkedCard);
                            if (idx > -1) myDeck.splice(idx, 1);
                            draftCard._linkedCard = null;
                        }
                    }
                    updateWorkshop();
                }
            };

            tdAction.appendChild(chkBtn);
            tr.appendChild(tdAction);
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("推演台渲染发生阻断性错误:", error);
    }
}

// ================= 卡牌图纸库渲染与过滤 =================
function renderLibrary() {
    const listDiv = document.getElementById('card-list');
    listDiv.innerHTML = '';
    for (let cardName in allCards) {
        listDiv.appendChild(createCardButton(cardName, allCards[cardName]));
    }
}

function filterCards() {
    try {
        const searchInput = document.getElementById('search-input').value.toLowerCase().trim();
        const classFilter = document.getElementById('class-filter').value;
        const typeFilter = document.getElementById('type-filter').value;
        const costFilter = document.getElementById('cost-filter').value;

        // 新增：获取梯度和端口的筛选值
        const tierFilter = document.getElementById('tier-filter')?.value || 'all';
        const tagFilter = document.getElementById('tag-filter')?.value || 'all';

        const cardListContainer = document.getElementById('card-list');
        if (!cardListContainer) return;
        cardListContainer.innerHTML = '';

        let visibleCount = 0;

        Object.keys(allCards).forEach(cardId => {
            let card = allCards[cardId];
            let cardName = String(card.Name_ZHS || card.name || cardId);

            // 1. 文本匹配
            let textMatch = false;
            if (searchInput === "") {
                textMatch = true;
            } else {
                let isNameMatch = cardName.toLowerCase().includes(searchInput);
                let isPinyinMatch = false;
                try {
                    if (typeof pinyinPro !== 'undefined') {
                        let pyArray = pinyinPro.pinyin(cardName, { pattern: 'first', type: 'array' });
                        if (pyArray) {
                            let pyString = pyArray.join('').toLowerCase();
                            isPinyinMatch = pyString.includes(searchInput);
                        }
                    }
                } catch(e) {}
                textMatch = isNameMatch || isPinyinMatch;
            }

            // 2. 职业匹配
            let cardClass = String(card.Class || "").toLowerCase();
            let classMatch = false;
            if (classFilter === 'all') classMatch = true;
            else if (classFilter === 'colorless') {
                const mainClasses = ['ironclad', 'silent', 'regent', 'necrobinder', 'defect'];
                classMatch = !mainClasses.includes(cardClass);
            } else {
                classMatch = (cardClass === classFilter);
            }

            // 3. 类型匹配
            let cardType = card.Type || card.type || "";
            let typeMatch = (typeFilter === 'all') || (cardType === typeFilter);

            // 4. 费用匹配
            let costMatch = true;
            if (costFilter !== 'all') {
                let stats = parseCardStats(card, false);
                let costVal = stats.cost;
                if (costFilter === '3') costMatch = (typeof costVal === 'number' && costVal >= 3);
                else costMatch = (costVal === parseInt(costFilter));
            }

            // 5. 提取卡牌字典数据 (核心新增逻辑)
            let savedInfo = cardDictionary[cardId] || { tier: "", tags: [] };

            // 6. 梯度匹配
            let tierMatch = true;
            if (tierFilter !== 'all') {
                if (tierFilter === 'unrated') {
                    tierMatch = (!savedInfo.tier || savedInfo.tier === "-" || savedInfo.tier === "");
                } else {
                    tierMatch = (savedInfo.tier === tierFilter);
                }
            }

            // 7. 端口匹配
            let tagMatch = true;
            if (tagFilter !== 'all') {
                tagMatch = (savedInfo.tags && savedInfo.tags.includes(tagFilter));
            }

            // 终极聚合判定
            if (textMatch && classMatch && typeMatch && costMatch && tierMatch && tagMatch) {
                visibleCount++;
                let btn = createCardButton(cardId, card, "library");
                cardListContainer.appendChild(btn);
            }
        });

        let countBadge = document.getElementById('card-count');
        if (countBadge) countBadge.innerText = visibleCount;

    } catch (error) {
        console.error("筛选引擎发生阻断性错误:", error);
    }
}

// ================= 全局系统启动 =================
async function loadCards() {
    try {
        const response = await fetch('STS2_Card_Database_ZHS.json?v=' + new Date().getTime());
        allCards = await response.json();

        const lastJob = localStorage.getItem('SpireV2_LastJob');
        if (lastJob) {
            const jobSelect = document.getElementById('job-select');
            if (jobSelect) jobSelect.value = lastJob;
        }

        renderSaveSlots();
        renderLibrary();
        filterCards();
        loadDeckFromDisk(true);

    } catch (error) {
        console.error("加载失败:", error);
        document.getElementById('card-list').innerHTML = "图纸读取失败！";
    }
}

document.getElementById('save-slot')?.addEventListener('change', () => loadDeckFromDisk(false));

function clearDrafts() {
    if (myDrafts.length > 0) {
        myDrafts = [];
        updateDrafts();
        updateWorkshop();
    }
}

// ================= 数据字典持久化 =================
function exportDictionary() {
    const dict = localStorage.getItem('SpireV2_Dictionary');
    if (!dict || dict === '{}') { alert("当前字典为空，无需备份。"); return; }
    const blob = new Blob([dict], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NeowsBigForge_Backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importDictionary(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (typeof importedData !== 'object') throw new Error("无效的字典格式");

            if (confirm("导入将执行智能合并：保留最新鉴定，补充缺失数据。确定继续吗？")) {
                let mergedCount = 0;
                let skipCount = 0;

                Object.keys(importedData).forEach(key => {
                    let newCard = importedData[key];
                    let oldCard = cardDictionary[key];

                    if (!oldCard) {
                        cardDictionary[key] = newCard;
                        mergedCount++;
                        return;
                    }

                    let newHasTags = newCard.hasTags !== undefined ? newCard.hasTags : (newCard.tier !== "" || (newCard.tags && newCard.tags.length > 0));
                    let oldHasTags = oldCard.hasTags !== undefined ? oldCard.hasTags : (oldCard.tier !== "" || (oldCard.tags && oldCard.tags.length > 0));
                    let newTime = newCard.lastModified || 0;
                    let oldTime = oldCard.lastModified || 0;

                    if (!newHasTags && oldHasTags) {
                        skipCount++;
                    } else if (newHasTags && !oldHasTags) {
                        cardDictionary[key] = newCard;
                        mergedCount++;
                    } else {
                        if (newTime >= oldTime) {
                            cardDictionary[key] = newCard;
                            mergedCount++;
                        } else {
                            skipCount++;
                        }
                    }
                });

                localStorage.setItem('SpireV2_Dictionary', JSON.stringify(cardDictionary));
                renderLibrary();
                updateWorkshop();
                alert(`智能合并完成！\n新增或更新了 ${mergedCount} 条记录。\n保留了 ${skipCount} 条本地更新记录。`);
            }
        } catch (err) {
            alert("导入失败：请确保文件是正确的 JSON 备份。");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ================= 能量助手逻辑 =================
function toggleEnergyHelper() {
    const modal = document.getElementById('energy-helper-modal');
    modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
    if(modal.style.display === 'flex') updateHelperLogic();
}

function updateHelperLogic() {
    const base = parseFloat(document.getElementById('calc-base').value || 3);
    const constant = parseFloat(document.getElementById('calc-constant').value || 0);
    const burst = parseFloat(document.getElementById('calc-burst').value || 0);
    const periodN = parseInt(document.getElementById('calc-period-n').value || 3);
    const periodVal = parseFloat(document.getElementById('calc-period-val').value || 0);
    const breadMinus = parseFloat(document.getElementById('calc-bread-minus').value || 0);
    const breadPlus = parseFloat(document.getElementById('calc-bread-plus').value || 0);

    let turnEnergies = [];
    let totalEnergy = 0;

    for (let i = 1; i <= 7; i++) {
        let currentTurnEnergy = base + constant;
        if (i === 1) {
            currentTurnEnergy += burst;
            currentTurnEnergy -= breadMinus;
        } else {
            currentTurnEnergy += breadPlus;
        }
        if (periodVal > 0 && periodN > 0 && i % periodN === 0) {
            currentTurnEnergy += periodVal;
        }
        currentTurnEnergy = Math.max(0, currentTurnEnergy);
        turnEnergies.push(currentTurnEnergy);
        totalEnergy += currentTurnEnergy;
    }

    const result = totalEnergy / 7;
    document.getElementById('calc-result').innerText = `沙盘等效值: ${result.toFixed(2)}`;
    document.getElementById('calc-formula').innerText = `明细: (${turnEnergies.join(' + ')}) / 7`;
    window.lastCalcResult = result;
}

function resetHelper() {
    document.getElementById('calc-base').value = 3;
    document.getElementById('calc-constant').value = 0;
    document.getElementById('calc-burst').value = 0;
    document.getElementById('calc-period-n').value = 3;
    document.getElementById('calc-period-val').value = 0;
    document.getElementById('calc-bread-minus').value = 0;
    document.getElementById('calc-bread-plus').value = 0;
    updateHelperLogic();
}

function applyEnergyResult() {
    if(window.lastCalcResult) {
        document.getElementById('energy-input').value = window.lastCalcResult.toFixed(2);
        updateWorkshop();
        toggleEnergyHelper();
    }
}

// ================= 模式切换引擎 =================
function switchAppMode(mode) {
    if (currentAppMode === mode && document.readyState === 'complete') return;

    let tabSandbox = document.getElementById('tab-sandbox');
    let tabLive = document.getElementById('tab-live');
    let controlsSandbox = document.getElementById('sandbox-controls');
    let controlsLive = document.getElementById('live-controls');

    let eInput = document.getElementById('energy-input');
    let dInput = document.getElementById('draw-input');

    if (currentAppMode === 'sandbox') {
        sandboxMemoryDeck = [...myDeck];
        if (eInput) sandboxMemoryEnergy = eInput.value;
        if (dInput) sandboxMemoryDraw = dInput.value;
    } else {
        liveMemoryDeck = [...myDeck];
        if (eInput) liveMemoryEnergy = eInput.value;
        if (dInput) liveMemoryDraw = dInput.value;
    }

    currentAppMode = mode;
    localStorage.setItem('neows_app_mode', mode);

    if (mode === 'sandbox') {
        tabSandbox.style.background = "#34495e";
        tabSandbox.style.color = "white";
        tabSandbox.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
        tabLive.style.background = "transparent";
        tabLive.style.color = "#7f8c8d";
        tabLive.style.boxShadow = "none";
        controlsSandbox.style.display = "flex";
        controlsLive.style.display = "none";

        myDeck = [...sandboxMemoryDeck];
        if (eInput) eInput.value = sandboxMemoryEnergy;
        if (dInput) dInput.value = sandboxMemoryDraw;

        if (myDeck.length === 0) {
            if (typeof loadDeckFromDisk === 'function') loadDeckFromDisk(false);
        }
    } else {
        tabLive.style.background = "#8e44ad";
        tabLive.style.color = "white";
        tabLive.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
        tabSandbox.style.background = "transparent";
        tabSandbox.style.color = "#7f8c8d";
        tabSandbox.style.boxShadow = "none";
        controlsLive.style.display = "flex";
        controlsSandbox.style.display = "none";

        myDeck = [...liveMemoryDeck];
        if (eInput) eInput.value = liveMemoryEnergy;
        if (dInput) dInput.value = liveMemoryDraw;
    }

    updateWorkshop();
}

// ================= 杀戮尖塔2 解析与轮询引擎 =================
function parseGameSave(event) {
    const file = event.target.files[0];
    if (!file) return;

    let isSilent = event.isSilent === true;
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            let rawString = e.target.result.trim();
            let saveData = null;

            if (rawString.startsWith("{")) {
                saveData = JSON.parse(rawString);
            } else {
                try {
                    let decodedString = atob(rawString);
                    saveData = JSON.parse(decodedString);
                } catch (b64Error) {
                    throw new Error("Base64 解码失败");
                }
            }

            let rawCardsArray = null;
            let characterId = null;

            if (saveData.players && saveData.players.length > 0) {
                rawCardsArray = saveData.players[0].deck;
                characterId = saveData.players[0].character_id || saveData.players[0].character;
            } else if (saveData.master_deck || saveData.cards || saveData.deck) {
                rawCardsArray = saveData.master_deck || saveData.cards || saveData.deck;
            }

            if (!rawCardsArray || !Array.isArray(rawCardsArray)) {
                if (!isSilent) alert("解析失败：未能提取卡组数据。");
                return;
            }

            if (!isSilent) {
                if (!confirm(`成功读取！共 ${rawCardsArray.length} 张牌。\n是否覆盖？`)) {
                    event.target.value = '';
                    return;
                }
            }

            if (characterId) {
                let jobSelect = document.getElementById('job-select');
                if (jobSelect) {
                    if (characterId.includes("REGENT")) jobSelect.value = "regent";
                    else if (characterId.includes("IRONCLAD")) jobSelect.value = "ironclad";
                    else if (characterId.includes("SILENT")) jobSelect.value = "silent";
                    else if (characterId.includes("NECROBINDER")) jobSelect.value = "necrobinder";
                    else if (characterId.includes("DEFECT")) jobSelect.value = "defect";
                    if (typeof switchClassWorkspace === 'function') switchClassWorkspace();
                }
            }

            let importedDeck = [];
            let unmappedCards = [];

            rawCardsArray.forEach(cardItem => {
                let gameId = "";
                let isUpgraded = false;

                if (typeof cardItem === "string") {
                    let parts = cardItem.split("+");
                    gameId = parts[0];
                    isUpgraded = parts.length > 1 && parseInt(parts[1]) > 0;
                } else if (typeof cardItem === "object") {
                    gameId = cardItem.id;
                    isUpgraded = cardItem.current_upgrade_level && cardItem.current_upgrade_level > 0;
                }

                if (gameId) {
                    let noPrefixId = gameId.replace("CARD.", "");
                    let cleanGameId = noPrefixId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

                    let realKey = Object.keys(allCards).find(k => {
                        let cleanDictKey = k.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
                        return cleanDictKey === cleanGameId;
                    });

                    if (realKey) {
                        importedDeck.push({ ...allCards[realKey], id: realKey, isUpgraded: isUpgraded });
                    } else {
                        unmappedCards.push(gameId);
                    }
                }
            });

            myDeck = importedDeck;
            liveMemoryDeck = [...importedDeck];

            if (currentAppMode !== 'live') {
                switchAppMode('live');
            } else {
                updateWorkshop();
            }

            if (unmappedCards.length > 0) {
                console.warn("未映射卡牌清单：", unmappedCards);
                if (!isSilent) alert(`成功导入 ${importedDeck.length} 张。\n有 ${unmappedCards.length} 张未能识别已跳过。`);
            } else {
                if (!isSilent) alert("解析完美完成！");
            }

        } catch (error) {
            console.error("解析崩溃：", error);
            if (!isSilent) alert("读取失败：格式错误。");
        }
        if (event.target) event.target.value = '';
    };
    reader.readAsText(file);
}

// 1. 底层支持：IndexedDB 句柄存储引擎
function openHandleDB() {
    return new Promise((resolve, reject) => {
        let request = indexedDB.open('STS2_Dir_DB', 1);
        request.onupgradeneeded = e => {
            e.target.result.createObjectStore('handles');
        };
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
}

async function saveDirHandleToDB(handle) {
    try {
        let db = await openHandleDB();
        db.transaction('handles', 'readwrite').objectStore('handles').put(handle, 'savedSaveDir');
    } catch(e) { console.warn("句柄保存失败", e); }
}

async function loadDirHandleFromDB() {
    try {
        let db = await openHandleDB();
        return new Promise(resolve => {
            let req = db.transaction('handles').objectStore('handles').get('savedSaveDir');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    } catch(e) { return null; }
}

let globalDirHandle = null;
let saveFilesMap = new Map();
let autoSyncInterval = null;
let lastKnownModifiedTime = 0;
let isAutoSyncEnabled = false;
let useLocalAgent = false;

async function bindSaveDirectory() {
    try {
        if (!window.showDirectoryPicker) {
            alert("抱歉，您的浏览器不支持高级目录挂载功能。");
            return;
        }
        globalDirHandle = await window.showDirectoryPicker({ mode: 'read' });
        await saveDirHandleToDB(globalDirHandle);

        activateDirectoryUI();
        await refreshAndLoadHotSave();
    } catch (error) {
        console.warn("目录绑定被取消:", error);
    }
}

async function tryAutoMountDirectory() {
    const statusText = document.getElementById('dir-status-text');

    try {
        let response = await fetch("http://127.0.0.1:12026/ping");
        if (response.ok) {
            useLocalAgent = true;
            globalDirHandle = null;
            statusText.style.color = "#27ae60";
            statusText.innerText = "● 极速同步已就绪 (无需手动绑定文件夹)";

            activateDirectoryUI();
            startPolling();
            return;
        }
    } catch(e) {
        useLocalAgent = false;
    }

    let handle = await loadDirHandleFromDB();
    if (handle) {
        let perm = await handle.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
            globalDirHandle = handle;
            activateDirectoryUI();
            await refreshAndLoadHotSave();
        } else {
            statusText.innerHTML = `<button onclick="requestRememberedPermission()" style="padding:4px 8px; background:#3498db; color:white; border:none; border-radius:4px; cursor:pointer;">[一键恢复] 允许访问上次的手动目录</button>`;
        }
    }
}

async function requestRememberedPermission() {
    let handle = await loadDirHandleFromDB();
    if (handle) {
        let perm = await handle.requestPermission({ mode: 'read' });
        if (perm === 'granted') {
            globalDirHandle = handle;
            activateDirectoryUI();
            await refreshAndLoadHotSave();
        } else {
            document.getElementById('dir-status-text').innerText = "恢复权限被拒绝，请重新手动绑定。";
        }
    }
}

function activateDirectoryUI() {
    document.getElementById('bind-dir-btn').style.display = 'none';
    document.getElementById('auto-save-selector').style.display = 'block';

    let hotReloadBtn = document.getElementById('hot-reload-btn');
    if (hotReloadBtn) hotReloadBtn.style.display = useLocalAgent ? 'none' : 'block';

    // 核心修复：寻找新的呼吸灯，不再找旧的复选框
    let indicator = document.getElementById('live-indicator');
    if (indicator && useLocalAgent) indicator.style.display = 'flex';

    let rebindBtn = document.getElementById('rebind-dir-btn');
    if (rebindBtn) rebindBtn.style.display = 'inline-block';

    if (!useLocalAgent && globalDirHandle) {
        document.getElementById('dir-status-text').innerText = `已挂载: ${globalDirHandle.name} (已记忆)`;
    }
}

function parseMetadataFromText(text) {
    if (!text) return "[空文件]";
    let data;
    if (text.trim().startsWith("{")) {
        data = JSON.parse(text);
    } else {
        try { data = JSON.parse(atob(text.trim())); }
        catch (e) { return "[格式不支持]"; }
    }
    const charMap = {
        "CHARACTER.REGENT": "储君", "CHARACTER.IRONCLAD": "铁甲战士",
        "CHARACTER.SILENT": "静默猎手", "CHARACTER.DEFECT": "故障机器人",
        "CHARACTER.NECROBINDER": "亡灵契约师"
    };
    let charId = data.players?.[0]?.character_id || data.players?.[0]?.character || data.character_chosen || "未知";
    let charName = charMap[charId] || charId.replace("CHARACTER.", "");
    let asc = data.ascension_level !== undefined ? `进阶${data.ascension_level}` : (data.ascension !== undefined ? `进阶${data.ascension}` : "无进阶");
    let floor = data.floor_num || (data.map_point_history ? data.map_point_history.length : "0");
    let runStatus = "";
    if (data.win === true || data.victory === true) runStatus = " | [成功]";
    else if (data.win === false || data.victory === false || data.was_abandoned === true || data.killed_by || data.killed_by_encounter || data.killed_by_event) runStatus = " | [失败]";
    return `${charName} | ${asc} | 第${floor}层${runStatus}`;
}

async function peekSaveMetadata(fileHandle) {
    try {
        const file = await fileHandle.getFile();
        const text = await file.text();
        return parseMetadataFromText(text);
    } catch (e) {
        return "[解析失败]";
    }
}

async function refreshAndLoadHotSave() {
    saveFilesMap.clear();
    let selector = document.getElementById('auto-save-selector');
    let currentSelection = selector.value;
    selector.innerHTML = '';
    let parsedFiles = [];

    try {
        if (useLocalAgent) {
            // ---------- 极速模式：通过 API 拉取文件列表与历史记录 ----------
            let res = await fetch("http://127.0.0.1:12026/list");

            // 核心修复：如果游戏没开或者没有存档，优雅地提示并退出，不报错
            if (res.status === 404) {
                document.getElementById('dir-status-text').innerText = "[极速待命] 尚未侦测到任何进行中或历史对局...";
                return;
            }
            if (!res.ok) throw new Error("Agent API 失败");

            let data = await res.json();
            let files = data.saves || [];

            files.sort((a, b) => b.mtime - a.mtime);
            files = files.slice(0, 40);

            for (let f of files) {
                let sortWeight = 0;
                let displayName = "";
                let nameLower = f.name.toLowerCase();

                try {
                    let textRes = await fetch("http://127.0.0.1:12026/get?f=" + encodeURIComponent(f.name));
                    if (!textRes.ok) continue;
                    let text = await textRes.text();
                    let metadata = parseMetadataFromText(text);

                    if (nameLower === 'current_run.save') {
                        sortWeight = 99999999999;
                        displayName = `🟢 [进行中] ${metadata} (实时进度)`;
                        lastKnownModifiedTime = text.length;
                    } else if (nameLower === 'current_run.save.backup') {
                        sortWeight = 99999999998;
                        displayName = `[备用档] ${metadata} (防崩快照)`;
                    } else {
                        let timestampStr = nameLower.replace(/\D/g, '');
                        if (timestampStr) {
                            let isBackup = nameLower.endsWith('.backup');
                            sortWeight = parseInt(timestampStr) - (isBackup ? 1 : 0);
                            let dateObj = new Date(parseInt(timestampStr) * 1000);
                            let m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                            let d = dateObj.getDate().toString().padStart(2, '0');
                            let h = dateObj.getHours().toString().padStart(2, '0');
                            let min = dateObj.getMinutes().toString().padStart(2, '0');
                            let prefixTag = isBackup ? "[历史备份]" : "[已结算]";
                            displayName = `${prefixTag} ${m}-${d} ${h}:${min} ${metadata}`;
                        }
                    }
                    if (displayName) {
                        parsedFiles.push({ handle: f.name, weight: sortWeight, name: displayName });
                    }
                } catch(e){}
            }

        } else {
            if (!globalDirHandle) return;
            for await (const entry of globalDirHandle.values()) {
                if (entry.kind === 'file') {
                    const name = entry.name.toLowerCase();
                    if (name === 'current_run.save' || name === 'current_run.save.backup' || name.endsWith('.run') || name.endsWith('.backup')) {
                        let file = await entry.getFile();
                        parsedFiles.push({ handle: entry, weight: 0, name: "", _file: file });
                    }
                }
            }
            try {
                const historyDir = await globalDirHandle.getDirectoryHandle('history');
                for await (const entry of historyDir.values()) {
                    if (entry.kind === 'file') {
                        const name = entry.name.toLowerCase();
                        if (name.endsWith('.run') || name.endsWith('.backup')) {
                            let file = await entry.getFile();
                            parsedFiles.push({ handle: entry, weight: 0, name: "", _file: file });
                        }
                    }
                }
            } catch (e) {}

            for (let pf of parsedFiles) {
                let fileHandle = pf.handle;
                let fileObj = pf._file;
                let nameLower = fileHandle.name.toLowerCase();

                if (nameLower === 'current_run.save') {
                    pf.weight = 99999999999;
                    let metadata = await peekSaveMetadata(fileHandle);
                    pf.name = `🟢 [进行中] ${metadata} (实时进度)`;
                    lastKnownModifiedTime = fileObj.lastModified;
                } else if (nameLower === 'current_run.save.backup') {
                    pf.weight = 99999999998;
                    let metadata = await peekSaveMetadata(fileHandle);
                    pf.name = `[备用档] ${metadata} (防崩快照)`;
                } else {
                    let timestampStr = fileHandle.name.replace(/\D/g, '');
                    if (timestampStr) {
                        let isBackup = nameLower.endsWith('.backup');
                        pf.weight = parseInt(timestampStr) - (isBackup ? 1 : 0);
                        let metadata = await peekSaveMetadata(fileHandle);
                        let dateObj = new Date(parseInt(timestampStr) * 1000);
                        let m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                        let d = dateObj.getDate().toString().padStart(2, '0');
                        let h = dateObj.getHours().toString().padStart(2, '0');
                        let min = dateObj.getMinutes().toString().padStart(2, '0');
                        let prefixTag = isBackup ? "[历史备份]" : "[已结算]";
                        pf.name = `${prefixTag} ${m}-${d} ${h}:${min} ${metadata}`;
                    }
                }
            }
        }

        if (parsedFiles.length === 0) {
            document.getElementById('dir-status-text').innerText = "未扫描到 current_run 或 history 存档。";
            return;
        }

        parsedFiles.sort((a, b) => b.weight - a.weight);
        parsedFiles.forEach(pf => {
            let option = document.createElement('option');
            option.value = pf.handle.name || pf.handle;
            option.text = pf.name;
            selector.appendChild(option);
            saveFilesMap.set(option.value, pf.handle);
        });

        if (currentSelection && saveFilesMap.has(currentSelection)) {
            selector.value = currentSelection;
        } else {
            await loadSelectedHotSave();
        }
    } catch (error) {
        console.warn("扫描文件夹失败:", error);
        if (error.name === 'NotFoundError') {
            globalDirHandle = null;
            document.getElementById('dir-status-text').innerText = "旧版挂载的文件夹已失效，请重新挂载或部署极速后台。";
            document.getElementById('bind-dir-btn').style.display = 'inline-block';
            document.getElementById('auto-save-selector').style.display = 'none';
        }
    }
}

async function loadSelectedHotSave() {
    let selector = document.getElementById('auto-save-selector');
    let selectedName = selector.value;
    if (!selectedName) return;

    let handle = saveFilesMap.get(selectedName);
    if (!handle) return;

    try {
        if (useLocalAgent) {
            let res = await fetch("http://127.0.0.1:12026/get?f=" + encodeURIComponent(handle));
            let text = await res.text();
            let file = new File([text], selectedName, { type: "application/json" });
            let fakeEvent = { target: { files: [file], value: '' }, isSilent: true };
            parseGameSave(fakeEvent);
        } else {
            const file = await handle.getFile();
            let fakeEvent = { target: { files: [file], value: '' }, isSilent: true };
            parseGameSave(fakeEvent);
        }
    } catch (error) {
        console.error("读取流失败:", error);
    }
}

async function quickHotReload() {
    if (!saveFilesMap.has('current_run.save')) {
        await refreshAndLoadHotSave();
        return;
    }
    try {
        if (useLocalAgent) {
            let res = await fetch("http://127.0.0.1:12026/get?f=current_run.save");
            if (!res.ok) return;
            let saveText = await res.text();
            let fileObj = new File([saveText], "current_run.save", { type: "application/json" });
            let fakeEvent = { target: { files: [fileObj], value: '' }, isSilent: true };
            if (typeof parseGameSave === 'function') parseGameSave(fakeEvent);

            let metadata = parseMetadataFromText(saveText);
            let selector = document.getElementById('auto-save-selector');
            if (selector) {
                let option = Array.from(selector.options).find(opt => opt.value === 'current_run.save');
                if (option) option.text = `🟢 [进行中] ${metadata} (实时进度)`;
                selector.value = 'current_run.save';
            }

            lastKnownModifiedTime = saveText.length;
            let timeStr = new Date().toLocaleTimeString();
            document.getElementById('dir-status-text').innerText = `● [极速模式] 已在 ${timeStr} 自动同步。`;
        } else {
            let fileHandle = saveFilesMap.get('current_run.save');
            let fileObj = await fileHandle.getFile();
            let fakeEvent = { target: { files: [fileObj], value: '' }, isSilent: true };
            if (typeof parseGameSave === 'function') parseGameSave(fakeEvent);

            let metadata = await peekSaveMetadata(fileHandle);
            let selector = document.getElementById('auto-save-selector');
            if (selector) {
                let option = Array.from(selector.options).find(opt => opt.value === 'current_run.save');
                if (option) option.text = `🟢 [进行中] ${metadata} (实时进度)`;
                selector.value = 'current_run.save';
            }
            lastKnownModifiedTime = fileObj.lastModified;
            let timeStr = new Date().toLocaleTimeString();
            document.getElementById('dir-status-text').innerText = `● 已在 ${timeStr} 拉取最新卡组。`;
        }
    } catch (error) {
        console.error("拉取失败:", error);
    }
}

async function checkFileChanges() {
    try {
        if (useLocalAgent) {
            let response = await fetch("http://127.0.0.1:12026/get?f=current_run.save");
            if (response.status === 404 || !response.ok) return;

            let saveText = await response.text();
            if (saveText.length !== lastKnownModifiedTime) {
                await quickHotReload();
            }
            return;
        }

        if (!globalDirHandle) return;
        let fileHandle = saveFilesMap.get('current_run.save');
        if (!fileHandle) return;

        let fileObj = await fileHandle.getFile();
        if (fileObj.lastModified > lastKnownModifiedTime) {
            await quickHotReload();
        }
    } catch (e) {}
}

// ================= 位置：app.js 中下部 (替换轮询控制逻辑) =================

// 核心瘦身：彻底移除 toggleAutoSync，改为底层强制接管
function startPolling() {
    if (autoSyncInterval === null) {
        checkFileChanges();
        autoSyncInterval = setInterval(checkFileChanges, 2000);
        document.getElementById('dir-status-text').innerText = "● 极速同步已就绪 (切出网页将自动休眠省电)";
    }
}

function stopPolling() {
    if (autoSyncInterval !== null) {
        clearInterval(autoSyncInterval);
        autoSyncInterval = null;
        document.getElementById('dir-status-text').innerText = "○ 网页已挂起，轮询暂停。";
    }
}

// 智能切后台休眠：不浪费一滴 CPU 性能
document.addEventListener("visibilitychange", () => {
    // 只有在连了代理或者挂了文件夹的情况下，才需要管轮询
    if (!useLocalAgent && !globalDirHandle) return;

    if (document.hidden) {
        stopPolling();
    } else {
        startPolling();
    }
});

(function initializeAppMode() {
    let savedMode = localStorage.getItem('neows_app_mode') || 'live';
    currentAppMode = '';
    switchAppMode(savedMode);
})();

// 核心初始化：优先尝试连接极速脚本，失败则回退到沙盒记忆
window.addEventListener('DOMContentLoaded', async () => {
    try {
        let response = await fetch("http://127.0.0.1:12026/ping");
        if (response.ok) {
            // 1. 确立极速直连环境
            useLocalAgent = true;
            globalDirHandle = null;

            // 2. 渲染 UI (这会调用 activateDirectoryUI 自动隐藏无用按钮并显示呼吸灯)
            document.getElementById('dir-status-text').innerText = "● 极速同步已就绪 (切出网页将自动休眠省电)";
            document.getElementById('dir-status-text').style.color = "#27ae60";
            activateDirectoryUI();

            // 3. 强行拉取历史对局列表，填充下拉框
            await refreshAndLoadHotSave();

            // 4. 霸道总裁式直接启动：不问用户，直接开启 2 秒心跳轮询
            startPolling();
        } else {
            tryAutoMountDirectory();
        }
    } catch(e) {
        tryAutoMountDirectory();
    }
});

loadCards();

// ================= 一键极速部署引擎 =================
function downloadDeployScript() {
    let msg = "这将升级您的后台引擎 (deploy_agent.bat)。\n\n" +
        "核心升级：\n" +
        "1. 恢复了对历史对局(history)的完整读取\n" +
        "2. 完美修复了下拉框不显示的 Bug\n\n" +
        "是否确认下载？";
    if (!confirm(msg)) return;

    const pythonCode = `import http.server
import socketserver
import os
import glob
import json
import urllib.parse

PORT = 12026

def get_active_dir():
    # 1. 优先寻找进行中的对局锚点
    search_paths = [
        os.path.join(os.environ.get('APPDATA', ''), 'SlayTheSpire2', 'steam', '*', 'profile*', 'saves', 'current_run.save'),
        "C:/Program Files (x86)/Steam/steamapps/common/Slay the Spire 2/Saves/current_run.save",
        os.path.join(os.path.dirname(__file__), 'current_run.save')
    ]
    found = []
    for p in search_paths: found.extend(glob.glob(p))
    if found:
        found.sort(key=os.path.getmtime, reverse=True)
        return os.path.dirname(found[0])
        
    # 2. 核心修复：如果没在打游戏（当前存档被删），寻找最新的历史记录来反推目录！
    hist_paths = [
        os.path.join(os.environ.get('APPDATA', ''), 'SlayTheSpire2', 'steam', '*', 'profile*', 'saves', 'history', '*.run'),
        "C:/Program Files (x86)/Steam/steamapps/common/Slay the Spire 2/Saves/history/*.run"
    ]
    hist_found = []
    for p in hist_paths: hist_found.extend(glob.glob(p))
    if hist_found:
        hist_found.sort(key=os.path.getmtime, reverse=True)
        # 往上退两层：.../saves/history -> .../saves
        return os.path.dirname(os.path.dirname(hist_found[0]))
        
    return None

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args): pass
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()
        
    def do_OPTIONS(self):
        self.send_response(200, "ok"); self.end_headers()
        
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == '/ping':
            self.send_response(200); self.end_headers(); self.wfile.write(b"pong"); return

        base_dir = get_active_dir()
        if not base_dir:
            self.send_error(404, "No save directory found"); return

        if path == '/list':
            res = {'saves': []}
            def add_file(filepath, virt_name):
                if os.path.exists(filepath):
                    res['saves'].append({'name': virt_name, 'mtime': os.path.getmtime(filepath)})

            add_file(os.path.join(base_dir, 'current_run.save'), 'current_run.save')
            add_file(os.path.join(base_dir, 'current_run.save.backup'), 'current_run.save.backup')

            prof_dir = os.path.dirname(base_dir)
            hist_paths = [os.path.join(prof_dir, 'history'), os.path.join(base_dir, 'history')]
            hist_dir = None
            for hp in hist_paths:
                if os.path.exists(hp): hist_dir = hp; break

            if hist_dir:
                for f in os.listdir(hist_dir):
                    if f.endswith('.run') or f.endswith('.backup'):
                        add_file(os.path.join(hist_dir, f), 'history/' + f)

            self.send_response(200); self.send_header('Content-type', 'application/json'); self.end_headers()
            self.wfile.write(json.dumps(res).encode('utf-8'))
            return

        if path == '/get':
            file_rel = query.get('f', [''])[0]
            if not file_rel: self.send_error(400); return
            file_rel = file_rel.replace('../', '').replace('..\\\\', '')
            
            if file_rel.startswith('history/'):
                prof_dir = os.path.dirname(base_dir)
                target = os.path.join(prof_dir, 'history', file_rel.replace('history/', ''))
                if not os.path.exists(target):
                    target = os.path.join(base_dir, 'history', file_rel.replace('history/', ''))
            else:
                target = os.path.join(base_dir, file_rel)

            if os.path.exists(target):
                try:
                    with open(target, 'r', encoding='utf-8') as f: data = f.read()
                    self.send_response(200); self.send_header('Content-type', 'application/json'); self.end_headers()
                    self.wfile.write(data.encode('utf-8'))
                except Exception as e: self.send_error(500)
            else: self.send_error(404)
            return

        self.send_error(404)

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), CORSRequestHandler) as httpd:
        try: httpd.serve_forever()
        except Exception: pass`;

    const base64Python = btoa(unescape(encodeURIComponent(pythonCode)));

    let batContent = `@echo off
chcp 65001 >nul
title NeowsBigForge 极速引擎部署向导
color 0A

>nul 2>&1 "%SYSTEMROOT%\\system32\\cacls.exe" "%SYSTEMROOT%\\system32\\config\\system"
if '%errorlevel%' NEQ '0' (
    echo [INFO] 正在请求管理员权限...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\\getadmin.vbs"
    echo UAC.ShellExecute "cmd.exe", "/c ""%~s0""", "", "runas", 1 >> "%temp%\\getadmin.vbs"
    cscript //nologo "%temp%\\getadmin.vbs"
    del "%temp%\\getadmin.vbs"
    exit /B

:gotAdmin
set "TOOL_DIR=%APPDATA%\\NeowsBigForge"
if not exist "%TOOL_DIR%" mkdir "%TOOL_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$Bytes = [Convert]::FromBase64String('${base64Python}'); [IO.File]::WriteAllBytes('%TOOL_DIR%\\sts2_sync_agent.py', $Bytes)"

taskkill /F /IM pythonw.exe /T >nul 2>&1
schtasks /delete /tn "NeowsBigForge_Agent" /f >nul 2>&1
schtasks /create /tn "NeowsBigForge_Agent" /tr "pythonw.exe \\"%TOOL_DIR%\\sts2_sync_agent.py\\"" /sc onlogon /f >nul
start pythonw.exe "%TOOL_DIR%\\sts2_sync_agent.py"

echo 部署完美收官！请刷新沙盘网页。
pause
`;

    batContent = batContent.replace(/\r?\n/g, '\r\n');
    const blob = new Blob(["\uFEFF" + batContent], { type: 'application/bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deploy_agent.bat`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}