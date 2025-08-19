# Vue.js Patterns

Modern Vue patterns with Vue 3 Composition API.

## Composition API

### Setup Function
```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// Reactive state
const count = ref(0);
const doubled = computed(() => count.value * 2);

// Methods
const increment = () => {
  count.value++;
};

// Lifecycle
onMounted(() => {
  console.log('Component mounted');
});
</script>

<template>
  <button @click="increment">
    Count: {{ count }} (Doubled: {{ doubled }})
  </button>
</template>
```

## Composables

### Custom Composables
```typescript
// composables/useUser.ts
import { ref, computed } from 'vue';

export function useUser() {
  const user = ref(null);
  const isLoggedIn = computed(() => !!user.value);
  
  const login = async (credentials) => {
    const response = await api.login(credentials);
    user.value = response.data;
  };
  
  const logout = () => {
    user.value = null;
  };
  
  return {
    user: readonly(user),
    isLoggedIn,
    login,
    logout
  };
}

// Usage
const { user, isLoggedIn, login } = useUser();
```

### Fetch Composable
```typescript
export function useFetch<T>(url: string) {
  const data = ref<T | null>(null);
  const error = ref<Error | null>(null);
  const loading = ref(true);
  
  const fetchData = async () => {
    try {
      loading.value = true;
      const response = await fetch(url);
      data.value = await response.json();
    } catch (e) {
      error.value = e as Error;
    } finally {
      loading.value = false;
    }
  };
  
  onMounted(fetchData);
  
  return { data, error, loading, refetch: fetchData };
}
```

## State Management (Pinia)

### Store Definition
```typescript
import { defineStore } from 'pinia';

export const useCounterStore = defineStore('counter', () => {
  // State
  const count = ref(0);
  
  // Getters
  const doubled = computed(() => count.value * 2);
  
  // Actions
  function increment() {
    count.value++;
  }
  
  return { count, doubled, increment };
});

// Usage
const store = useCounterStore();
store.increment();
```

## Component Patterns

### Props and Emits
```vue
<script setup lang="ts">
interface Props {
  title: string;
  count?: number;
}

const props = withDefaults(defineProps<Props>(), {
  count: 0
});

const emit = defineEmits<{
  update: [value: number];
  delete: [];
}>();

const handleClick = () => {
  emit('update', props.count + 1);
};
</script>
```

### Slots
```vue
<!-- BaseCard.vue -->
<template>
  <div class="card">
    <div class="card-header">
      <slot name="header" />
    </div>
    <div class="card-body">
      <slot />
    </div>
    <div class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<!-- Usage -->
<BaseCard>
  <template #header>
    <h2>Title</h2>
  </template>
  
  Main content
  
  <template #footer>
    <button>Action</button>
  </template>
</BaseCard>
```

## Reactivity

### Watch and WatchEffect
```typescript
// watch: Monitor specific values
watch(count, (newValue, oldValue) => {
  console.log(`Count changed: ${oldValue} -> ${newValue}`);
});

// watchEffect: Auto-track dependencies
watchEffect(() => {
  console.log(`The count is ${count.value}`);
});

// Options
watch(
  user,
  (newUser) => {
    saveToLocalStorage(newUser);
  },
  { immediate: true, deep: true }
);
```

## Performance

### Dynamic Imports
```typescript
// Route-level lazy loading
const UserProfile = () => import('./views/UserProfile.vue');

// Component-level
const AsyncComponent = defineAsyncComponent(() =>
  import('./components/AsyncComponent.vue')
);
```

### v-memo Directive
```vue
<template>
  <!-- Skip re-render if dependencies unchanged -->
  <div v-for="item in list" :key="item.id" v-memo="[item.id, item.name]">
    {{ expensiveOperation(item) }}
  </div>
</template>
```

## Checklist
- [ ] Composition API used
- [ ] Composables utilized
- [ ] Pinia state management
- [ ] TypeScript integration
- [ ] Props/Emits typed
- [ ] Performance optimized
- [ ] Reactivity managed