// ================= NeowsBigForge V2.0 定性构筑沙盘核心引擎 =================

let allCards = {};
let myDeck = [];
let myDrafts = [];

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

// ================= V2.0 方案管理系统 (命名空间隔离版) =================
let slotNames = JSON.parse(localStorage.getItem('SpireV2_SlotNames')) || {};

// 切换职业时：重新渲染槽位，并自动读取该职业的对应卡组
function switchClassWorkspace() {
    // 核心新增：每次切换职业时，立刻将当前职业代号写入本地硬盘记忆
    const currentJob = document.getElementById('job-select').value;
    localStorage.setItem('SpireV2_LastJob', currentJob);
    renderSaveSlots();
    loadDeckFromDisk(true);
}

// 渲染方案下拉框 (按职业绝对隔离)
function renderSaveSlots() {
    const select = document.getElementById('save-slot');
    if (!select) return;

    const currentJob = document.getElementById('job-select')?.value || 'regent';
    const previousSelection = select.value;

    select.innerHTML = '';

    // 生成该职业专属的 4 个槽位，例如 regent_slot1
    for (let i = 1; i <= 4; i++) {
        let slotId = `${currentJob}_slot${i}`;
        let defaultName = `方案 ${i}`;
        let displayName = slotNames[slotId] || defaultName;

        let opt = document.createElement('option');
        opt.value = slotId;
        opt.innerText = displayName;
        select.appendChild(opt);
    }

    // 智能保持选中状态：如果切回来，还是切走前的槽位；如果是刚切到新职业，默认选 slot1
    if (previousSelection && previousSelection.startsWith(currentJob)) {
        select.value = previousSelection;
    } else {
        select.value = `${currentJob}_slot1`;
    }
}

// 重命名当前方案
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

// 清空当前沙盘
function clearDeck() {
    if (myDeck.length > 0 && confirm("确定要清空当前卡组吗？\n(注意：这只是清空当前沙盘面板，点击[覆盖存档]才会保存此状态)")) {
        myDeck = [];
        updateWorkshop();
    }
}

// ================= V2.0 沙盘读写分离引擎 =================

// 从硬盘读取存档并覆盖沙盘
function loadDeckFromDisk(isInitialLoad = false) {
    let slot = document.getElementById('save-slot').value || 'save1';
    let savedData = localStorage.getItem(`sts2_v2_save_${slot}`);

    myDeck = [];

    // 【核心修复】：切档前，先强制将环境参数洗白为默认值，杜绝残影
    let energyInput = document.getElementById('energy-input');
    let drawInput = document.getElementById('draw-input');
    if (energyInput) energyInput.value = "3.0";
    if (drawInput) drawInput.value = "5";

    if (savedData) {
        try {
            let state = JSON.parse(savedData);

            // 智能嗅探：兼容一维数组旧存档
            let savedDeck = Array.isArray(state) ? state : (state.deck || []);

            // 匹配完整数据字典
            savedDeck.forEach(sc => {
                if (allCards[sc.id]) {
                    myDeck.push({ ...allCards[sc.id], id: sc.id, isUpgraded: sc.isUpgraded });
                }
            });

            // 如果存档中存在特殊环境参数，则覆盖刚才洗白的默认值
            if (!Array.isArray(state)) {
                if (state.energy !== undefined && energyInput) energyInput.value = state.energy;
                if (state.draw !== undefined && drawInput) drawInput.value = state.draw;
                if (state.job !== undefined) document.getElementById('job-select').value = state.job;
            }

        } catch (e) {
            console.error("读取存档失败", e);
        }
    } else {
        // 空存档，下发当前选择职业的初始牌
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

    // 视觉反馈
    if (!isInitialLoad) {
        let btn = document.querySelector('button[onclick^="loadDeckFromDisk"]');
        if(btn) {
            let originalText = btn.innerText;
            btn.innerText = "已重载";
            setTimeout(() => { btn.innerText = originalText; }, 1500);
        }
    }
}

// 将当前沙盘覆盖写入硬盘
function commitSaveToDisk() {
    let slot = document.getElementById('save-slot').value || 'save1';
    let energy = document.getElementById('energy-input').value;
    let draw = document.getElementById('draw-input').value;
    let job = document.getElementById('job-select').value;

    let stateToSave = {
        deck: myDeck,
        // 核心修复：必须使用 parseFloat，否则保存时会丢失遗物的小数均值
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

let cardDictionary = JSON.parse(localStorage.getItem('SpireV2_Dictionary')) || {};
let currentInspectingCardId = null;

// ================= 极简属性引擎 =================
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
        titleEl.innerText = cardNameZHS;
    }

    let cardData = cardDictionary[cardId] || { tier: "", tags: [] };

    const tierContainer = document.getElementById('tier-container');
    tierContainer.innerHTML = '';
    AVAILABLE_TIERS.forEach(t => {
        let btn = document.createElement('button');
        btn.className = `tier-btn tier-${t} ${cardData.tier === t ? 'active' : ''}`;
        btn.innerText = t;
        btn.onclick = (e) => {
            document.querySelectorAll('.tier-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
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
        tags: selectedTags
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

    // 只在左侧卡库渲染悬浮标签
    if (mode === "library" && savedInfo && (savedInfo.tier || savedInfo.tags.length > 0)) {
        let tierLabel = savedInfo.tier && savedInfo.tier !== "-" ? `<span class="mini-tag tier-${savedInfo.tier}">${savedInfo.tier}级</span>` : "";
        let tagsLabels = savedInfo.tags.map(t => `<span class="mini-tag">${t}</span>`).join("");
        tagHtml = `<div class="card-tags-display">${tierLabel}${tagsLabels}</div>`;
    }

    btn.innerHTML = `<span class="class-icon">[${icon}]</span> ${cName} [${cCost}] ${tagHtml}`;
    btn.draggable = true;
    btn.ondragstart = (e) => {
        e.dataTransfer.setData('cardId', cardId);
        e.dataTransfer.setData('isUpgraded', isUpgraded);
    };

    if (mode === "library") {
        btn.onclick = () => {
            let newCard = JSON.parse(JSON.stringify(cardData));
            newCard.id = cardId; newCard.isUpgraded = false;
            myDeck.push(newCard);
            updateWorkshop();
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

// ================= 主卡组运转引擎 =================
function updateWorkshop() {
    const deckDiv = document.getElementById('my-deck');
    const deckCountEl = document.getElementById('deck-count');
    if (deckCountEl) deckCountEl.innerText = myDeck.length;

    deckDiv.innerHTML = '';

    if (myDeck.length === 0) {
        deckDiv.innerHTML = '<p style="color: #666; font-size: 0.9rem; text-align: center; margin-top: 20px;">点击左侧卡牌加入卡组<br><br>加入后：<b>左键</b>移除，<b>右键</b>强化/降级</p>';
        updateDashboard(0, 0, 0, 0);
        return;
    }

    let sortType = document.getElementById('deck-sort-select')?.value || "acquire";
    let renderDeck = [...myDeck];

    if (sortType === "cost") {
        renderDeck.sort((a, b) => {
            let cA = parseCardStats(a, a.isUpgraded).cost;
            let cB = parseCardStats(b, b.isUpgraded).cost;
            if (cA !== cB) return cA - cB;
            return (a.Name_ZHS || a.id).localeCompare(b.Name_ZHS || b.id);
        });
    } else if (sortType === "type") {
        const typeOrder = { "attack": 1, "skill": 2, "power": 3, "status": 4, "curse": 5 };
        renderDeck.sort((a, b) => {
            let tA = typeOrder[(a.Type || "").toLowerCase()] || 99;
            let tB = typeOrder[(b.Type || "").toLowerCase()] || 99;
            if (tA !== tB) return tA - tB;
            return (a.Name_ZHS || a.id).localeCompare(b.Name_ZHS || b.id);
        });
    }

    let totalEnergyCost = 0;
    let drawCount = 0;
    let exhaustCount = 0;

    renderDeck.forEach(card => {
        deckDiv.appendChild(createCardButton(card.id, card, true));

        let stats = parseCardStats(card, card.isUpgraded);

        // 核心修正：不再排除基础牌。任何有明确费用的牌都必须计入总池。
        if (typeof stats.cost === 'number' && stats.cost >= 0) {
            totalEnergyCost += stats.cost;
        }

        let lowerDesc = stats.desc.toLowerCase();
        if (lowerDesc.includes("抽") || lowerDesc.includes("draw")) drawCount++;
        if (lowerDesc.includes("消耗") || lowerDesc.includes("exhaust")) exhaustCount++;
    });

    let deckSize = myDeck.length;
    // 真实的单卡期望耗费：总费用 / 卡组总厚度
    let avgCost = deckSize > 0 ? (totalEnergyCost / deckSize) : 0;

    updateDashboard(deckSize, avgCost, drawCount, exhaustCount);
    updateDrafts();
}

// ================= 全息仪表盘与概率引擎 (出牌自由度重构版) =================
function updateDashboard(deckSize, avgCost, drawCount, exhaustCount) {
    const baseEnergyInput = parseFloat(document.getElementById('energy-input')?.value || 3);
    const baseDrawInput = parseInt(document.getElementById('draw-input')?.value || 5);

    let energyText = document.getElementById('energy-text');
    let energyFill = document.getElementById('energy-fill');

    // 1. 出牌自由度引擎 (替代旧的能量负载)
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

            // 以每回合能支撑打出 3.5 张牌作为 100% 满分标准
            let pct = Math.min((playableCards / 3.5) * 100, 100);
            energyFill.style.width = pct + "%";

            if (playableCards >= 3.0) {
                energyFill.style.background = "#27ae60"; // 绿色：极其流畅
            } else if (playableCards >= 2.0) {
                energyFill.style.background = "#f39c12"; // 橙色：偏重
            } else {
                energyFill.style.background = "#c0392b"; // 红色：严重卡手
            }
        }
    }

    // 2. 润滑度 UI
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

    // 3. 统计当前标签
    let tagCounts = { "过渡输出": 0, "过渡防御": 0, "终端输出": 0, "终端防御": 0, "润滑运转": 0 };
    let tagCardNames = { "过渡输出": [], "过渡防御": [], "终端输出": [], "终端防御": [], "润滑运转": [] };

    myDeck.forEach(card => {
        let info = cardDictionary[card.id];
        if (info && info.tags) {
            info.tags.forEach(t => {
                if (tagCounts[t] !== undefined) {
                    tagCounts[t]++;
                    let cName = card.Name_ZHS || card.id;
                    if (!tagCardNames[t].includes(cName)) tagCardNames[t].push(cName);
                }
            });
        }
    });

    // --- 改动后的新代码开始 (引入基础抽牌抵扣机制) ---
    let terminalCardCount = tagCounts["终端输出"] + tagCounts["终端防御"];
    // 计算先天抽牌优势 (超出基础 5 张的部分)
    let extraBaseDraw = baseDrawInput > 5 ? (baseDrawInput - 5) : 0;

    // 动态目标 = 基础(4) + 惩罚(1.5*终端) - 先天优势
    // 用 Math.max(0, ...) 确保目标需求不会变成负数
    let dynamicDrawTarget = Math.max(0, 4 + Math.ceil(terminalCardCount * 1.5) - extraBaseDraw);
    // --- 改动后的新代码结束 ---

    const TARGET_SLOTS = {
        "过渡输出": 5,
        "过渡防御": 8,
        "终端输出": 3,
        "终端防御": 4,
        "润滑运转": dynamicDrawTarget
    };

    const portContainer = document.getElementById('port-summary-container');
    if (portContainer) {
        portContainer.innerHTML = '';

        // 5. 马斯洛需求法则：最高指令系统
        const PRIORITY_HIERARCHY = [
            { tag: "过渡输出", msg: "你的前期伤害极度匮乏，极易在第一层暴毙！立刻寻找优质攻击牌，停止抓取能力牌和过牌！" },
            { tag: "过渡防御", msg: "战损控制能力严重不足！遇到连续高攻怪会快速死亡，急需补充基础护盾或虚弱牌！" },
            { tag: "终端防御", msg: "面对后期高额伤害毫无抵抗力！必须立刻寻找群体虚弱、无实体或大额护盾！" },
            { tag: "终端输出", msg: "缺乏破局的制胜手段！打不死后期血牛怪物，需要寻找高爆发核心或无限流组件！" },
            { tag: "润滑运转", msg: "卡组极其笨重，极大概率开局卡手暴毙！立刻寻找优质过牌或消耗牌，坚决停止抓取任何高费牌！" }
        ];

        let topPriorityHTML = "";
        let currentDeckSize = myDeck.length;

        if (currentDeckSize > 0) {
            for (let i = 0; i < PRIORITY_HIERARCHY.length; i++) {
                let p = PRIORITY_HIERARCHY[i];
                let currentCount = tagCounts[p.tag] || 0;
                let targetCount = TARGET_SLOTS[p.tag] || 1;
                let pctRatio = currentCount / targetCount;

                if (currentCount === 0) {
                    topPriorityHTML = `<div style="background:#c0392b; color:white; padding:10px 12px; border-radius:6px; margin-bottom:12px; box-shadow: 0 4px 6px rgba(192, 57, 43, 0.2);">
                        <div style="font-weight:bold; font-size:1.1rem; margin-bottom:4px;">[最高指令] 极度缺乏：${p.tag}</div>
                        <div style="font-size:0.85rem; opacity:0.9;">${p.msg}</div>
                    </div>`;
                    break;
                } else if (pctRatio < 0.5) {
                    topPriorityHTML = `<div style="background:#e67e22; color:white; padding:10px 12px; border-radius:6px; margin-bottom:12px; box-shadow: 0 4px 6px rgba(230, 126, 34, 0.2);">
                        <div style="font-weight:bold; font-size:1.1rem; margin-bottom:4px;">[紧急警告] 急需补强：${p.tag}</div>
                        <div style="font-size:0.85rem; opacity:0.9;">${p.msg}</div>
                    </div>`;
                    break;
                }
            }

            if (!topPriorityHTML) {
                topPriorityHTML = `<div style="background:#27ae60; color:white; padding:10px 12px; border-radius:6px; margin-bottom:12px; box-shadow: 0 4px 6px rgba(39, 174, 96, 0.2);">
                    <div style="font-weight:bold; font-size:1.1rem; margin-bottom:4px;">[运转良好] 卡组结构健康</div>
                    <div style="font-size:0.85rem; opacity:0.9;">各端口均无致命短板，可根据特定遗物和Boss进行针对性微调。</div>
                </div>`;
            }

            portContainer.innerHTML += topPriorityHTML;
        }

        // 6. 渲染雷达条 (硬核预警标准)
        AVAILABLE_TAGS.forEach(tag => {
            let current = tagCounts[tag];
            let target = TARGET_SLOTS[tag];
            let pct = Math.min((current / target) * 100, 100);

            let pctRatio = current / target;
            let isOverflow = current > target;
            let statusColor, statusText;

            if (current === 0) {
                statusColor = "#e74c3c";
                statusText = "[致命空缺]";
            } else if (isOverflow) {
                statusColor = "#e67e22";
                statusText = `[冗余卡手 +${current - target}]`;
            } else if (pctRatio < 0.5) {
                statusColor = "#c0392b";
                statusText = "[高危断档]";
            } else if (pctRatio < 0.8) {
                statusColor = "#f39c12";
                statusText = "[运转迟缓]";
            } else if (current === target) {
                statusColor = "#27ae60";
                statusText = "[完美成型]";
            } else {
                statusColor = "#3498db";
                statusText = "[平滑积累]";
            }

            let cardListStr = tagCardNames[tag].length > 0 ? tagCardNames[tag].join(", ") : "无";

            let div = document.createElement('div');
            div.style.marginBottom = "10px";
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.85rem;">
                    <strong style="color:#333;">${tag} <span style="color:${statusColor}; font-weight:normal; font-size:0.75rem;">${statusText}</span></strong>
                    <span style="color:#666; font-weight:bold;">${current} / ${target}</span>
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

// ================= 标签协同推演台 (全量防弹版) =================
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

        // 1. 统计当前卡组状态
        myDeck.forEach(card => {
            let info = cardDictionary[card.id];
            if (info && info.tags) {
                info.tags.forEach(t => {
                    if (deckTagsCount[t] !== undefined) deckTagsCount[t]++;
                });
            }
            let stats = (typeof parseCardStats === 'function') ? parseCardStats(card, card.isUpgraded) : { cost: 0 };
            if (typeof stats.cost === 'number' && stats.cost >= 0) {
                currentTotalEnergyCost += stats.cost;
            }
        });

        // 2. 准备全局运算参数（基于出牌自由度的能量判定）
        let currentAvgCost = deckSize > 0 ? (currentTotalEnergyCost / deckSize) : 0;
        const baseEnergyInput = parseFloat(document.getElementById('energy-input')?.value || 3);

        // 判定标准：能量 / 均费 >= 2.8 即视为能量充裕
        let isEnergyAbundant = currentAvgCost > 0 ? ((baseEnergyInput / currentAvgCost) >= 2.8) : true;

        // 3. 准备启动负重惩罚动态目标
        // --- 改动后的新代码开始 (同步引入抽牌抵扣) ---
        let terminalCountInDeck = (deckTagsCount["终端输出"] || 0) + (deckTagsCount["终端防御"] || 0);
        const baseDrawInputForDraft = parseInt(document.getElementById('draw-input')?.value || 5);
        let extraBaseDrawDraft = baseDrawInputForDraft > 5 ? (baseDrawInputForDraft - 5) : 0;

        let dynamicDrawTargetRef = Math.max(0, 4 + Math.ceil(terminalCountInDeck * 1.5) - extraBaseDrawDraft);
        // --- 改动后的新代码结束 ---

        const TARGET_SLOTS_REF = {
            "过渡输出": 5,
            "过渡防御": 8,
            "终端输出": 3,
            "终端防御": 4,
            "润滑运转": dynamicDrawTargetRef
        };

        // 4. 开始渲染候选卡牌列
        myDrafts.forEach((draftCard, index) => {
            let tr = document.createElement('tr');
            tr.style.borderBottom = "1px dashed #e0e4d8";

            // -- 第一列：卡牌按钮 --
            let tdCard = document.createElement('td');
            tdCard.style.padding = "4px 2px";
            tdCard.appendChild(createCardButton(draftCard.id, draftCard, "draft", index));
            tr.appendChild(tdCard);

            let savedInfo = cardDictionary[draftCard.id] || { tier: "-", tags: [] };
            if (!savedInfo.tags) savedInfo.tags = [];

            // -- 第二列：卡牌定位标签 --
            let tdTags = document.createElement('td');
            tdTags.style.padding = "6px 4px";
            let tierColor = savedInfo.tier === "S" ? "#ff9f43" : (savedInfo.tier === "A" ? "#ee5253" : (savedInfo.tier === "F" ? "#7f8c8d" : "#2980b9"));
            let tierHtml = savedInfo.tier !== "-" && savedInfo.tier !== "" ? `<span style="color:${tierColor}; font-weight:bold;">[${savedInfo.tier}级]</span><br>` : "";
            let tagsHtml = savedInfo.tags.length > 0 ? savedInfo.tags.join(" | ") : "<span style='color:#999'>暂无标签</span>";
            tdTags.innerHTML = `${tierHtml}${tagsHtml}`;
            tr.appendChild(tdTags);

            // -- 第三列：协同分析 (同步最严苛打分标准) --
            let tdEval = document.createElement('td');
            tdEval.style.padding = "6px 4px";

            if (savedInfo.tags.length === 0 && savedInfo.tier === "-") {
                tdEval.innerHTML = `<span style="color:#e74c3c;">未鉴定</span>`;
            } else if (savedInfo.tier === "F") {
                tdEval.innerHTML = `<span style="color:#7f8c8d; font-weight:bold;">严重污染</span><br><span style="font-size:0.8rem; color:#666;">F级废牌</span>`;
            } else {
                let score = 0;
                let matchReasons = [];

                savedInfo.tags.forEach(tag => {
                    let currentCount = deckTagsCount[tag] || 0;
                    let targetCount = TARGET_SLOTS_REF[tag] || 5;
                    let pctRatio = currentCount / targetCount;

                    if (currentCount === 0) {
                        score += 80;
                        matchReasons.push(`[救命] 填补致命空缺(${tag})`);
                    } else if (currentCount >= targetCount) {
                        score -= 100;
                        matchReasons.push(`[毒药] 拒绝冗余卡手(${tag})`);
                    } else if (pctRatio < 0.5) {
                        score += 50;
                        matchReasons.push(`[抢救] 挽救高危断档(${tag})`);
                    } else if (pctRatio < 0.8) {
                        score += 20;
                        matchReasons.push(`[润滑] 缓解运转迟缓(${tag})`);
                    } else {
                        score += 5;
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

            // -- 第四列：负载影响计算 (接入出牌自由度判定) --
            let tdLoad = document.createElement('td');
            tdLoad.style.padding = "6px 4px";
            tdLoad.style.textAlign = "center";

            let dStats = (typeof parseCardStats === 'function') ? parseCardStats(draftCard, draftCard.isUpgraded) : { cost: 0 };
            let draftCardCost = (typeof dStats.cost === 'number' && dStats.cost >= 0) ? dStats.cost : 0;

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

            // -- 第五列：操作动作 --
            let tdAction = document.createElement('td');
            tdAction.style.textAlign = "center";

            let addBtn = document.createElement('button');
            addBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
            addBtn.title = "直接加入卡组";

            addBtn.style.cssText = `
                border: 1px solid #e0e4d8; background: transparent; color: #aab2b8; 
                border-radius: 6px; width: 30px; height: 30px; 
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); margin: 0 auto;
            `;

            addBtn.onmouseover = () => {
                addBtn.style.background = "#27ae60";
                addBtn.style.color = "white";
                addBtn.style.border = "1px solid #27ae60";
                addBtn.style.transform = "scale(1.15)";
                addBtn.style.boxShadow = "0 4px 10px rgba(39, 174, 96, 0.3)";
            };

            addBtn.onmouseout = () => {
                addBtn.style.background = "transparent";
                addBtn.style.color = "#aab2b8";
                addBtn.style.border = "1px solid #e0e4d8";
                addBtn.style.transform = "scale(1)";
                addBtn.style.boxShadow = "none";
            };

            addBtn.onclick = () => {
                let cardToGrab = JSON.parse(JSON.stringify(draftCard));
                myDeck.push(cardToGrab);
                updateWorkshop();
            };

            tdAction.appendChild(addBtn);
            tr.appendChild(tdAction);

            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("推演台渲染发生阻断性错误:", error);
        let tbody = document.getElementById('draft-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="color:#e74c3c; font-weight:bold; text-align:center; padding: 20px;">系统检测到严重错误，推演台引擎已停止运行。<br>请按 F12 打开控制台查看错误详情。</td></tr>`;
        }
    }
}

// ================= 卡牌图纸库渲染 =================
function renderLibrary() {
    const listDiv = document.getElementById('card-list');
    listDiv.innerHTML = '';
    for (let cardName in allCards) {
        listDiv.appendChild(createCardButton(cardName, allCards[cardName]));
    }
}

// ================= 搜索与筛选系统 (终极防弹版) =================

function filterCards() {
    try {
        const searchInput = document.getElementById('search-input').value.toLowerCase().trim();
        const classFilter = document.getElementById('class-filter').value;
        const typeFilter = document.getElementById('type-filter').value;
        const costFilter = document.getElementById('cost-filter').value;

        const cardListContainer = document.getElementById('card-list');
        if (!cardListContainer) return;
        cardListContainer.innerHTML = '';

        let visibleCount = 0;

        Object.keys(allCards).forEach(cardId => {
            let card = allCards[cardId];

            // 强转 String，防止极端卡牌数据缺失导致报错中断
            let cardName = String(card.Name_ZHS || card.name || cardId);

            // 1. 文本与拼音双核匹配逻辑
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
                } catch(e) {
                    // 静默忽略拼音报错
                }

                textMatch = isNameMatch || isPinyinMatch;
            }

            // 2. 职业匹配逻辑 (翻译官与无色收容所)
            // 读取图纸中的 Class 字段，并强制转为小写以统一标准
            let cardClass = String(card.Class || "").toLowerCase();
            let classMatch = false;

            if (classFilter === 'all') {
                classMatch = true;
            } else if (classFilter === 'colorless') {
                // 排除法：只要不是这5个基础职业，统统算作“无色及其他”（包含 Token, Colorless, Curse 等）
                const mainClasses = ['ironclad', 'silent', 'regent', 'necrobinder', 'defect'];
                classMatch = !mainClasses.includes(cardClass);
            } else {
                // 精准匹配基础职业
                classMatch = (cardClass === classFilter);
            }

            // 3. 类型匹配逻辑
            let cardType = card.Type || card.type || "";
            let typeMatch = (typeFilter === 'all') || (cardType === typeFilter);

            // 4. 费用匹配逻辑
            let costMatch = true;
            if (costFilter !== 'all') {
                let stats = (typeof parseCardStats === 'function') ? parseCardStats(card, false) : { cost: parseInt(card.Cost || 0) };
                let costVal = stats.cost;

                if (costFilter === '3') {
                    costMatch = (typeof costVal === 'number' && costVal >= 3);
                } else {
                    costMatch = (costVal === parseInt(costFilter));
                }
            }

            // 综合判定
            if (textMatch && classMatch && typeMatch && costMatch) {
                visibleCount++;
                let btn = createCardButton(cardId, card, "library");
                cardListContainer.appendChild(btn);
            }
        });

        // 更新数量
        let countBadge = document.getElementById('card-count');
        if (countBadge) {
            countBadge.innerText = visibleCount;
        }

    } catch (error) {
        console.error("筛选引擎发生阻断性错误:", error);
    }
}

// ================= 全局系统启动 =================
async function loadCards() {
    try {
        const response = await fetch('STS2_Card_Database_ZHS.json?v=' + new Date().getTime());
        allCards = await response.json();

        // 核心新增：在生成卡组界面前，优先从硬盘读取上次关闭时的职业，并强行改变下拉框的值
        const lastJob = localStorage.getItem('SpireV2_LastJob');
        if (lastJob) {
            const jobSelect = document.getElementById('job-select');
            if (jobSelect) {
                jobSelect.value = lastJob;
            }
        }

        renderSaveSlots();
        renderLibrary();
        filterCards();
        loadDeckFromDisk(true); // 首次启动，直接读取当前选中的存档

    } catch (error) {
        console.error("加载失败:", error);
        document.getElementById('card-list').innerHTML = "图纸读取失败！";
    }
}

window.dropToDraft = function(e) {
    e.preventDefault();
    let cardId = e.dataTransfer.getData('cardId');
    let isUpg = e.dataTransfer.getData('isUpgraded') === 'true';
    if (cardId && allCards[cardId]) {
        myDrafts.push({ ...allCards[cardId], id: cardId, isUpgraded: isUpg });
        updateDrafts();
    }
};

// 绑定UI事件：确保你的HTML里的下拉框有相应的事件触发
document.getElementById('save-slot')?.addEventListener('change', () => loadDeckFromDisk(false));

// ================= 推演台管理 =================
// 清空推演台所有候选卡牌
function clearDrafts() {
    if (myDrafts.length > 0 && confirm("确定要清空推演台吗？")) {
        myDrafts = [];
        updateDrafts();
    }
}

// ================= 数据持久化备份引擎 =================

// 导出字典：将本地存储中的鉴定数据打包成 JSON 文件下载
function exportDictionary() {
    const dict = localStorage.getItem('SpireV2_Dictionary');
    if (!dict || dict === '{}') {
        alert("当前字典为空，无需备份。");
        return;
    }

    // 创建 Blob 对象，模拟文件数据
    const blob = new Blob([dict], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // 创建虚拟链接并触发下载
    const a = document.createElement('a');
    a.href = url;
    a.download = `NeowsBigForge_Backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();

    // 清理临时资源
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 导入字典：读取上传的 JSON 文件并合并/覆盖当前本地存储
function importDictionary(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            // 简单校验格式是否正确
            if (typeof importedData !== 'object') throw new Error("无效的字典格式");

            if (confirm("导入将覆盖当前浏览器的鉴定数据，确定继续吗？")) {
                localStorage.setItem('SpireV2_Dictionary', JSON.stringify(importedData));

                // 重新加载页面变量并刷新 UI
                cardDictionary = importedData;
                renderLibrary();
                updateWorkshop();
                alert("导入成功！已同步最新鉴定方案。");
            }
        } catch (err) {
            alert("导入失败：请确保文件是正确的 JSON 备份。");
            console.error(err);
        }
    };
    reader.readAsText(file);
    // 重置 input，允许重复导入相同文件
    event.target.value = '';
}

// 能量助手逻辑
function toggleEnergyHelper() {
    const modal = document.getElementById('energy-helper-modal');
    modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
    if(modal.style.display === 'flex') updateHelperLogic();
}

// 监听动态输入
// 替换为全新的七回合推演计算核心
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

    // 核心机制：按时间轴推演 1 到 7 回合
    for (let i = 1; i <= 7; i++) {
        let currentTurnEnergy = base + constant;

        // 首回合逻辑
        if (i === 1) {
            currentTurnEnergy += burst;
            currentTurnEnergy -= breadMinus;
        } else {
            // 后续回合逻辑 (从第2回合开始生效)
            currentTurnEnergy += breadPlus;
        }

        // 周期逻辑 (例如每3回合触发，则在第3、第6回合生效)
        if (periodVal > 0 && periodN > 0 && i % periodN === 0) {
            currentTurnEnergy += periodVal;
        }

        // 现实修正：防止能量出现负数
        currentTurnEnergy = Math.max(0, currentTurnEnergy);

        turnEnergies.push(currentTurnEnergy);
        totalEnergy += currentTurnEnergy;
    }

    const result = totalEnergy / 7;

    document.getElementById('calc-result').innerText = `沙盘等效值: ${result.toFixed(2)}`;
    // 展示每一回合的具体能量，所见即所得
    document.getElementById('calc-formula').innerText = `明细: (${turnEnergies.join(' + ')}) / 7`;

    window.lastCalcResult = result;
}

// 辅助重置功能
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

// 启动引擎
loadCards();