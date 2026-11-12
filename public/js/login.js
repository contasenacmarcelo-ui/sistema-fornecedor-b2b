const authTabs = [...document.querySelectorAll("[data-auth-tab]")]
const loginForm = document.getElementById("login-form")
const registerForm = document.getElementById("register-form")

function setFeedback(id, message, isError = false) {
    const element = document.getElementById(id)
    element.textContent = message
    element.classList.toggle("error", isError)
}

function showAuthMode(mode) {
    const registering = mode === "register"
    loginForm.hidden = registering
    registerForm.hidden = !registering
    document.getElementById("auth-title").textContent = registering ? "Crie sua conta de lojista" : "Boas-vindas de volta"
    document.getElementById("auth-subtitle").textContent = registering
        ? "Cadastre sua empresa para começar a comprar."
        : "Acesse sua conta para continuar."

    authTabs.forEach((tab) => {
        const selected = tab.dataset.authTab === mode
        tab.classList.toggle("active", selected)
        tab.setAttribute("aria-selected", String(selected))
    })
}

async function sendJson(path, payload) {
    const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    const data = await response.json()
    if (!response.ok || data.erro) {
        throw new Error(data.erro || "Não foi possível concluir a solicitação.")
    }
    return data
}

function redirectByRole(user) {
    if (user.role === "admin") {
        window.location.replace("/pages/admin.html")
    } else if (user.role === "client") {
        window.location.replace("/pages/client.html")
    } else {
        throw new Error("Perfil de usuário inválido.")
    }
}

authTabs.forEach((tab) => {
    tab.addEventListener("click", () => showAuthMode(tab.dataset.authTab))
})

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    const button = loginForm.querySelector('button[type="submit"]')
    button.disabled = true
    setFeedback("login-feedback", "")

    try {
        const formData = new FormData(loginForm)
        const result = await sendJson("/auth/login", Object.fromEntries(formData.entries()))
        redirectByRole(result.usuario)
    } catch (error) {
        setFeedback("login-feedback", error.message, true)
    } finally {
        button.disabled = false
    }
})

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    const button = registerForm.querySelector('button[type="submit"]')
    button.disabled = true
    setFeedback("register-feedback", "")

    try {
        const formData = new FormData(registerForm)
        const payload = Object.fromEntries(formData.entries())
        payload.nome_empresa = payload.nome_empresa.trim()
        payload.cnpj = payload.cnpj.trim()
        payload.email = payload.email.trim().toLowerCase()

        const result = await sendJson("/users", payload)
        setFeedback("register-feedback", result.sucesso || "Conta criada. Faça login.")
        loginForm.elements.email.value = payload.email
        registerForm.reset()
        showAuthMode("login")
        setFeedback("login-feedback", "Conta criada. Entre com seu e-mail e senha.")
    } catch (error) {
        setFeedback("register-feedback", error.message, true)
    } finally {
        button.disabled = false
    }
})

document.getElementById("current-year").textContent = String(new Date().getFullYear())

fetch("/auth/me")
    .then(async (response) => {
        if (!response.ok) return null
        const data = await response.json()
        return data.usuario
    })
    .then((user) => {
        if (user) redirectByRole(user)
    })
    .catch(() => {
        setFeedback("login-feedback", "Não foi possível verificar a sessão. Tente novamente.", true)
    })
