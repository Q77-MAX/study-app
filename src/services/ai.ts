import type { AISettings, Question } from '../types';
import { AI_PROVIDERS } from '../types';

// ============ AI 提供商 API 调用 ============

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

function getHeaders(settings: AISettings): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (settings.provider === 'anthropic') {
    headers['x-api-key'] = settings.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }

  return headers;
}

function getURL(settings: AISettings): string {
  if (settings.provider === 'anthropic') {
    return `${settings.baseURL || AI_PROVIDERS.anthropic.defaultBaseURL}/messages`;
  }
  const base = settings.baseURL || AI_PROVIDERS[settings.provider].defaultBaseURL;
  return `${base}/chat/completions`;
}

async function callAI(
  settings: AISettings,
  systemPrompt: string,
  messages: ChatMessage[],
): Promise<string> {
  const isAnthropic = settings.provider === 'anthropic';
  const model = settings.model || AI_PROVIDERS[settings.provider].defaultModel;

  let body: any;

  if (isAnthropic) {
    // Anthropic API 格式
    const anthropicMessages: { role: string; content: any }[] = [];
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        anthropicMessages.push({ role: msg.role, content: msg.content });
      } else {
        // 多模态内容
        const contentBlocks: any[] = [];
        for (const part of msg.content) {
          if (part.type === 'text') {
            contentBlocks.push({ type: 'text', text: part.text || '' });
          } else if (part.type === 'image_url' && part.image_url) {
            // 处理 base64 图片
            const url = part.image_url.url;
            if (url.startsWith('data:image/')) {
              const [mimeType, data] = url.split(',');
              const mediaType = mimeType.split(':')[1].split(';')[0];
              contentBlocks.push({
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data },
              });
            }
          }
        }
        anthropicMessages.push({ role: msg.role, content: contentBlocks });
      }
    }

    body = {
      model,
      system: systemPrompt,
      messages: anthropicMessages,
      max_tokens: 4096,
    };
  } else {
    // OpenAI 兼容 API 格式
    const openaiMessages: ChatMessage[] = [];
    if (systemPrompt) {
      openaiMessages.push({ role: 'system', content: systemPrompt });
    }
    for (const msg of messages) {
      openaiMessages.push(msg);
    }

    body = {
      model,
      messages: openaiMessages,
      max_tokens: 4096,
      temperature: 0.3,
    };
  }

  const response = await fetch(getURL(settings), {
    method: 'POST',
    headers: getHeaders(settings),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI 请求失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (isAnthropic) {
    return data.content?.[0]?.text || '';
  } else {
    return data.choices?.[0]?.message?.content || '';
  }
}

// ============ 题目解析 Prompt（智能版：自动识别任意格式） ============

const PARSE_QUESTIONS_PROMPT = `你是一个专业的题库解析专家。用户会提供一段文本或表格数据（可能来自Word、Excel、PDF、网页、手打等多种来源），格式不固定。

你需要自动判断哪些是题目内容、选项、答案、解析、知识点等，并提取出来。

请严格按照以下 JSON 数组格式返回：
[
  {
    "type": "single/multiple/judge/fill/essay",
    "content": "题目正文",
    "options": ["A. 选项1", "B. 选项2"],
    "answer": "正确答案",
    "explanation": "解析说明",
    "knowledgePoints": ["知识点1", "知识点2"],
    "difficulty": 1-5的整数
  }
]

## 自动识别规则（按优先级）：
1. **查找题目**：任何看起来像考题/测试题的内容，不管前面有什么编号或标记
2. **识别题型**：
   - 有A/B/C/D选项的 → single（单选）或 multiple（多选，看答案是否多个字母）
   - 有"对/错"或"正确/错误"的 → judge（判断）
   - 有空缺/横线/括号待填的 → fill（填空）
   - 需要文字作答的 → essay（简答）
3. **查找答案**：找"答案："、"参考答案"、单独成行的字母、表格中的答案列等
4. **查找解析**：找"解析："、"解题思路"、"说明"等后面的文字
5. **识别知识点**：找章节标题、知识分类、标签等
6. **表格数据**：自动识别表头，判断每一列的含义（题型/题号/题干/选项/答案/解析/知识点），不依赖列顺序

## 如果你不确定某个字段，可以留空字符串或空数组。
## 请只返回 JSON 数组，不要有任何其他文字或解释。`;

// ============ 知识点识别 Prompt ============

const IDENTIFY_KNOWLEDGE_POINTS_PROMPT = `请分析以下题目内容，识别考查的知识点。
返回格式：{"knowledgePoints": ["知识点1", "知识点2"]}
知识点要具体准确（如"勾股定理"而非"数学"），每道题1-5个。
请只返回 JSON 对象。`;

// ============ AI 问答系统 Prompt ============

const AI_TUTOR_PROMPT = `你是一个专业的学习辅导老师。你会收到学生当前正在做的题目信息，请针对学生的问题进行解答。

要求：
1. 用通俗易懂的语言解释
2. 不要直接给出答案，引导学生思考
3. 如果学生答错了，分析可能的错误原因
4. 可以举相关的例子帮助理解
5. 回答简洁明了，控制在 200 字以内`;

// ============ 导出函数 ============

/**
 * 解析题目：从文本中提取结构化题目
 */
export async function parseQuestions(
  settings: AISettings,
  text: string,
): Promise<Partial<Question>[]> {
  const result = await callAI(settings, PARSE_QUESTIONS_PROMPT, [
    { role: 'user', content: text },
  ]);

  try {
    // 尝试从返回中提取 JSON 数组
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(result);
  } catch {
    console.error('AI 解析题目失败，原始返回:', result);
    throw new Error('题目解析失败，请检查文本格式后重试');
  }
}

/**
 * 从图片中识别题目（使用 Vision API）
 */
export async function parseQuestionsFromImage(
  settings: AISettings,
  imageBase64: string,
): Promise<Partial<Question>[]> {
  const result = await callAI(settings, PARSE_QUESTIONS_PROMPT, [
    {
      role: 'user',
      content: [
        { type: 'text', text: '请识别图片中的题目并解析。' },
        { type: 'image_url', image_url: { url: imageBase64 } },
      ],
    },
  ]);

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(result);
  } catch {
    console.error('AI 图片识别失败，原始返回:', result);
    throw new Error('图片识别失败，请确保图片清晰、题目完整');
  }
}

/**
 * 识别题目知识点
 */
export async function identifyKnowledgePoints(
  settings: AISettings,
  questionContent: string,
): Promise<string[]> {
  const result = await callAI(settings, IDENTIFY_KNOWLEDGE_POINTS_PROMPT, [
    { role: 'user', content: questionContent },
  ]);

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.knowledgePoints || [];
    }
    const parsed = JSON.parse(result);
    return parsed.knowledgePoints || [];
  } catch {
    return [];
  }
}

/**
 * AI 问答（多轮对话）
 */
export async function askAITutor(
  settings: AISettings,
  questionContext: string,
  conversation: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `当前题目信息：\n${questionContext}\n\n请针对以上题目，回答学生的问题。`,
    },
    ...conversation.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  return callAI(settings, AI_TUTOR_PROMPT, messages);
}

/**
 * 测试 AI 连接
 */
export async function testAIConnection(settings: AISettings): Promise<boolean> {
  try {
    await callAI(settings, '你是一个助手，请回复"OK"。', [
      { role: 'user', content: '测试连接，请回复OK' },
    ]);
    return true;
  } catch (error) {
    console.error('AI 连接测试失败:', error);
    return false;
  }
}
