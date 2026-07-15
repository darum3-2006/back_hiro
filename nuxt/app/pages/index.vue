<script setup lang="ts">
// トップ = 製品 LP（外部の見込み顧客向け）。
// - ログイン済みなら従来どおり自分のテナントへ振り分ける
// - 未ログインなら LP を表示する（auth ミドルウェアは `/` を対象外にしている）
definePageMeta({ layout: 'blank' });

const { token, me, fetchMe } = useAuth();
const ready = ref(false);

onMounted(async () => {
  if (token.value && !me.value) {
    await fetchMe();
  }
  if (me.value) {
    navigateTo(`/${me.value.tenant.key}`, { replace: true });
    return;
  }
  ready.value = true;
});

// ログイン導線: テナントキーを聞いてから各テナントのログイン画面へ送る
const loginOpen = ref(false);
const loginTenantKey = ref('');
const goLogin = () => {
  const key = loginTenantKey.value.trim();
  if (!key) return;
  navigateTo(`/${key}/login`);
};

/** スプレッドシート運用の課題 */
const pains = [
  {
    icon: 'i-lucide-eye-off',
    title: '「今どうなってる?」が追えない',
    description:
      '状況を知る人がバラバラで、最新の対応状況が分からない。更新しても誰が何を変えたのか記録が残らない。',
  },
  {
    icon: 'i-lucide-alarm-clock-off',
    title: '期限切れに気づけない',
    description:
      '期限列はあっても、通知してくれるのは人の目だけ。気づいたときには対応期限を過ぎている。',
  },
  {
    icon: 'i-lucide-rows-4',
    title: '1 行に収まらない仕事がある',
    description:
      '大きな依頼は 1 行では管理しきれず、細かい作業は行が増えて埋もれる。依頼と作業の粒度が合わない。',
  },
];

/** 主要 3 ビュー + 詳細パネルの紹介 */
const views = [
  {
    image: '/lp/tasks.png',
    alt: 'タスク一覧画面のスクリーンショット',
    label: 'タスク一覧',
    title: 'スプレッドシートの見やすさを、そのままに',
    description:
      '列の表示・並び順・幅を自由に調整できる一覧ビュー。フィルタやソートの組み合わせは「ビュー」として保存して、チームで共有できます。複数タスクの一括編集にも対応。',
    points: [
      '列のカスタマイズと保存ビュー',
      'ステータス・担当・期限などの複合フィルタ',
      '一括編集・フラグ操作',
    ],
  },
  {
    image: '/lp/board.png',
    alt: 'カンバンボード画面のスクリーンショット',
    label: 'ボード',
    title: '進行状況を、ひと目で',
    description:
      'ステータスごとに並ぶカンバンボード。カードをドラッグするだけでステータスを更新できます。サブタスクの進捗もカード上で確認できます。',
    points: [
      'ドラッグ & ドロップでステータス更新',
      'サブタスク進捗をカードに表示',
      '一覧と共通のフィルタ',
    ],
  },
  {
    image: '/lp/gantt.png',
    alt: 'ガントチャート画面のスクリーンショット',
    label: 'ガント',
    title: '予定と依存関係を、時間軸で',
    description:
      '着手予定日から完了予定日までをバーで可視化。タスク間の先行・後続やブロック関係を設定すれば、スケジュールの矛盾も警告します。',
    points: ['日・週・月の粒度切り替え', 'タスク間の依存関係と違反警告', '期限超過の強調表示'],
  },
  {
    image: '/lp/detail.png',
    alt: 'タスク詳細画面のスクリーンショット',
    label: 'タスク詳細',
    title: '議論も履歴も、タスクに集約',
    description:
      'サブタスクへの分解、Markdown 対応のコメント、@メンション、変更履歴。1 つのタスクに関わる情報がすべて 1 か所に残ります。',
    points: [
      'サブタスクで作業を分解',
      'Markdown コメントと @メンション',
      '誰が・いつ・何を変えたかの変更履歴',
    ],
  },
];

/** そのほかの機能 */
const features = [
  {
    icon: 'i-lucide-bookmark',
    title: '保存ビューと共有リンク',
    description: 'よく使う絞り込みを保存し、短縮 URL でチームに共有。',
  },
  {
    icon: 'i-lucide-bell',
    title: 'リアルタイム通知',
    description: '担当割り当てやステータス変更を、アプリ内へ即時に通知。',
  },
  {
    icon: 'i-lucide-messages-square',
    title: 'Slack 連携',
    description: 'タスクの作成・完了などをプロジェクトごとに Slack へ通知。',
  },
  {
    icon: 'i-lucide-braces',
    title: '公開 API',
    description: 'API キーで外部システムから読み書き。OpenAPI ドキュメント付き。',
  },
  {
    icon: 'i-lucide-history',
    title: '変更履歴（監査ログ）',
    description: 'すべての変更を記録。「いつ誰が変えたか」で揉めない。',
  },
  {
    icon: 'i-lucide-shield-check',
    title: 'Google SSO',
    description: 'パスワードレスで安全にログイン。組織のアカウント運用に沿う。',
  },
  {
    icon: 'i-lucide-sliders-horizontal',
    title: 'プロジェクトごとのワークフロー',
    description: 'ステータス・優先度・タグはプロジェクト単位で自由に定義。',
  },
  {
    icon: 'i-lucide-building-2',
    title: '部署・依頼元の管理',
    description: 'どの部署からの依頼かを記録し、横断で把握できる。',
  },
  {
    icon: 'i-lucide-search',
    title: '横断検索',
    description: 'タイトル・説明・番号からプロジェクトを横断して検索。',
  },
];
</script>

<template>
  <div v-if="ready" class="min-h-screen bg-default text-default">
    <!-- ヘッダー -->
    <header
      class="sticky top-0 z-40 border-b border-default bg-default/80 backdrop-blur supports-[backdrop-filter]:bg-default/60"
    >
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-list-checks" class="size-6 text-primary" />
          <span class="text-lg font-bold tracking-tight">バクひろ</span>
        </div>
        <UButton variant="outline" color="neutral" @click="loginOpen = true">ログイン</UButton>
      </div>
    </header>

    <main>
      <!-- ヒーロー -->
      <section class="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
        <UBadge variant="subtle" size="lg" class="mb-6">
          システム改修対応のためのプロジェクト管理ツール
        </UBadge>
        <h1
          class="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-highlighted sm:text-5xl"
        >
          その改修対応一覧、<br class="sm:hidden" />スプレッドシートのままにしない。
        </h1>
        <p class="mx-auto mt-6 max-w-2xl text-base text-muted sm:text-lg">
          バクひろは、システム改修・開発依頼の対応状況をチームで一元管理するツール。
          使い慣れた一覧の手軽さはそのままに、ボード・ガント・通知・API 連携までこれひとつで。
        </p>
        <div class="mt-16">
          <img
            src="/lp/tasks.png"
            alt="バクひろのタスク一覧画面"
            class="w-full rounded-xl border border-default shadow-2xl"
          />
        </div>
      </section>

      <!-- 課題 -->
      <section class="border-t border-default bg-muted/50">
        <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 class="text-center text-2xl font-bold text-highlighted sm:text-3xl">
            スプレッドシート管理、こんな限界はありませんか?
          </h2>
          <div class="mt-10 grid gap-6 sm:grid-cols-3">
            <div
              v-for="pain in pains"
              :key="pain.title"
              class="rounded-lg border border-default bg-default p-6"
            >
              <UIcon :name="pain.icon" class="size-7 text-error" />
              <h3 class="mt-4 font-semibold text-highlighted">{{ pain.title }}</h3>
              <p class="mt-2 text-sm text-muted">{{ pain.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 主要ビュー紹介 -->
      <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 class="text-center text-2xl font-bold text-highlighted sm:text-3xl">
          チームの見たい形で、同じデータを
        </h2>
        <p class="mx-auto mt-4 max-w-2xl text-center text-muted">
          一覧・ボード・ガントはワンクリックで切り替え。フィルタは画面をまたいで共有されます。
        </p>
        <div class="mt-14 space-y-20">
          <div
            v-for="(view, i) in views"
            :key="view.label"
            class="grid items-center gap-8 lg:grid-cols-2 lg:gap-12"
          >
            <div :class="i % 2 === 1 ? 'lg:order-2' : ''">
              <UBadge variant="subtle" color="primary">{{ view.label }}</UBadge>
              <h3 class="mt-3 text-xl font-bold text-highlighted sm:text-2xl">{{ view.title }}</h3>
              <p class="mt-3 text-muted">{{ view.description }}</p>
              <ul class="mt-5 space-y-2">
                <li
                  v-for="point in view.points"
                  :key="point"
                  class="flex items-start gap-2 text-sm"
                >
                  <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{{ point }}</span>
                </li>
              </ul>
            </div>
            <div :class="i % 2 === 1 ? 'lg:order-1' : ''">
              <img
                :src="view.image"
                :alt="view.alt"
                loading="lazy"
                class="w-full rounded-xl border border-default shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- 機能グリッド -->
      <section class="border-t border-default bg-muted/50">
        <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 class="text-center text-2xl font-bold text-highlighted sm:text-3xl">
            日々の運用を支える機能
          </h2>
          <div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="feature in features"
              :key="feature.title"
              class="rounded-lg border border-default bg-default p-5"
            >
              <div class="flex items-center gap-3">
                <UIcon :name="feature.icon" class="size-5 shrink-0 text-primary" />
                <h3 class="font-semibold text-highlighted">{{ feature.title }}</h3>
              </div>
              <p class="mt-2 text-sm text-muted">{{ feature.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- クロージング -->
      <section class="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <h2 class="text-2xl font-bold text-highlighted sm:text-3xl">
          改修対応の管理を、次のかたちへ。
        </h2>
        <p class="mx-auto mt-4 max-w-xl text-muted">
          すでにアカウントをお持ちの方は、テナントの URL からログインしてください。
        </p>
        <UButton size="lg" class="mt-8" @click="loginOpen = true">ログイン</UButton>
      </section>
    </main>

    <!-- フッター -->
    <footer class="border-t border-default">
      <div
        class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6"
      >
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-list-checks" class="size-4 text-primary" />
          <span class="font-semibold text-default">バクひろ</span>
        </div>
        <p>&copy; 2026 バクひろ</p>
      </div>
    </footer>

    <!-- ログイン導線モーダル: テナントキーを聞いて各テナントのログイン画面へ -->
    <AppModal v-model:open="loginOpen" title="ログイン">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-muted">
            ご契約中のテナントキーを入力してください。ログイン画面へ移動します。
          </p>
          <UInput
            v-model="loginTenantKey"
            placeholder="例: your-tenant"
            icon="i-lucide-building"
            class="w-full"
            @keydown.enter="goLogin"
          />
          <UButton block :disabled="!loginTenantKey.trim()" @click="goLogin">
            ログイン画面へ
          </UButton>
        </div>
      </template>
    </AppModal>
  </div>
</template>
