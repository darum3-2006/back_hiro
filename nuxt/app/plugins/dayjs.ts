import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
dayjs.locale('ja');

export default defineNuxtPlugin(() => {
  // dayjs はモジュール scope で初期化済み。Nuxt plugin はトリガー目的のみ。
});
