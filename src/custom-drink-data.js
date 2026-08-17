export const customDrinkGroups = [
  {
    id: "base",
    step: "01",
    title: "茶 / 咖啡因基底",
    hint: "先定这杯的骨架，也可以选 0 咖",
    min: 1,
    max: 1,
    options: [
      { id: "green-tea", name: "绿妍茶底", notes: ["清香", "含咖啡因"] },
      { id: "qilan-tea", name: "花香奇兰", notes: ["焙火花香", "含咖啡因"] },
      { id: "yanhong-tea", name: "嫣红茶底", notes: ["熟果香", "含咖啡因"] },
      { id: "puer-tea", name: "碎银子普洱", notes: ["醇厚", "含咖啡因"] },
      { id: "cold-brew", name: "冷萃咖啡", notes: ["烘烤感", "高咖啡因"] },
      { id: "zero-coconut-water", name: "0 咖椰子水", notes: ["轻透", "无咖啡因"], caffeineFree: true },
      { id: "zero-milk", name: "0 咖醇乳", notes: ["柔和", "无咖啡因"], caffeineFree: true },
    ],
  },
  {
    id: "milk",
    step: "02",
    title: "乳与植物基底",
    hint: "至多一种；清爽果茶也可以不加",
    min: 0,
    max: 1,
    options: [
      { id: "fresh-milk", name: "源牧 3.8 牛乳", notes: ["醇厚"] },
      { id: "thick-milk", name: "厚牛乳", notes: ["浓郁"] },
      { id: "coconut-milk", name: "生椰乳", notes: ["热带"] },
      { id: "oat-milk", name: "燕麦植物奶", notes: ["谷物香"] },
      { id: "almond-milk", name: "巴旦木植物奶", notes: ["坚果香"] },
    ],
  },
  {
    id: "fruit",
    step: "03",
    title: "水果与果汁",
    hint: "最多三种，让主角和配角都有位置",
    min: 0,
    max: 3,
    options: [
      { id: "grape", name: "青提鲜果", notes: ["脆甜"] },
      { id: "grape-juice", name: "葡萄汁", notes: ["圆润"] },
      { id: "mango", name: "芒果果肉", notes: ["明亮"] },
      { id: "mango-juice", name: "芒果汁", notes: ["浓甜"] },
      { id: "guava", name: "芭乐汁", notes: ["热带"] },
      { id: "apple", name: "羽衣苹果汁", notes: ["青脆"] },
      { id: "strawberry", name: "草莓果肉", notes: ["酸甜"] },
      { id: "peach", name: "水蜜桃汁", notes: ["柔甜"] },
      { id: "grapefruit", name: "红柚果粒", notes: ["微苦", "酸性"] },
      { id: "lemon", name: "香水柠檬", notes: ["高酸", "酸性"] },
      { id: "passionfruit", name: "百香果汁", notes: ["高酸", "酸性"] },
    ],
  },
  {
    id: "flavor",
    step: "04",
    title: "香气 / 风味",
    hint: "最多两种，像给配方写下气味注脚",
    min: 0,
    max: 2,
    options: [
      { id: "osmanthus", name: "桂花露", notes: ["花香"] },
      { id: "jasmine", name: "茉莉露", notes: ["白花"] },
      { id: "rose", name: "玫瑰露", notes: ["馥郁"] },
      { id: "cocoa", name: "黑可可", notes: ["苦甜"], caffeinated: true },
      { id: "matcha", name: "石磨抹茶", notes: ["青苦"], caffeinated: true },
      { id: "hazelnut", name: "榛果香", notes: ["烘烤"] },
      { id: "vanilla", name: "香草籽", notes: ["柔甜"] },
      { id: "sea-salt", name: "海盐", notes: ["咸鲜"] },
      { id: "ginger", name: "嫩姜蜜", notes: ["辛香"] },
    ],
  },
  {
    id: "texture",
    step: "05",
    title: "小料 / 口感",
    hint: "最多两种，留一点可以嚼到的惊喜",
    min: 0,
    max: 2,
    options: [
      { id: "crispy-boba", name: "0 脂脆波波", notes: ["脆弹"] },
      { id: "brown-boba", name: "黑糖波波", notes: ["软糯"] },
      { id: "sago", name: "西米", notes: ["细糯"] },
      { id: "jelly", name: "弹弹冻", notes: ["Q 弹"] },
      { id: "coconut-jelly", name: "椰果粒", notes: ["爽脆"] },
      { id: "tea-jelly", name: "茶冻", notes: ["滑嫩"] },
      { id: "red-bean", name: "红豆", notes: ["绵密"] },
    ],
  },
  {
    id: "cloud",
    step: "06",
    title: "云顶 / 奶盖",
    hint: "至多一层，给杯口留一笔柔软",
    min: 0,
    max: 1,
    options: [
      { id: "cheese-cloud", name: "轻芝芝云顶", notes: ["咸香"] },
      { id: "guava-cloud", name: "芭乐云顶", notes: ["果香"] },
      { id: "cocoa-cloud", name: "苦巧云顶", notes: ["可可"] },
      { id: "matcha-cloud", name: "苦抹云顶", notes: ["茶苦"], caffeinated: true },
      { id: "coconut-cloud", name: "生椰云顶", notes: ["轻盈"] },
    ],
  },
];

export const sweetnessOptions = ["不另外加糖", "微微甜", "少少甜", "标准甜"];
export const temperatureOptions = ["热", "温", "去冰", "少冰", "正常冰", "冰沙"];

const optionLookup = new Map(customDrinkGroups.flatMap((group) => group.options.map((option) => [option.id, option])));

export const findCustomOption = (id) => optionLookup.get(id);

export const getSelectionIssue = (selection, groupId, optionId) => {
  const group = customDrinkGroups.find((entry) => entry.id === groupId);
  if (!group) return "这项配料暂不可选";
  const current = selection[groupId] || [];
  if (!current.includes(optionId) && current.length >= group.max) return `${group.title}最多选择 ${group.max} 项`;

  const base = findCustomOption((selection.base || [])[0]);
  const candidate = findCustomOption(optionId);
  if (base?.caffeineFree && candidate?.caffeinated) return "0 咖基底不能搭配含咖啡因的抹茶或可可";
  if (groupId === "base" && candidate?.caffeineFree) {
    const hasCaffeineFlavor = [...(selection.flavor || []), ...(selection.cloud || [])]
      .some((id) => findCustomOption(id)?.caffeinated);
    if (hasCaffeineFlavor) return "当前风味含咖啡因，不能切换为 0 咖基底";
  }

  const nextFruit = groupId === "fruit" ? [...current, optionId] : (selection.fruit || []);
  const nextMilk = groupId === "milk" ? optionId : (selection.milk || [])[0];
  if (["fresh-milk", "thick-milk"].includes(nextMilk)
    && nextFruit.some((id) => ["lemon", "passionfruit"].includes(id))) {
    return "高酸水果遇鲜乳容易结絮，建议改用椰乳或植物奶";
  }
  if (groupId === "temperature" && ["热", "温"].includes(optionId) && (selection.fruit || []).length > 1) {
    return "热饮最多保留一种水果，风味会更稳定";
  }
  return "";
};

export const makeEmptySelection = () => Object.fromEntries(customDrinkGroups.map((group) => [group.id, []]));

export const selectionToPayload = (selection, sweetness, temperature) => ({
  groups: Object.fromEntries(customDrinkGroups.map((group) => [
    group.id,
    (selection[group.id] || []).map((id) => ({ id, name: findCustomOption(id)?.name || id })),
  ])),
  sweetness,
  temperature,
});

export const randomSelection = () => {
  const result = makeEmptySelection();
  const baseGroup = customDrinkGroups[0];
  result.base = [baseGroup.options[Math.floor(Math.random() * baseGroup.options.length)].id];
  const baseIsZero = findCustomOption(result.base[0])?.caffeineFree;
  for (const group of customDrinkGroups.slice(1)) {
    const desired = group.id === "fruit" ? 2 : group.id === "flavor" || group.id === "texture" ? 1 : Math.random() > .28 ? 1 : 0;
    const candidates = group.options.filter((item) => !(baseIsZero && item.caffeinated));
    result[group.id] = [...candidates].sort(() => Math.random() - .5).slice(0, Math.min(desired, group.max)).map((item) => item.id);
  }
  const milk = result.milk[0];
  if (["fresh-milk", "thick-milk"].includes(milk)) {
    result.fruit = result.fruit.filter((id) => !["lemon", "passionfruit"].includes(id));
  }
  return result;
};
