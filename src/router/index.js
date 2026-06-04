import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'rooms',
      component: () => import('../views/RoomsView.vue'),
    },
    {
      path: '/rooms/:id',
      name: 'room',
      component: () => import('../views/RoomView.vue'),
      props: true,
    },
  ],
})

// Auth guard: redirect unauthenticated users to /login, and keep
// authenticated users away from the login page.
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.loading) {
    await auth.init()
  }

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'rooms' }
  }
  return true
})

export default router
