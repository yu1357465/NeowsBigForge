import os
import re
import json

# ================= 路径配置区 =================
CARDS_DIR = r"D:\MyFiles_UK_updated\Tools_Software\MyProjects\NeowsForge\sts2\MegaCrit.Sts2.Core.Models.Cards"
POOLS_DIR = r"D:\MyFiles_UK_updated\Tools_Software\MyProjects\NeowsForge\sts2\MegaCrit.Sts2.Core.Models.CardPools"
OUTPUT_FILE = "STS2_Card_Database_Base.json" # 提取后的基础框架，后续还需与汉化文本合并
# ===============================================

def build_class_dictionary():
    class_dict = {}
    if not os.path.exists(POOLS_DIR):
        print(f"【警告】找不到卡池文件夹：{POOLS_DIR}。将跳过职业分类。")
        return class_dict

    card_in_pool_pattern = re.compile(r'ModelDb\.Card<([a-zA-Z0-9_]+)>')

    for filename in os.listdir(POOLS_DIR):
        if not filename.endswith("CardPool.cs"):
            continue
        class_name = filename.replace("CardPool.cs", "")
        filepath = os.path.join(POOLS_DIR, filename)

        with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()
            matches = card_in_pool_pattern.finditer(content)
            for match in matches:
                card_id = match.group(1)
                class_dict[card_id] = class_name

    print(f"✅ 成功建立职业名录，共收录 {len(class_dict)} 张正规卡池注册牌。")
    return class_dict

def extract_cards_with_classes(class_dict):
    card_database = {}

    # 1. 基础属性刀片 (费用, 类型, 稀有度)
    base_pattern = re.compile(r'base\(\s*([^\,]+)\s*,\s*CardType\.([a-zA-Z0-9_]+)\s*,\s*CardRarity\.([a-zA-Z0-9_]+)')

    # 2. 🎯 V2.0 专属：升级费用精准打击 (双轨制防弹)
    # 捕获变成几费 (绝对赋值)：如 UpgradeCostTo(1)
    upg_cost_to_pattern = re.compile(r'(?:UpgradeCostTo|UpgradeBaseCost|Cost\.UpgradeValueTo|EnergyCost\.UpgradeTo)\(\s*(-?\d+)')
    # 捕获减少/增加几费 (相对增减)：如 EnergyCost.UpgradeBy(-1) -> 《光谱偏移》就是被这个捕获！
    upg_cost_by_pattern = re.compile(r'(?:Cost\.UpgradeValueBy|EnergyCost\.UpgradeBy)\(\s*(-?\d+)')

    if not os.path.exists(CARDS_DIR):
        print(f"【严重错误】：找不到卡牌源码文件夹，请检查：\n{CARDS_DIR}")
        return

    files = [f for f in os.listdir(CARDS_DIR) if f.endswith('.cs')]
    print(f"🔄 正在启动 V2.0 极简流水线，扫描 {len(files)} 份卡牌图纸...")

    valid_count = 0
    token_count = 0

    for filename in files:
        card_name = filename[:-3]
        filepath = os.path.join(CARDS_DIR, filename)

        # 剔除不在卡池中的衍生牌/测试牌
        if card_name not in class_dict:
            token_count += 1
            continue

        card_class = class_dict[card_name]

        with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()

            base_match = base_pattern.search(content)
            if base_match:
                raw_cost = base_match.group(1).strip()
                card_type = base_match.group(2)
                rarity = base_match.group(3)

                # 兼容 "X" 费等特殊情况
                try:
                    cost = int(raw_cost)
                except ValueError:
                    cost = raw_cost

                # V2.0 纯净数据结构
                card_data = {
                    "Cost": cost,
                    "Type": card_type,
                    "Rarity": rarity,
                    "Class": card_class
                }

                # 🎯 提取强化后的费用 (解决光谱偏移 Bug 的核心)
                upg_cost_to_match = upg_cost_to_pattern.search(content)
                if upg_cost_to_match:
                    card_data["UpgradeCostTo"] = int(upg_cost_to_match.group(1))

                upg_cost_by_match = upg_cost_by_pattern.search(content)
                if upg_cost_by_match:
                    card_data["UpgradeCostBy"] = int(upg_cost_by_match.group(1))

                card_database[card_name] = card_data
                valid_count += 1

    print(f"🎯 V2.0 提取流水线完工！")
    print(f"   - 完美解析有效卡牌：{valid_count} 张")
    print(f"   - 拦截并丢弃测试/衍生牌：{token_count} 张")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(card_database, f, indent=4, ensure_ascii=False)

    print(f"V2.0 底层图纸已封存至：{OUTPUT_FILE}")

if __name__ == "__main__":
    dictionary = build_class_dictionary()
    extract_cards_with_classes(dictionary)