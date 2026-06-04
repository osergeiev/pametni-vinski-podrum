<template>
  <main class="auth-page">
    <div class="auth-card">
      <div class="auth-brand">
        <i class="ti ti-bottle" aria-hidden="true"></i>
        <h1>Pametni Vinski Podrum</h1>
        <p class="auth-sub">IoT Monitoring · {{ mode === 'login' ? 'Prijava' : 'Registracija' }}</p>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <div class="field">
          <label>Email</label>
          <input
            v-model.trim="email"
            type="email"
            required
            autocomplete="email"
            placeholder="ime@primjer.hr"
          />
        </div>

        <div class="field">
          <label>Lozinka</label>
          <input
            v-model="password"
            type="password"
            required
            minlength="6"
            autocomplete="current-password"
            placeholder="••••••••"
          />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>
        <p v-if="info" class="auth-info">{{ info }}</p>

        <button class="auth-submit" :disabled="busy" type="submit">
          <i class="ti ti-login-2" aria-hidden="true"></i>
          {{ busy ? 'Pričekajte…' : mode === 'login' ? 'Prijavi se' : 'Registriraj se' }}
        </button>
      </form>

      <div class="auth-switch">
        <span v-if="mode === 'login'">
          Nemate račun?
          <button type="button" @click="toggleMode">Registrirajte se</button>
        </span>
        <span v-else>
          Već imate račun?
          <button type="button" @click="toggleMode">Prijavite se</button>
        </span>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const mode = ref('login')
const email = ref('')
const password = ref('')
const error = ref('')
const info = ref('')
const busy = ref(false)

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
  info.value = ''
}

async function submit() {
  error.value = ''
  info.value = ''
  busy.value = true
  try {
    if (mode.value === 'login') {
      await auth.signIn(email.value, password.value)
    } else {
      const data = await auth.signUp(email.value, password.value)
      if (!data.session) {
        info.value = 'Račun kreiran. Provjerite email za potvrdu, zatim se prijavite.'
        mode.value = 'login'
        return
      }
    }
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (err) {
    error.value = translateError(err.message)
  } finally {
    busy.value = false
  }
}

function translateError(msg = '') {
  if (/invalid login credentials/i.test(msg)) return 'Neispravan email ili lozinka.'
  if (/already registered/i.test(msg)) return 'Korisnik s ovim emailom već postoji.'
  if (/password should be at least/i.test(msg)) return 'Lozinka mora imati barem 6 znakova.'
  return msg || 'Došlo je do greške.'
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  background: #2a1208;
  border: 1px solid rgba(180, 120, 60, 0.25);
  border-radius: 16px;
  padding: 2.5rem 2rem;
}

.auth-brand {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-brand i {
  font-size: 2.4rem;
  color: #d4a96a;
}

.auth-brand h1 {
  font-size: 1.4rem;
  font-weight: 400;
  font-style: italic;
  color: #d4a96a;
  margin-top: 0.5rem;
  letter-spacing: 0.03em;
}

.auth-sub {
  font-size: 0.7rem;
  color: #8a6840;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-family: 'Courier New', monospace;
  margin-top: 6px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field label {
  display: block;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8a6840;
  font-family: 'Courier New', monospace;
  margin-bottom: 6px;
}

.field input {
  width: 100%;
  background: #1a0a05;
  border: 1px solid rgba(180, 120, 60, 0.3);
  border-radius: 8px;
  padding: 11px 12px;
  color: #f0e6d3;
  font-size: 0.9rem;
  font-family: 'Courier New', monospace;
  outline: none;
  transition: border-color 0.2s;
}
.field input:focus { border-color: rgba(212, 169, 106, 0.6); }

.auth-error {
  color: #e06a5a;
  font-size: 0.78rem;
  font-family: 'Courier New', monospace;
}
.auth-info {
  color: #4a8a5a;
  font-size: 0.78rem;
  font-family: 'Courier New', monospace;
}

.auth-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 0.5rem;
  background: rgba(212, 169, 106, 0.18);
  border: 1px solid rgba(212, 169, 106, 0.45);
  color: #d4a96a;
  padding: 12px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
}
.auth-submit:hover:not(:disabled) { background: rgba(212, 169, 106, 0.3); }
.auth-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.auth-switch {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.78rem;
  color: #8a6840;
  font-family: 'Courier New', monospace;
}
.auth-switch button {
  background: none;
  border: none;
  color: #d4a96a;
  cursor: pointer;
  text-decoration: underline;
  font-family: inherit;
  font-size: inherit;
}
</style>
