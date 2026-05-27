<template>
  <RouterView />
</template>

<style>
@import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: #1a0a05;
  color: #f0e6d3;
  font-family: 'Georgia', serif;
  min-height: 100vh;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #1a0a05; }
::-webkit-scrollbar-thumb { background: rgba(180, 120, 60, 0.3); border-radius: 3px; }
</style>
