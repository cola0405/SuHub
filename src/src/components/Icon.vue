<script setup lang="ts">
defineProps<{ name: string; size?: number }>()
</script>

<template>
  <svg
    :width="size ?? 16"
    :height="size ?? 16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <template v-if="name === 'all'">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" />
    </template>
    <template v-else-if="name === 'video'">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <path d="M6.5 5.8v4.4L10.5 8z" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'image'">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <circle cx="5.5" cy="6.2" r="1.2" />
      <path d="M2.5 12l3.8-3.8 2.6 2.6 2-2 3.1 3.1" />
    </template>
    <template v-else-if="name === 'audio'">
      <path d="M6 12.2V3.5l6-1.2v8.4" />
      <circle cx="4.4" cy="12.4" r="1.7" />
      <circle cx="10.4" cy="10.9" r="1.7" />
    </template>
    <template v-else-if="name === 'folder'">
      <path d="M1.5 4.2c0-.6.5-1.1 1.1-1.1h3l1.6 1.8h6.2c.6 0 1.1.5 1.1 1.1v6.2c0 .6-.5 1.1-1.1 1.1H2.6c-.6 0-1.1-.5-1.1-1.1z" />
    </template>
    <template v-else-if="name === 'tag'">
      <path d="M8.4 1.8H13c.6 0 1 .4 1 1v4.6c0 .3-.1.5-.3.7l-6 6c-.4.4-1 .4-1.4 0l-4.3-4.3c-.4-.4-.4-1 0-1.4l6-6c.2-.2.5-.3.8-.3z" />
      <circle cx="11" cy="5" r="1" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M8 3v10M3 8h10" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="M4 4l8 8M12 4l-8 8" />
    </template>
    <template v-else-if="name === 'pencil'">
      <path d="M10.7 2.4l2.9 2.9L5.6 13.3l-3.4.6.6-3.4z" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M2.5 4.5h11M6.5 2.5h3M5.5 4.5l.5 9h4l.5-9" />
    </template>
    <template v-else-if="name === 'missing'">
      <path d="M8 1.8a6.2 6.2 0 100 12.4A6.2 6.2 0 008 1.8z" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </template>
    <template v-else-if="name === 'play'">
      <path d="M4.5 3l8 5-8 5z" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'pause'">
      <path d="M4.5 3v10M11.5 3v10" stroke-width="2" />
    </template>
    <template v-else-if="name === 'left'">
      <path d="M10 3L5 8l5 5" />
    </template>
    <template v-else-if="name === 'right'">
      <path d="M6 3l5 5-5 5" />
    </template>
    <template v-else-if="name === 'refresh'">
      <path d="M13.5 8a5.5 5.5 0 11-1.6-3.9M13.5 2.5v2.6h-2.6" />
    </template>
  </svg>
</template>
