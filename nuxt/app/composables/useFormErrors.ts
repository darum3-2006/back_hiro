interface ApiFieldError {
  field: string;
  message: string;
}

interface ApiErrorData {
  message?: string | string[];
  errors?: ApiFieldError[];
}

/**
 * フォーム単位のフィールドエラー保持。
 *
 * - submit 時に catch で setFromApiError(e) を呼ぶ
 * - UFormField の :error="errors.xxx" にバインド
 * - 入力変更時に clearField('xxx') を呼べば該当エラーを消せる
 */
export const useFormErrors = () => {
  const errors = ref<Record<string, string>>({});
  const generalMessage = ref<string | null>(null);

  const clear = () => {
    errors.value = {};
    generalMessage.value = null;
  };

  const clearField = (field: string) => {
    if (field in errors.value) {
      errors.value = Object.fromEntries(
        Object.entries(errors.value).filter(([k]) => k !== field),
      );
    }
  };

  const setFromApiError = (e: unknown) => {
    clear();
    const data =
      typeof e === 'object' && e !== null && 'data' in e
        ? ((e as { data?: ApiErrorData }).data ?? null)
        : null;
    if (!data) {
      generalMessage.value = '通信エラーが発生しました';
      return;
    }
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const map: Record<string, string> = {};
      for (const err of data.errors) {
        if (typeof err.field === 'string' && typeof err.message === 'string') {
          // 同一フィールドに複数エラーが来た場合は最初のメッセージを優先
          if (!map[err.field]) map[err.field] = err.message;
        }
      }
      errors.value = map;
      return;
    }
    // errors が無い（401/403/409/500 等）。フィールドにマップせず汎用に
    if (Array.isArray(data.message)) {
      generalMessage.value = data.message.join(', ');
    } else if (typeof data.message === 'string') {
      generalMessage.value = data.message;
    } else {
      generalMessage.value = 'エラーが発生しました';
    }
  };

  return { errors, generalMessage, clear, clearField, setFromApiError };
};
