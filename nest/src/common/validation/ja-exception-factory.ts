import { BadRequestException, ValidationError } from '@nestjs/common';

/**
 * フィールド名 → 日本語表示名のマップ。
 * DTO の property 名を網羅。最後の階層名でマッチ（例: links.0.url → url）。
 */
const FIELD_LABELS: Record<string, string> = {
  // 認証
  email: 'メールアドレス',
  password: 'パスワード',
  tenantKey: 'テナントキー',
  // 共通
  name: '名前',
  description: '説明',
  key: 'キー',
  code: 'コード',
  label: 'ラベル',
  color: '色',
  archived: 'アーカイブ',
  // メンバー
  displayName: '表示名',
  userId: 'ユーザー',
  role: 'ロール',
  // マスタ
  isTerminal: '完了状態',
  direction: '並び方向',
  orderedCodes: '並び順',
  // タスク
  content: '内容',
  links: 'リンク',
  statusCode: 'ステータス',
  priorityCode: '優先度',
  assigneeMemberId: '担当者',
  requesterMemberId: '起票者',
  requestingDeptCode: '依頼部署',
  deadline: '期限',
  plannedCompletionDate: '完了予定日',
  tagCodes: 'タグ',
  tagCode: 'タグ',
  url: 'URL',
};

const labelOf = (path: string): string => {
  // links.0.url のような path から数字部分を除いた最後のキーで lookup
  const last =
    path
      .split('.')
      .filter((p) => !/^\d+$/.test(p))
      .pop() ?? path;
  return FIELD_LABELS[last] ?? last;
};

const firstNumber = (s: string): number | null => {
  const m = /(\d+)/.exec(s);
  return m ? Number(m[1]) : null;
};

const constraintMessage = (path: string, key: string, originalMessage: string): string => {
  const label = labelOf(path);
  switch (key) {
    case 'isString':
      return `${label} は文字列で指定してください`;
    case 'isUrl':
      return `${label} は有効な URL を指定してください`;
    case 'isEmail':
      return `${label} は有効なメールアドレスを指定してください`;
    case 'isUUID':
      return `${label} は UUID 形式で指定してください`;
    case 'isBoolean':
      return `${label} は真偽値で指定してください`;
    case 'isInt':
    case 'isNumber':
      return `${label} は数値で指定してください`;
    case 'isArray':
      return `${label} は配列で指定してください`;
    case 'isDateString':
      return `${label} は日付形式 (YYYY-MM-DD) で指定してください`;
    case 'isIn': {
      const m = /must be one of the following values: (.+)$/.exec(originalMessage);
      const values = m?.[1] ?? '';
      return `${label} は ${values} のいずれかで指定してください`;
    }
    case 'isNotEmpty':
      return `${label} を指定してください`;
    case 'minLength': {
      const n = firstNumber(originalMessage);
      return n !== null
        ? `${label} は ${n} 文字以上で指定してください`
        : `${label} の長さが不足しています`;
    }
    case 'maxLength': {
      const n = firstNumber(originalMessage);
      return n !== null
        ? `${label} は ${n} 文字以下で指定してください`
        : `${label} の長さが上限を超えています`;
    }
    case 'min': {
      const n = firstNumber(originalMessage);
      return n !== null ? `${label} は ${n} 以上で指定してください` : `${label} が小さすぎます`;
    }
    case 'max': {
      const n = firstNumber(originalMessage);
      return n !== null ? `${label} は ${n} 以下で指定してください` : `${label} が大きすぎます`;
    }
    case 'arrayUnique':
      return `${label} に重複があります`;
    case 'arrayMaxSize': {
      const n = firstNumber(originalMessage);
      return n !== null
        ? `${label} は ${n} 個以下で指定してください`
        : `${label} の件数が上限を超えています`;
    }
    case 'arrayMinSize': {
      const n = firstNumber(originalMessage);
      return n !== null
        ? `${label} は ${n} 個以上で指定してください`
        : `${label} の件数が不足しています`;
    }
    case 'whitelistValidation':
      return `不明なフィールド: ${path}`;
    default:
      return `${label}: ${originalMessage}`;
  }
};

export interface FieldError {
  /** ドット記法のパス（links.0.url 等） */
  field: string;
  message: string;
}

const collect = (errors: ValidationError[], parentPath = ''): FieldError[] => {
  const out: FieldError[] = [];
  for (const err of errors) {
    const path = parentPath ? `${parentPath}.${err.property}` : err.property;
    if (err.constraints) {
      for (const [key, msg] of Object.entries(err.constraints)) {
        out.push({ field: path, message: constraintMessage(path, key, msg) });
      }
    }
    if (err.children && err.children.length > 0) {
      out.push(...collect(err.children, path));
    }
  }
  return out;
};

export const jaExceptionFactory = (errors: ValidationError[]): BadRequestException => {
  const fieldErrors = collect(errors);
  const messages = fieldErrors.map((e) => e.message);
  return new BadRequestException({
    message: messages.length > 0 ? messages : ['入力に誤りがあります'],
    errors: fieldErrors,
    error: 'Bad Request',
    statusCode: 400,
  });
};
