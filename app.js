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

    if (savedData) {
        try {
            let state = JSON.parse(savedData);
            let savedDeck = state.deck || [];

            // 匹配完整数据字典
            savedDeck.forEach(sc => {
                if (allCards[sc.id]) {
                    myDeck.push({ ...allCards[sc.id], id: sc.id, isUpgraded: sc.isUpgraded });
                }
            });

            if (state.energy) document.getElementById('energy-input').value = state.energy;
            if (state.draw) document.getElementById('draw-input').value = state.draw;
            if (state.job) document.getElementById('job-select').value = state.job;

        } catch (e) {
            console.error("读取存档失败", e);
        }
    } else {
        // 空存档，下发当前选择职业的初始牌
        let currentJob = document.getElementById('job-select')?.value || 'regent';
        const template = starterTemplates[currentJob] || [];
        template.forEach(targetId => {
            let normalizedTarget = targetId.toLowerCase().replace(/[^a-z0-9]/g, '');
            let realKey = Object.keys(allCards).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedTarget);
            if (realKey) myDeck.push({ ...allCards[realKey], id: realKey, isUpgraded: false });
        });
    }

    updateWorkshop();

    // 如果是手动点击撤销读取的，给予视觉反馈
    if (!isInitialLoad) {
        let btn = document.querySelector('button[onclick="loadDeckFromDisk()"]');
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
        energy: parseInt(energy),
        draw: parseInt(draw),
        job: job
    };

    localStorage.setItem(`sts2_v2_save_${slot}`, JSON.stringify(stateToSave));

    let btn = document.querySelector('button[onclick="commitSaveToDisk()"]');
    let originalText = btn.innerText;
    btn.innerText = "已保存";
    btn.style.backgroundColor = "#27ae60";
    setTimeout(() => {
        btn.innerText = originalText;
        btn.style.backgroundColor = "";
    }, 1500);
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

// ================= 全息仪表盘与概率引擎 =================
function updateDashboard(deckSize, avgCost, drawCount, exhaustCount) {
    const baseEnergy = parseFloat(document.getElementById('energy-input')?.value || 3);
    const baseDraw = parseInt(document.getElementById('draw-input')?.value || 5);

    let expectedEnergySpend = avgCost * 5;
    let energyText = document.getElementById('energy-text');
    let energyFill = document.getElementById('energy-fill');
    if (energyText && energyFill) {
        energyText.innerText = `${expectedEnergySpend.toFixed(1)} / ${baseEnergy}`;
        let pct = Math.min((expectedEnergySpend / baseEnergy) * 100, 100);
        energyFill.style.width = pct + '%';
        energyFill.style.backgroundColor = pct > 90 ? '#e74c3c' : (pct > 70 ? '#f39c12' : '#16a085');
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

    const TARGET_SLOTS = {
        "过渡输出": 5, "过渡防御": 8, "终端输出": 3, "终端防御": 4, "润滑运转": 10
    };

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

    const portContainer = document.getElementById('port-summary-container');
    if (portContainer) {
        portContainer.innerHTML = '';
        AVAILABLE_TAGS.forEach(tag => {
            let current = tagCounts[tag];
            let target = TARGET_SLOTS[tag];
            let statusColor = current === 0 ? "#e74c3c" : (current > target ? "#f39c12" : "#27ae60");
            let statusText = current === 0 ? "急缺" : (current > target ? "冗余" : "良好");
            let cardListStr = tagCardNames[tag].length > 0 ? tagCardNames[tag].join(", ") : "无";

            let div = document.createElement('div');
            div.style.background = "#f8f9fa"; div.style.padding = "6px 10px"; div.style.borderRadius = "6px"; div.style.borderLeft = `4px solid ${statusColor}`;
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <strong style="color:#333;">${tag}</strong>
                    <span style="color:${statusColor}; font-weight:bold;">${current} / ${target} 牌位 (${statusText})</span>
                </div>
                <div style="color:#888; font-size:0.75rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">包含: ${cardListStr}</div>
            `;
            portContainer.appendChild(div);
        });
    }
}

// ================= 标签协同推演台 =================
function updateDrafts() {
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

    myDeck.forEach(card => {
        let info = cardDictionary[card.id];
        if (info && info.tags) {
            info.tags.forEach(t => {
                if (deckTagsCount[t] !== undefined) deckTagsCount[t]++;
            });
        }

        let stats = parseCardStats(card, card.isUpgraded);
        // 不再排除基础牌
        if (typeof stats.cost === 'number' && stats.cost >= 0) {
            currentTotalEnergyCost += stats.cost;
        }
    });

    let currentAvgCost = deckSize > 0 ? (currentTotalEnergyCost / deckSize) : 0;

    myDrafts.forEach((draftCard, index) => {
        let tr = document.createElement('tr');
        tr.style.borderBottom = "1px dashed #e0e4d8";

        let tdCard = document.createElement('td');
        tdCard.style.padding = "4px 2px";
        tdCard.appendChild(createCardButton(draftCard.id, draftCard, "draft", index));
        tr.appendChild(tdCard);

        let savedInfo = cardDictionary[draftCard.id] || { tier: "-", tags: [] };
        let tdTags = document.createElement('td');
        tdTags.style.padding = "6px 4px";
        let tierColor = savedInfo.tier === "S" ? "#ff9f43" : (savedInfo.tier === "A" ? "#ee5253" : (savedInfo.tier === "F" ? "#7f8c8d" : "#2980b9"));
        let tierHtml = savedInfo.tier !== "-" && savedInfo.tier !== "" ? `<span style="color:${tierColor}; font-weight:bold;">[${savedInfo.tier}级]</span><br>` : "";
        let tagsHtml = savedInfo.tags.length > 0 ? savedInfo.tags.join(" | ") : "<span style='color:#999'>暂无标签</span>";
        tdTags.innerHTML = `${tierHtml}${tagsHtml}`;
        tr.appendChild(tdTags);

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
                let density = deckSize > 0 ? currentCount / deckSize : 0;

                if (currentCount === 0) { score += 50; matchReasons.push(`雪中送炭(缺${tag})`); }
                else if (density < 0.15) { score += 30; matchReasons.push(`补强缺口(${tag})`); }
                else if (density > 0.35) { score -= 20; matchReasons.push(`冗余(${tag})`); }
                else { score += 10; }
            });

            if (savedInfo.tier === "S") score += 40;
            if (savedInfo.tier === "A") score += 20;
            if (savedInfo.tier === "C") score -= 20;

            if (score >= 60) tdEval.innerHTML = `<span style="color:#27ae60; font-weight:bold;">完美拼图</span><br><span style="font-size:0.8rem; color:#666;">${matchReasons.join(", ")}</span>`;
            else if (score >= 30) tdEval.innerHTML = `<span style="color:#2980b9; font-weight:bold;">顺滑融入</span><br><span style="font-size:0.8rem; color:#666;">${matchReasons.length > 0 ? matchReasons.join(", ") : "平滑过渡"}</span>`;
            else if (score < 0) tdEval.innerHTML = `<span style="color:#c0392b; font-weight:bold;">体系冲突</span><br><span style="font-size:0.8rem; color:#666;">${matchReasons.join(", ")}</span>`;
            else tdEval.innerHTML = `<span style="color:#f39c12; font-weight:bold;">收益平庸</span><br><span style="font-size:0.8rem; color:#666;">同位替代</span>`;
        }
        tr.appendChild(tdEval);

        let tdLoad = document.createElement('td');
        tdLoad.style.padding = "6px 4px";
        tdLoad.style.textAlign = "center";

        let dStats = parseCardStats(draftCard, draftCard.isUpgraded);
        let draftCardCost = (typeof dStats.cost === 'number' && dStats.cost >= 0) ? dStats.cost : 0;

        // 模拟加入这张牌后的总费用和总张数
        let newAvgCost = (deckSize + 1 > 0) ? ((currentTotalEnergyCost + draftCardCost) / (deckSize + 1)) : 0;
        let deltaCost = newAvgCost - currentAvgCost;

        if (deltaCost > 0.03) {
            tdLoad.innerHTML = `<span style="color:#e74c3c; font-weight:bold;">+${deltaCost.toFixed(2)}</span><br><span style="font-size:0.75rem; color:#e74c3c;">变卡手</span>`;
        } else if (deltaCost < -0.03) {
            tdLoad.innerHTML = `<span style="color:#27ae60; font-weight:bold;">${deltaCost.toFixed(2)}</span><br><span style="font-size:0.75rem; color:#27ae60;">变流畅</span>`;
        } else {
            tdLoad.innerHTML = `<span style="color:#7f8c8d;">${deltaCost > 0 ? '+' : ''}${deltaCost.toFixed(2)}</span><br><span style="font-size:0.75rem; color:#999;">无影响</span>`;
        }
        tr.appendChild(tdLoad);

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
}

// ================= 卡牌图纸库渲染 =================
function renderLibrary() {
    const listDiv = document.getElementById('card-list');
    listDiv.innerHTML = '';
    for (let cardName in allCards) {
        listDiv.appendChild(createCardButton(cardName, allCards[cardName]));
    }
}

// ================= 全能过滤系统 =================
function filterCards() {
    let searchText = document.getElementById('search-input').value.toLowerCase();
    let classFilter = document.getElementById('class-filter')?.value || 'all';
    let typeFilter = document.getElementById('type-filter')?.value || 'all';
    let costFilter = document.getElementById('cost-filter')?.value || 'all';

    let cards = document.querySelectorAll('.lib-card');
    let visibleCount = 0;

    cards.forEach(card => {
        let matchName = card.dataset.name.includes(searchText) || card.dataset.id.includes(searchText);
        let matchClass = (classFilter === 'all') || (card.dataset.cardClass === classFilter);
        let matchType = (typeFilter === 'all') || (card.dataset.type === typeFilter.toLowerCase());

        let cardCost = card.dataset.cost;
        let matchCost = false;

        if (costFilter === 'all') {
            matchCost = true;
        } else if (costFilter === '3+') {
            matchCost = (parseInt(cardCost) >= 3);
        } else if (costFilter === 'X') {
            matchCost = (cardCost === 'X' || cardCost === 'unplayable' || parseInt(cardCost) === -1);
        } else {
            matchCost = (cardCost == costFilter);
        }

        if (matchName && matchClass && matchType && matchCost) {
            card.style.display = 'inline-block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    let countEl = document.getElementById('card-count');
    if (countEl) countEl.innerText = visibleCount;
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

// 启动引擎
loadCards();