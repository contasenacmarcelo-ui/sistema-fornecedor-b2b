const API_BASE = window.location.protocol === "file:"
    ? "http://localhost:3000"
    : window.location.origin

const state = {
    users: [],
    products: [],
    orders: [],
    movements: []
}

const tabTitles = {
    dashboard: "Visão geral",
    users: "Usuários",
    products: "Catálogo",
    orders: "Pedidos",
    stock: "Estoque"
}

const byId = (id) => document.getElementById(id)

async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    })

    let data
    try {
        data = await response.json()
    } catch (error) {
        throw new Error("O servidor retornou uma resposta inválida.")
    }

    if (!response.ok || data?.erro) {
        throw new Error(data?.erro || `Falha na requisição (${response.status}).`)
    }

    return data
}

function unwrapRows(data) {
    if (Array.isArray(data) && data.length === 1 && Array.isArray(data[0])) {
        return data[0]
    }
    return Array.isArray(data) ? data : []
}

function setMessage(id, message, isError = false) {
    const element = byId(id)
    element.textContent = message
    element.classList.toggle("error", isError)
}

function addCell(row, value, className = "") {
    const cell = document.createElement("td")
    cell.textContent = value === undefined || value === null || value === "" ? "—" : String(value)
    if (className) cell.className = className
    row.append(cell)
    return cell
}

function formatCurrency(value) {
    const amount = Number(value)
    if (!Number.isFinite(amount)) return "—"
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)
}

function formatDate(value) {
    if (!value) return "—"
    const date = new Date(value)
    return Number.isNaN(date.getTime())
        ? String(value)
        : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date)
}

function showTab(tabName) {
    document.querySelectorAll(".tab-panel").forEach((panel) => {
        const active = panel.id === `tab-${tabName}`
        panel.classList.toggle("active", active)
        panel.hidden = !active
    })

    document.querySelectorAll("[data-tab]").forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === tabName && button.classList.contains("nav-link"))
    })

    byId("page-title").textContent = tabTitles[tabName] || tabTitles.dashboard
}

function updateDashboard() {
    byId("stat-users").textContent = String(state.users.length)
    byId("stat-products").textContent = String(state.products.length)
    byId("stat-orders").textContent = String(state.orders.length)
    byId("stat-movements").textContent = String(state.movements.length)
}

function renderUsers() {
    const table = byId("users-table")
    table.replaceChildren()

    state.users.forEach((user) => {
        const row = document.createElement("tr")
        addCell(row, user.nome_empresa, "primary-cell")
        addCell(row, user.cnpj)
        addCell(row, user.email)
        addCell(row, user.role === "admin" ? "Administrador" : "Cliente")
        table.append(row)
    })

    byId("users-count").textContent = String(state.users.length)
    byId("users-empty").hidden = state.users.length > 0
    renderUserOptions()
    updateDashboard()
}

function renderUserOptions() {
    const select = byId("order-user")
    const selected = select.value
    select.replaceChildren(new Option("Selecione um usuário", ""))

    state.users.forEach((user) => {
        const option = new Option(user.nome_empresa || `Usuário #${user.id}`, user.id)
        select.append(option)
    })

    if (state.users.some((user) => String(user.id) === selected)) {
        select.value = selected
    }
}

function renderProducts() {
    const grid = byId("products-grid")
    const query = byId("product-search").value.trim().toLocaleLowerCase("pt-BR")
    const products = state.products.filter((product) => {
        const text = `${product.nome || ""} ${product.descricao || ""}`.toLocaleLowerCase("pt-BR")
        return text.includes(query)
    })
    grid.replaceChildren()

    products.forEach((product) => {
        const card = document.createElement("article")
        card.className = "card product-card"

        const imageArea = document.createElement("div")
        imageArea.className = "product-image"
        const safeImage = getSafeImageUrl(product.imagem)
        if (safeImage) {
            const image = document.createElement("img")
            image.src = safeImage
            image.alt = product.nome ? `Imagem de ${product.nome}` : "Imagem do produto"
            image.loading = "lazy"
            image.addEventListener("error", () => {
                image.replaceWith(makePlaceholder())
            }, { once: true })
            imageArea.append(image)
        } else {
            imageArea.append(makePlaceholder())
        }

        const content = document.createElement("div")
        content.className = "product-content"
        const name = document.createElement("h3")
        name.className = "product-name"
        name.textContent = product.nome || "Produto sem nome"
        const description = document.createElement("p")
        description.className = "product-description"
        description.textContent = product.descricao || "Sem descrição disponível."

        const meta = document.createElement("div")
        meta.className = "product-meta"
        const price = document.createElement("div")
        price.className = "product-price"
        const priceValue = document.createElement("strong")
        priceValue.textContent = formatCurrency(product.preco_atacado)
        const priceLabel = document.createElement("small")
        priceLabel.textContent = "PREÇO DE ATACADO"
        price.append(priceValue, priceLabel)

        const stock = document.createElement("span")
        const stockCount = Number(product.estoque)
        stock.className = `stock-badge${stockCount <= 5 ? " low" : ""}`
        stock.textContent = `${Number.isFinite(stockCount) ? stockCount : 0} em estoque`
        meta.append(price, stock)
        content.append(name, description, meta)
        card.append(imageArea, content)
        grid.append(card)
    })

    byId("products-count").textContent = `${products.length} ${products.length === 1 ? "produto" : "produtos"}`
    byId("products-empty").hidden = products.length > 0
    renderProductOptions()
    updateDashboard()
}

function makePlaceholder() {
    const placeholder = document.createElement("span")
    placeholder.className = "product-placeholder"
    placeholder.textContent = "▦"
    placeholder.setAttribute("aria-hidden", "true")
    return placeholder
}

function getSafeImageUrl(value) {
    if (!value || typeof value !== "string") return ""
    try {
        const url = new URL(value, API_BASE)
        return ["http:", "https:"].includes(url.protocol) ? url.href : ""
    } catch (error) {
        return ""
    }
}

function renderProductOptions() {
    const select = byId("movement-product")
    const selected = select.value
    select.replaceChildren(new Option("Selecione um produto", ""))

    state.products.forEach((product) => {
        const label = product.nome || `Produto #${product.id}`
        select.append(new Option(label, product.id))
    })

    if (state.products.some((product) => String(product.id) === selected)) {
        select.value = selected
    }
}

function renderOrders() {
    const table = byId("orders-table")
    table.replaceChildren()
    const usersById = new Map(state.users.map((user) => [String(user.id), user]))
    const orders = [...state.orders].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

    orders.forEach((order) => {
        const row = document.createElement("tr")
        addCell(row, `#${order.id}`, "primary-cell")
        addCell(row, usersById.get(String(order.user_id))?.nome_empresa || `Usuário #${order.user_id}`)
        addCell(row, formatDate(order.created_at))
        const statusCell = document.createElement("td")
        const badge = document.createElement("span")
        const status = order.status || "Pendente"
        badge.className = `status-badge ${status.toLocaleLowerCase("pt-BR")}`
        badge.textContent = status
        statusCell.append(badge)
        row.append(statusCell)
        addCell(row, formatCurrency(order.valor_total), "primary-cell")
        table.append(row)
    })

    byId("orders-count").textContent = String(state.orders.length)
    byId("orders-empty").hidden = state.orders.length > 0
    updateDashboard()
}

function renderMovements() {
    const table = byId("movements-table")
    table.replaceChildren()
    const productsById = new Map(state.products.map((product) => [String(product.id), product]))
    const movements = [...state.movements].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

    movements.forEach((movement) => {
        const row = document.createElement("tr")
        addCell(row, formatDate(movement.created_at))
        addCell(row, productsById.get(String(movement.product_id))?.nome || `Produto #${movement.product_id}`, "primary-cell")
        const typeCell = document.createElement("td")
        const badge = document.createElement("span")
        const type = movement.tipo || "—"
        badge.className = `movement-badge ${type.toLocaleLowerCase("pt-BR")}`
        badge.textContent = type
        typeCell.append(badge)
        row.append(typeCell)
        addCell(row, movement.quantidade)
        addCell(row, movement.motivo)
        table.append(row)
    })

    byId("movements-count").textContent = String(state.movements.length)
    byId("movements-empty").hidden = state.movements.length > 0
    updateDashboard()
}

async function loadUsers() {
    try {
        state.users = unwrapRows(await request("/users"))
        setMessage("users-feedback", "")
        renderUsers()
        renderOrders()
    } catch (error) {
        setMessage("users-feedback", `Não foi possível carregar usuários: ${error.message}`, true)
    }
}

async function loadProducts() {
    try {
        state.products = unwrapRows(await request("/products"))
        setMessage("products-feedback", "")
        renderProducts()
        renderMovements()
    } catch (error) {
        setMessage("products-feedback", `Não foi possível carregar produtos: ${error.message}`, true)
    }
}

async function loadOrders() {
    try {
        state.orders = unwrapRows(await request("/orders"))
        setMessage("orders-feedback", "")
        renderOrders()
    } catch (error) {
        setMessage("orders-feedback", `Não foi possível carregar pedidos: ${error.message}`, true)
    }
}

async function loadMovements() {
    try {
        state.movements = unwrapRows(await request("/stock_movements"))
        setMessage("movements-feedback", "")
        renderMovements()
    } catch (error) {
        setMessage("movements-feedback", `Não foi possível carregar movimentações: ${error.message}`, true)
    }
}

function setFormBusy(form, busy) {
    const button = form.querySelector('button[type="submit"]')
    button.disabled = busy
    button.classList.toggle("is-loading", busy)
}

async function submitJsonForm(form, path, feedbackId, payload, onSuccess) {
    setMessage(feedbackId, "")
    setFormBusy(form, true)
    try {
        const result = await request(path, {
            method: "POST",
            body: JSON.stringify(payload)
        })
        setMessage(feedbackId, result?.sucesso || "Cadastro realizado com sucesso.")
        form.reset()
        await onSuccess()
    } catch (error) {
        setMessage(feedbackId, `Não foi possível salvar: ${error.message}`, true)
    } finally {
        setFormBusy(form, false)
    }
}

byId("user-form").addEventListener("submit", (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form).entries())
    Object.keys(values).forEach((key) => { values[key] = values[key].trim() })
    submitJsonForm(form, "/users", "user-feedback", values, loadUsers)
})

byId("order-form").addEventListener("submit", (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form).entries())
    const payload = {
        user_id: Number(values.user_id),
        valor_total: Number(values.valor_total),
        status: values.status
    }
    submitJsonForm(form, "/orders", "order-feedback", payload, loadOrders)
})

byId("movement-form").addEventListener("submit", (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form).entries())
    const payload = {
        product_id: Number(values.product_id),
        tipo: values.tipo,
        quantidade: Number(values.quantidade),
        motivo: values.motivo.trim() || null
    }
    submitJsonForm(form, "/stock_movements", "movement-feedback", payload, loadMovements)
})

document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => showTab(button.dataset.tab))
})

document.querySelectorAll("[data-refresh]").forEach((button) => {
    button.addEventListener("click", () => {
        const loaders = {
            users: loadUsers,
            products: loadProducts,
            orders: loadOrders,
            stock: loadMovements
        }
        loaders[button.dataset.refresh]?.()
    })
})

byId("product-search").addEventListener("input", renderProducts)
byId("today-label").textContent = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
}).format(new Date())

Promise.all([loadUsers(), loadProducts(), loadOrders(), loadMovements()])
