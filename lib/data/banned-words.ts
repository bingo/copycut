/**
 * F-63 发布预检:小红书风险词词典(纯本地检测,不调用外部 API)。
 * 词条基于《广告法》第九条与平台社区规范的公开常识整理,
 * 仅收录高置信度词,检测结果供人工复核,不代表平台最终审核结论。
 */

export type BannedWordCategory = "absolute" | "medical" | "inducement" | "marketing";

export interface BannedWordGroup {
  id: BannedWordCategory;
  /** 类别名 */
  name: string;
  /** 风险说明 */
  risk: string;
  /** 改写建议方向 */
  suggestion: string;
  words: string[];
}

export const BANNED_WORD_GROUPS: BannedWordGroup[] = [
  {
    id: "absolute",
    name: "绝对化用语",
    risk: "《广告法》第九条禁止使用绝对化用语,带货/商单笔记命中易被限流或处罚",
    suggestion: "改为具体、可验证的描述,如「最好用」→「我用过里面很顺手的一款」",
    words: [
      "最好", "最佳", "最优", "最强", "最先进", "最高级", "最低价", "最便宜",
      "第一", "唯一", "首选", "顶级", "极品", "王牌", "冠军",
      "国家级", "世界级", "全球首发", "全网首发", "绝无仅有", "史无前例",
      "万能", "百分之百", "100%", "NO.1", "No.1", "独一无二", "空前绝后",
    ],
  },
  {
    id: "medical",
    name: "医疗功效宣称",
    risk: "非药品/医疗器械不得宣称疾病治疗功能,美妆、食品类笔记命中风险最高",
    suggestion: "改为主观体感描述,如「消炎」→「用完感觉舒缓多了」,避免疗效承诺",
    words: [
      "治疗", "治愈", "根治", "药用", "药效", "消炎", "抗炎", "杀菌", "抗菌",
      "抗病毒", "止痛", "镇痛", "降血压", "降血糖", "降血脂", "抗癌", "防癌",
      "排毒", "祛疤", "生发", "无副作用", "药到病除",
    ],
  },
  {
    id: "inducement",
    name: "诱导互动/站外导流",
    risk: "利诱关注点赞、引导加微信或站外交易违反社区规范,易被限流甚至封禁",
    suggestion: "删除导流信息,互动引导改为自然表达,如「有问题评论区聊」",
    words: [
      "加微信", "加vx", "加V", "微信号", "QQ群", "扫码进群", "私信我领",
      "点击链接", "复制链接", "淘口令", "下单链接",
      "关注返现", "关注有礼", "关注抽奖", "转发抽奖", "点赞抽奖", "评论抽奖",
      "互粉", "互赞", "点关注不迷路", "领红包",
    ],
  },
  {
    id: "marketing",
    name: "极限营销词",
    risk: "虚假紧迫感与夸大承诺属于违规营销话术,商业笔记命中易被判定虚假宣传",
    suggestion: "改为真实信息,如「全网最低价」→「近期有活动价」,不做效果承诺",
    words: [
      "秒杀", "疯抢", "仅此一天", "错过不再", "史上最低", "击穿底价",
      "亏本甩卖", "全网最低价", "不买后悔", "买到就是赚到", "手慢无",
      "零风险", "稳赚不赔", "躺赚", "一夜暴富", "无效退款",
      "立竿见影", "永不反弹", "三天见效", "七天见效",
    ],
  },
];

export interface BannedWordHit {
  word: string;
  category: BannedWordCategory;
}

/** 对文本做全量子串匹配,返回去重后的命中词(按词典顺序) */
export function detectBannedWords(text: string): BannedWordHit[] {
  if (!text) return [];
  const hits: BannedWordHit[] = [];
  for (const group of BANNED_WORD_GROUPS) {
    for (const word of group.words) {
      if (text.includes(word)) hits.push({ word, category: group.id });
    }
  }
  return hits;
}
