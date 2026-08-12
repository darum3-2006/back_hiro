<script setup lang="ts">
/**
 * タスクのスライドオーバー（詳細 / 新規登録）左端の幅リサイズハンドル。
 *
 * 親の `USlideover` は `:ui="{ content: 'sm:max-w-(--task-slideover-width)' }"` を指定し、
 * このコンポーネントを `#body` スロットの先頭に置いて使う。
 * 包含ブロックが `position: fixed` な content 要素なので、スクロールする body の中に
 * 置いてもパネル左端に貼り付いたままになる。
 */
const { width, isResizing, startResize, nudgeWidth, resetWidth } = useTaskSlideoverWidth();
</script>

<template>
  <!-- 幅指定が効くのは sm 以上（sm 未満は全画面）なので、そこでだけ出す -->
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="パネルの幅を変更"
    :aria-valuenow="width"
    :aria-valuemin="TASK_SLIDEOVER_MIN_WIDTH"
    tabindex="0"
    class="group absolute inset-y-0 left-0 z-10 hidden w-2 cursor-col-resize touch-none select-none focus:outline-none sm:block"
    @pointerdown="startResize"
    @dblclick="resetWidth"
    @keydown.left.prevent="nudgeWidth(1)"
    @keydown.right.prevent="nudgeWidth(-1)"
  >
    <div
      class="mx-auto h-full w-px transition-colors group-hover:bg-primary group-focus-visible:bg-primary"
      :class="{ 'bg-primary': isResizing }"
    />
  </div>
</template>
