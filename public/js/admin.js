const adminState = {
    user: null,
    users: [],
    products: [],
    orders: [],
    movements: []
}

const adminById = (id) => document.getElementById(id)

async function adminRequest(path, options = {}) {
    const response = await fetch(path, {
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
        throw new Error("Resposta inválida do servidor.")
    }
    if (!response.ok || data.erro) throw new Error(data.erro || "Falha na solicitação.")
    return data
}

function unwrapAdminRows(data) {
    return Array.isArray(data) && data.length === 1 && Array.isArray(data[0])
        ? data[0]
        : Array.isArray(data) ? data : []
}

function adminMoney(value) {
    const amount = Number(value)
    return Number.isFinite(amount)
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)
        : "—"
}

function adminDate(value) {
    if (!value) return "—"
    const date = new Date(value)
    return Number.isNaN(date.getTime())
        ? String(value)
        : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date)
}

function adminMessage(id, message, isError = false) {
    const element = adminById(id)
    element.textContent = message
    element.classList.toggle("error", isError)
}

function adminCell(row, value, className = "") {
    const cell = document.createElement("td")
    cell.textContent = value === undefined || value === null || value === "" ? "—" : String(value)
    if (className) cell.className = className
    row.append(cell)
    return cell
}

function renderAdminUsers() {
    const body = adminById("admin-users")
    body.replaceChildren()
    adminState.users.forEach((user) => {
        if (user.role === "admin") return
        const row = document.createElement("tr")
        adminCell(row, user.nome_empresa, "primary-cell")
        adminCell(row, user.cnpj)
        adminCell(row, user.email)
        body.append(row)
    })
    adminById("admin-users-count").textContent = String(adminState.users.length)
    adminById("admin-user-count").textContent = String(adminState.users.filter((user) => user.role === "client").length)
    adminById("admin-users-empty").hidden = body.children.length > 0
}

function renderAdminProducts() {
    const select = adminById("admin-stock-product")
    const selected = select.value
    select.replaceChildren(new Option("Selecione um produto", ""))
    adminState.products.forEach((product) => {
        select.append(new Option(`${product.nome} · estoque ${product.estoque}`, product.id))
    })
    if (adminState.products.some((product) => String(product.id) === selected)) select.value = selected
    adminById("admin-product-count").textContent = String(adminState.products.length)
}

function renderAdminOrders() {
    const body = adminById("admin-orders")
    body.replaceChildren()
    const names = new Map(adminState.users.map((user) => [String(user.id), user.nome_empresa]))
    adminState.orders.forEach((order) => {
        const row = document.createElement("tr")
        adminCell(row, `#${order.id}`, "primary-cell")
        adminCell(row, names.get(String(order.user_id)) || `Cliente #${order.user_id}`)
        adminCell(row, adminDate(order.created_at))
        const statusCell = document.createElement("td")
        const badge = document.createElement("span")
        badge.className = `status-badge ${(order.status || "Pendente").toLocaleLowerCase("pt-BR")}`
        badge.textContent = order.status || "Pendente"
        statusCell.append(badge)
        row.append(statusCell)
        adminCell(row, adminMoney(order.valor_total), "primary-cell")
        body.append(row)
    })
    adminById("admin-order-count").textContent = String(adminState.orders.length)
    adminById("admin-orders-empty").hidden = adminState.orders.length > 0
}

function renderAdminMovements() {
    const body = adminById("admin-movements")
    body.replaceChildren()
    const products = new Map(adminState.products.map((product) => [String(product.id), product.nome]))
    adminState.movements.forEach((movement) => {
        const row = document.createElement("tr")
        adminCell(row, adminDate(movement.created_at))
        adminCell(row, products.get(String(movement.product_id)) || `Produto #${movement.product_id}`)
        const typeCell = document.createElement("td")
        const badge = document.createElement("span")
        badge.className = `movement-badge ${(movement.tipo || "").toLocaleLowerCase("pt-BR")}`
        badge.textContent = movement.tipo || "—"
        typeCell.append(badge)
        row.append(typeCell)
        adminCell(row, movement.quantidade)
        body.append(row)
    })
    adminById("admin-movement-count").textContent = String(adminState.movements.length)
    adminById("admin-movements-count").textContent = String(adminState.movements.length)
    adminById("admin-movements-empty").hidden = adminState.movements.length > 0
}

async function loadAdminUsers() {
    try {
        adminState.users = unwrapAdminRows(await adminRequest("/users"))
        renderAdminUsers()
        renderAdminOrders()
        adminMessage("admin-users-feedback", "")
    } catch (error) {
        adminMessage("admin-users-feedback", `Falha ao carregar clientes: ${error.message}`, true)
    }
}

async function loadAdminProducts() {
    try {
        adminState.products = unwrapAdminRows(await adminRequest("/products"))
        renderAdminProducts()
        renderAdminMovements()
        adminMessage("admin-product-feedback", "")
    } catch (error) {
        adminMessage("admin-product-feedback", `Falha ao carregar produtos: ${error.message}`, true)
    }
}

async function loadAdminOrders() {
    try {
        adminState.orders = unwrapAdminRows(await adminRequest("/orders"))
        renderAdminOrders()
        adminMessage("admin-orders-feedback", "")
    } catch (error) {
        adminMessage("admin-orders-feedback", `Falha ao carregar pedidos: ${error.message}`, true)
    }
}

async function loadAdminMovements() {
    try {
        adminState.movements = unwrapAdminRows(await adminRequest("/stock_movements"))
        renderAdminMovements()
        adminMessage("admin-movements-feedback", "")
    } catch (error) {
        adminMessage("admin-movements-feedback", `Falha ao carregar estoque: ${error.message}`, true)
    }
}

async function submitAdminForm(form, path, feedbackId, payload, refresh) {
    const button = form.querySelector('button[type="submit"]')
    button.disabled = true
    adminMessage(feedbackId, "")
    try {
        const result = await adminRequest(path, { method: "POST", body: JSON.stringify(payload) })
        form.reset()
        await refresh()
        adminMessage(feedbackId, result.sucesso || "Operação concluída.")
    } catch (error) {
        adminMessage(feedbackId, error.message, true)
    } finally {
        button.disabled = false
    }
}

adminById("admin-product-form").addEventListener("submit", (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form).entries())
    const payload = {
        nome: values.nome.trim(),
        descricao: values.descricao.trim() || null,
        preco_atacado: Number(values.preco_atacado),
        estoque: Number(values.estoque),
        min_pedido: Number(values.min_pedido),
        imagem: values.imagem.trim() || null
    }
    submitAdminForm(form, "/products", "admin-product-feedback", payload, async () => {
        await Promise.all([loadAdminProducts(), loadAdminMovements()])
    })
})

adminById("admin-stock-form").addEventListener("submit", (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form).entries())
    const payload = {
        product_id: Number(values.product_id),
        tipo: values.tipo,
        quantidade: Number(values.quantidade),
        motivo: values.motivo.trim() || null
    }
    submitAdminForm(form, "/stock_movements", "admin-stock-feedback", payload, async () => {
        await Promise.all([loadAdminProducts(), loadAdminMovements()])
    })
})

adminById("admin-refresh-orders").addEventListener("click", loadAdminOrders)

document.querySelector("[data-logout]").addEventListener("click", async () => {
    try {
        await adminRequest("/auth/logout", { method: "POST" })
    } finally {
        window.location.replace("/")
    }
})

async function startAdminPortal() {
    try {
        const session = await adminRequest("/auth/me")
        if (session.usuario.role !== "admin") {
            window.location.replace(session.usuario.role === "client" ? "/pages/client.html" : "/")
            return
        }
        adminState.user = session.usuario
        adminById("admin-account-name").textContent = session.usuario.nome_empresa
        await Promise.all([
            loadAdminUsers(),
            loadAdminProducts(),
            loadAdminOrders(),
            loadAdminMovements()
        ])
    } catch (error) {
        window.location.replace("/")
    }
}

startAdminPortal()
