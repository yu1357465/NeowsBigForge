// ================= NeowsBigForge V2.0 定性构筑沙盘核心引擎 =================

let allCards = {};
let myDeck = [];
let myDrafts = [];

const classIcons = {
    "ironclad": "战", "silent": "猎", "defect": "机",
    "necrobinder": "灵", "regent": "君", "colorless": "无",
    "curse": "诅", "status": "状"
};

// ================= 🎯 初始卡组配置 (全员添加进阶之灾) =================
const starterTemplates = {
    "ironclad": ["StrikeIronclad", "StrikeIronclad", "StrikeIronclad", "StrikeIronclad", "StrikeIronclad", "DefendIronclad", "DefendIronclad", "DefendIronclad", "DefendIronclad", "Bash", "AscendersBane"],
    "silent": ["StrikeSilent", "StrikeSilent", "StrikeSilent", "StrikeSilent", "StrikeSilent", "DefendSilent", "DefendSilent", "DefendSilent", "DefendSilent", "DefendSilent", "Survivor", "Neutralize", "AscendersBane"],
    "defect": ["StrikeDefect", "StrikeDefect", "StrikeDefect", "StrikeDefect", "DefendDefect", "DefendDefect", "DefendDefect", "DefendDefect", "Zap", "Dualcast", "AscendersBane"],
    "necrobinder": ["StrikeNecrobinder", "StrikeNecrobinder", "StrikeNecrobinder", "StrikeNecrobinder", "DefendNecrobinder", "DefendNecrobinder", "DefendNecrobinder", "DefendNecrobinder", "Bodyguard", "Unleash", "AscendersBane"],
    "regent": ["StrikeRegent", "StrikeRegent", "StrikeRegent", "StrikeRegent", "DefendRegent", "DefendRegent", "DefendRegent", "DefendRegent", "Falling Star", "Venerate", "AscendersBane"]
};

// ================= 🎯 V2.0 职业专属工作区与动态命名系统 =================
let slotNames = JSON.parse(localStorage.getItem('SpireV2_SlotNames')) || {};

// 获取当前选中的职业
function getCurrentClass() {
    let el = document.getElementById('current-class');
    return el ? el.value : "ironclad";
}

// 渲染当前职业专属的 4 个存档槽
function renderSaveSlots() {
    const select = document.getElementById('save-slot');
    if (!select) return;

    const currentClass = getCurrentClass();
    const previousSelection = select.value;

    select.innerHTML = '';
    for (let i = 1; i <= 4; i++) {
        let slotId = `${currentClass}_slot${i}`;
        let defaultName = `方案 ${i}`;
        let displayName = slotNames[slotId] || defaultName;

        let opt = document.createElement('option');
        opt.value = slotId;
        opt.innerText = displayName;
        select.appendChild(opt);
    }

    // 保持选中状态或默认选第一个
    if (Array.from(select.options).some(opt => opt.value === previousSelection)) {
        select.value = previousSelection;
    } else {
        select.value = `${currentClass}_slot1`;
    }
}

// 切换职业时：重新渲染槽位，并自动读取该职业的卡组
function switchClassWorkspace() {
    renderSaveSlots();
    loadDeckFromLocal();
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

function saveDeckToLocal(silent = false) {
    if (myDeck.length === 0 && !silent) {
        alert("卡组为空，无需保存！");
        return;
    }
    const slot = document.getElementById('save-slot').value;
    const deckToSave = myDeck.map(c => ({ id: c.id, isUpgraded: c.isUpgraded }));
    localStorage.setItem(`SpirePortV2_${slot}`, JSON.stringify(deckToSave));
    if (!silent) alert(`✅ 已成功保存至当前方案槽！`);
}

// 读取卡组：如果为空，则自动下发该职业初始牌
function loadDeckFromLocal() {
    const slot = document.getElementById('save-slot').value;
    const currentClass = getCurrentClass();
    const savedData = localStorage.getItem(`SpirePortV2_${slot}`);

    myDeck = [];

    if (!savedData || JSON.parse(savedData).length === 0) {
        // 空存档，发初始牌
        const template = starterTemplates[currentClass] || [];
        template.forEach(targetId => {
            let normalizedTarget = targetId.toLowerCase().replace(/[^a-z0-9]/g, '');
            let realKey = Object.keys(allCards).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedTarget);
            if (realKey) myDeck.push({ ...allCards[realKey], id: realKey, isUpgraded: false });
        });
        saveDeckToLocal(true); // 自动静默保存
    } else {
        // 正常读取
        try {
            const parsedDeck = JSON.parse(savedData);
            parsedDeck.forEach(sc => {
                if (allCards[sc.id]) {
                    myDeck.push({ ...allCards[sc.id], id: sc.id, isUpgraded: sc.isUpgraded });
                }
            });
        } catch (e) {
            console.error("读取存档失败", e);
        }
    }
    updateWorkshop();
}

function clearDeck() {
    if (myDeck.length > 0 && confirm("确定要清空当前卡组吗？\n(注意：这将同时覆盖保存当前槽位为空)")) {
        myDeck = [];
        saveDeckToLocal(true); // 静默保存空状态
        updateWorkshop();
    }
}

// 供手动点击“载入初始”按钮使用
function loadStarterDeck() {
    if (myDeck.length > 0 && !confirm("一键载入将覆盖卡组，确定继续？")) return;
    const currentClass = getCurrentClass();
    const template = starterTemplates[currentClass] || [];
    myDeck = [];

    template.forEach(targetId => {
        let normalizedTarget = targetId.toLowerCase().replace(/[^a-z0-9]/g, '');
        let realKey = Object.keys(allCards).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedTarget);
        if (realKey) myDeck.push({ id: realKey, ...allCards[realKey] });
    });
    saveDeckToLocal(true);
    updateWorkshop();
}

// ================= 🎯 基础配置与辞典加载 =================
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

// ================= 🎯 极简属性引擎 =================
function parseCardStats(card, isUpgraded) {
    let cost = card.Cost !== undefined ? card.Cost : (card.BaseCost || 0);
    let desc = card.Description || "";

    if (isUpgraded) {
        if (card.UpgradedCost !== undefined) cost = card.UpgradedCost;
        else if (card.UpgradeCostTo !== undefined) cost = card.UpgradeCostTo;

        if (card.UpgradedDescription) desc = card.UpgradedDescription;
        else if (card.UpgradeDescription) desc = card.UpgradeDescription;
    }
    return { cost, desc };
}

// ================= 🎨 动态卡牌鉴定面板 (Inspector) =================
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
    filterCards(); // 🎯 关键修复：重新渲染后，立刻读取当前搜索框里的字，保持筛选状态
    updateWorkshop();
}

// ================= 🃏 卡牌组件生成器 =================
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
    if (savedInfo && (savedInfo.tier || savedInfo.tags.length > 0)) {
        let tierLabel = savedInfo.tier ? `<span class="mini-tag" style="background: #fff2e1; color: #ff9f43; font-weight: bold;">${savedInfo.tier}</span>` : "";
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
            saveDeckToLocal(true); // 自动静默保存
            updateWorkshop();
        };
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            openInspector(cardId, cName);
        };
    } else {
        // 🎯 核心修复：通过对象引用 (indexOf) 来删除/强化卡牌，而不是不可靠的 index
        let targetArray = mode === "deck" ? myDeck : myDrafts;
        let updateFn = () => {
            if (mode === "deck") { saveDeckToLocal(true); updateWorkshop(); } else { updateDrafts(); }
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

// ================= ⚙️ V2.0 主卡组运转引擎 =================
function updateWorkshop() {
    const deckDiv = document.getElementById('my-deck');
    const deckCountEl = document.getElementById('deck-count');
    if (deckCountEl) deckCountEl.innerText = myDeck.length;

    deckDiv.innerHTML = '';

    if (myDeck.length === 0) {
        deckDiv.innerHTML = '<p style="color: #666; font-size: 0.9rem; text-align: center; margin-top: 20px;">👈 点击左侧卡牌加入卡组<br><br>💡 加入后：<b>左键</b>移除，<b>右键</b>强化/降级</p>';
        updateDashboard(0, 0, 0, 0);
        saveSessionState(); // 触发记忆保存
        return;
    }

    // 🎯 提取下拉框的排序指令
    let sortType = document.getElementById('deck-sort-select')?.value || "acquire";

    // 创建一个仅用于屏幕显示的浅拷贝数组，绝对不污染 myDeck 原本的“获得顺序”
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

    let realTotalCost = 0;
    let realCardCount = 0; // 🎯 真正的有效牌数量
    let drawCount = 0;
    let exhaustCount = 0;

    // 🎯 注意：遍历用于屏幕渲染的数组 (renderDeck)，而且不再传 index，全靠 indexOf 精准定位
    renderDeck.forEach(card => {
        deckDiv.appendChild(createCardButton(card.id, card, true));

        let stats = parseCardStats(card, card.isUpgraded);

        // 🎯 核心逻辑：识别并排除基础牌、诅咒和状态牌
        let lowerName = (card.Name_ZHS || card.id).toLowerCase();
        let isBasic = lowerName.includes("strike") || lowerName.includes("defend") || lowerName.includes("打击") || lowerName.includes("防御");
        let isCurseOrStatus = (card.Type || "").toLowerCase() === "curse" || (card.Type || "").toLowerCase() === "status";

        // 只有“有效牌”才计入平均费用的分母
        if (!isBasic && !isCurseOrStatus) {
            realCardCount++;
            if (typeof stats.cost === 'number' && stats.cost > 0) {
                realTotalCost += stats.cost;
            }
        }

        let lowerDesc = stats.desc.toLowerCase();
        if (lowerDesc.includes("抽") || lowerDesc.includes("draw")) drawCount++;
        if (lowerDesc.includes("消耗") || lowerDesc.includes("exhaust")) exhaustCount++;
    });

    let deckSize = myDeck.length;
    // 🎯 真实的平均耗费！
    let avgCost = realCardCount > 0 ? (realTotalCost / realCardCount) : 0;

    updateDashboard(deckSize, avgCost, drawCount, exhaustCount);
    updateDrafts();
    saveSessionState(); // 触发记忆保存
}

// ================= ⚙️ V2.0 全息仪表盘与概率引擎 =================
function updateDashboard(deckSize, avgCost, drawCount, exhaustCount) {
    const baseEnergy = parseFloat(document.getElementById('base-energy')?.value || 3);
    const baseDraw = parseInt(document.getElementById('base-draw')?.value || 5);

    // 1. 基础负载渲染
    let expectedEnergySpend = avgCost * 5;
    let energyText = document.getElementById('energy-text');
    let energyFill = document.getElementById('energy-fill');
    if (energyText && energyFill) {
        // 🎯 加上文案提示，让你知道基础牌被踢出去了
        energyText.innerText = `${expectedEnergySpend.toFixed(1)} / ${baseEnergy} (已排除基础牌)`;
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

    // 2. 🎯 端口槽位雷达解析
    // 设定 30 张牌为标准成型卡组的推荐牌位 (比例化)
    const TARGET_SLOTS = {
        "过渡输出": 5, "过渡防御": 8, "终端输出": 3, "终端防御": 4, "润滑运转": 10
    };

    let tagCounts = { "过渡输出": 0, "过渡防御": 0, "终端输出": 0, "终端防御": 0, "润滑运转": 0 };
    let tagCardNames = { "过渡输出": [], "过渡防御": [], "终端输出": [], "终端防御": [], "润滑运转": [] };

    // 统计当前卡组的标签
    myDeck.forEach(card => {
        let info = cardDictionary[card.id];
        if (info && info.tags) {
            info.tags.forEach(t => {
                if (tagCounts[t] !== undefined) {
                    tagCounts[t]++;
                    // 收集牌名（去重展示用）
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

    // 3. 🎯 超几何概率引擎 (合并同名卡)
    const probContainer = document.getElementById('prob-container');
    if (probContainer) {
        probContainer.innerHTML = '';
        if (deckSize === 0) {
            probContainer.innerHTML = '<span style="color:#aaa;">等待卡组数据...</span>';
            return;
        }

        // 按 ID 合并同名卡
        let cardGroups = {};
        myDeck.forEach(card => {
            if (!cardGroups[card.id]) cardGroups[card.id] = { name: card.Name_ZHS || card.id, count: 0, class: card.Class || "colorless" };
            cardGroups[card.id].count++;
        });

        // 转化为数组并根据概率/数量排序
        let probArray = Object.keys(cardGroups).map(id => {
            let group = cardGroups[id];
            // 计算第一回合抽到的概率
            let prob = hypergeometricProb(deckSize, group.count, baseDraw + drawCount) * 100;
            return { ...group, prob: prob };
        });

        // 剔除基础牌，只显示有价值的牌，并按概率从高到低排序
        probArray = probArray.filter(g => !["Strike", "Defend", "打击", "防御"].some(x => g.name.includes(x)));
        probArray.sort((a, b) => b.prob - a.prob);

        if (probArray.length === 0) {
            probContainer.innerHTML = '<span style="color:#aaa;">目前全是基础牌，无需计算。</span>';
            return;
        }

        probArray.forEach(item => {
            let theme = CLASS_COLORS[item.class.toLowerCase()] || CLASS_COLORS.default;
            let div = document.createElement('div');
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:2px; font-weight:bold; color:#444;">
                    <span>${item.name} <span style="color:#999; font-size:0.75rem;">(x${item.count})</span></span>
                    <span>${item.prob.toFixed(1)}%</span>
                </div>
                <div class="port-bar" style="background:#eef0eb; height:8px;">
                    <div class="port-fill" style="background-color:${theme.hex}; width:${item.prob}%;"></div>
                </div>
            `;
            probContainer.appendChild(div);
        });
    }
}

// ================= ⚖️ V2.0 标签协同推演台 =================
function updateDrafts() {
    let tbody = document.getElementById('draft-tbody');
    let tip = document.getElementById('draft-empty-tip');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (myDrafts.length === 0) {
        if(tip) tip.style.display = 'block';
        saveSessionState(); // 触发记忆保存
        return;
    }
    if(tip) tip.style.display = 'none';

    // 1. 🔍 给当前卡组“把脉” (扫描标签浓度)
    let deckSize = myDeck.length;
    let deckTagsCount = { "过渡输出": 0, "过渡防御": 0, "终端输出": 0, "终端防御": 0, "润滑运转": 0 };

    myDeck.forEach(card => {
        let info = cardDictionary[card.id];
        if (info && info.tags) {
            info.tags.forEach(t => {
                if (deckTagsCount[t] !== undefined) deckTagsCount[t]++;
            });
        }
    });

    // 2. ⚖️ 遍历候选池进行匹配
    myDrafts.forEach((draftCard, index) => {
        let tr = document.createElement('tr');
        tr.style.borderBottom = "1px dashed #e0e4d8";

        // 第一列：卡牌本体
        let tdCard = document.createElement('td');
        tdCard.style.padding = "4px 2px";
        tdCard.appendChild(createCardButton(draftCard.id, draftCard, "draft", index));
        tr.appendChild(tdCard);

        // 第二列：标签与梯度
        let savedInfo = cardDictionary[draftCard.id] || { tier: "-", tags: [] };
        let tdTags = document.createElement('td');
        tdTags.style.padding = "6px 4px";
        let tierColor = savedInfo.tier === "S" ? "#ff9f43" : (savedInfo.tier === "A" ? "#ee5253" : (savedInfo.tier === "F" ? "#7f8c8d" : "#2980b9"));
        let tierHtml = savedInfo.tier !== "-" && savedInfo.tier !== "" ? `<span style="color:${tierColor}; font-weight:bold;">[${savedInfo.tier}级]</span><br>` : "";
        let tagsHtml = savedInfo.tags.length > 0 ? savedInfo.tags.join(" | ") : "<span style='color:#999'>暂无标签</span>";
        tdTags.innerHTML = `${tierHtml}${tagsHtml}`;
        tr.appendChild(tdTags);

        // 🎯 第三列：卡组协同分析 (核心诊断逻辑)
        let tdEval = document.createElement('td');
        tdEval.style.padding = "6px 4px";

        if (savedInfo.tags.length === 0 && savedInfo.tier === "-") {
            tdEval.innerHTML = `<span style="color:#e74c3c;">❓ 未鉴定 (请右键打标)</span>`;
        } else if (savedInfo.tier === "F") {
            tdEval.innerHTML = `<span style="color:#7f8c8d; font-weight:bold;">❌ 严重污染</span><br><span style="font-size:0.8rem; color:#666;">F级废牌，尽量避开</span>`;
        } else {
            let score = 0;
            let matchReasons = [];

            // 计算标签互补性
            savedInfo.tags.forEach(tag => {
                let currentCount = deckTagsCount[tag] || 0;
                let density = deckSize > 0 ? currentCount / deckSize : 0;

                // 动态阈值判定
                if (currentCount === 0) {
                    score += 50;
                    matchReasons.push(`雪中送炭(缺${tag})`);
                } else if (density < 0.15) {
                    score += 30;
                    matchReasons.push(`补强缺口(${tag})`);
                } else if (density > 0.35) {
                    score -= 20;
                    matchReasons.push(`严重冗余(${tag})`);
                } else {
                    score += 10;
                }
            });

            // 梯度绝对权重压制 (超模卡无视部分体系冲突)
            if (savedInfo.tier === "S") score += 40;
            if (savedInfo.tier === "A") score += 20;
            if (savedInfo.tier === "C") score -= 20;

            // 最终评价输出
            if (score >= 60) {
                tdEval.innerHTML = `<span style="color:#27ae60; font-weight:bold;">✅ 完美拼图</span><br><span style="font-size:0.8rem; color:#666;">${matchReasons.join(", ")}</span>`;
            } else if (score >= 30) {
                tdEval.innerHTML = `<span style="color:#2980b9; font-weight:bold;">🔄 顺滑融入</span><br><span style="font-size:0.8rem; color:#666;">${matchReasons.length > 0 ? matchReasons.join(", ") : "平滑过渡"}</span>`;
            } else if (score < 0) {
                tdEval.innerHTML = `<span style="color:#c0392b; font-weight:bold;">⚠️ 体系冲突</span><br><span style="font-size:0.8rem; color:#666;">${matchReasons.join(", ")}</span>`;
            } else {
                tdEval.innerHTML = `<span style="color:#f39c12; font-weight:bold;">⚖️ 收益平庸</span><br><span style="font-size:0.8rem; color:#666;">同位替代，提升有限</span>`;
            }
        }

        tr.appendChild(tdEval);

        // 🎯 4. 新增：一键抓取列
        let tdAction = document.createElement('td');
        tdAction.style.textAlign = "center";

        // 🎯 替换推演台的加号按钮代码
        let addBtn = document.createElement('button');
        // 使用纯净的 SVG 绘制加号，彻底消灭系统自带的丑陋 Emoji
        addBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
        addBtn.title = "直接加入卡组";
        addBtn.style.cssText = `
            border: 1px solid #27ae60; background: #eafff0; color: #27ae60; 
            border-radius: 6px; width: 30px; height: 30px; 
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: all 0.2s; margin: 0 auto;
        `;
        addBtn.onmouseover = () => { addBtn.style.background = "#27ae60"; addBtn.style.color = "white"; };
        addBtn.onmouseout = () => { addBtn.style.background = "#eafff0"; addBtn.style.color = "#27ae60"; };

        addBtn.onclick = () => {
            // 将该牌深度拷贝一份放入主卡组
            let cardToGrab = JSON.parse(JSON.stringify(draftCard));
            myDeck.push(cardToGrab);

            // 抓取后通常我们会把推演台的这张牌移除，或者保留，取决于你的习惯
            // 这里建议保留，方便连续抓取多张同名牌
            updateWorkshop();
        };

        tdAction.appendChild(addBtn);
        tr.appendChild(tdAction);

        tbody.appendChild(tr);
    });

    saveSessionState(); // 触发记忆保存
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
    let classFilter = document.getElementById('filter-class').value;
    let typeFilter = document.getElementById('filter-type').value;
    let costFilter = document.getElementById('filter-cost').value;

    let cards = document.querySelectorAll('.lib-card');
    let visibleCount = 0;

    cards.forEach(card => {
        let matchName = card.dataset.name.includes(searchText) || card.dataset.id.includes(searchText);
        let matchClass = (classFilter === 'all') || (card.dataset.cardClass === classFilter);
        let matchType = (typeFilter === 'all') || (card.dataset.type === typeFilter);

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

    document.getElementById('card-count').innerText = visibleCount;
}

// ================= 全局系统启动 =================
async function loadCards() {
    try {
        const response = await fetch('STS2_Card_Database_ZHS.json');
        allCards = await response.json();

        renderSaveSlots();
        renderLibrary();
        filterCards();

        // 🎯 引擎启动时，直接唤醒“断点记忆”！
        restoreSessionState();

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

// ================= 🎯 V2.0 超几何概率数学引擎 =================
// 组合数计算 C(n, k)
function combination(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    k = Math.min(k, n - k);
    let c = 1;
    for (let i = 0; i < k; i++) {
        c = c * (n - i) / (i + 1);
    }
    return c;
}

// 超几何分布：在 N 张牌中，有 K 张关键牌，抽 n 张，至少抽到 1 张的概率
function hypergeometricProb(N, K, n) {
    if (N === 0) return 0;
    if (n >= N) return 1.0; // 抽穿牌库，概率100%
    if (K === 0) return 0.0;
    if (N - K < n) return 1.0; // 废牌不够抽，必然抽到关键牌

    // 算出“一张都抽不到”的概率，然后 1 减去它
    let probNoDraw = combination(N - K, n) / combination(N, n);
    return 1.0 - probNoDraw;
}

// ================= 💾 V2.0 全局断点记忆系统 =================
function saveSessionState() {
    let state = {
        currentClass: getCurrentClass(),
        currentSlot: document.getElementById('save-slot')?.value,
        drafts: myDrafts.map(c => ({ id: c.id, isUpgraded: c.isUpgraded }))
    };
    // 写入浏览器的“退出前最后状态”缓存
    localStorage.setItem('SpireV2_SessionState', JSON.stringify(state));
}

function restoreSessionState() {
    let savedSession = localStorage.getItem('SpireV2_SessionState');
    if (savedSession) {
        let state = JSON.parse(savedSession);

        // 1. 恢复最后选择的职业
        let classSelect = document.getElementById('current-class');
        if (classSelect && state.currentClass) classSelect.value = state.currentClass;
        renderSaveSlots();

        // 2. 恢复最后选择的槽位
        let slotSelect = document.getElementById('save-slot');
        if (slotSelect && state.currentSlot) slotSelect.value = state.currentSlot;

        // 3. 读取该槽位的卡组
        loadDeckFromLocal();

        // 4. 原样恢复推演台里的待选卡牌
        myDrafts = [];
        if (state.drafts) {
            state.drafts.forEach(sc => {
                if (allCards[sc.id]) {
                    myDrafts.push({ ...allCards[sc.id], id: sc.id, isUpgraded: sc.isUpgraded });
                }
            });
        }
        updateDrafts();
    } else {
        // 如果是第一次使用，走默认的初始化流程
        switchClassWorkspace();
    }
}

// 启动引擎
loadCards();