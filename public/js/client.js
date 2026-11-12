const clientState = {
    user: null,
    products: [],
    orders: [],
    cart: new Map()
}

const clientById = (id) => document.getElementById(id)

async function clientRequest(path, options = {}) {
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

function unwrapClientRows(data) {
    return Array.isArray(data) && data.length === 1 && Array.isArray(data[0])
        ? data[0]
        : Array.isArray(data) ? data : []
}

function clientMessage(id, message, isError = false) {
    const element = clientById(id)
    element.textContent = message
    element.classList.toggle("error", isError)
}

function clientMoney(value) {
    const amount = Number(value)
    return Number.isFinite(amount)
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)
        : "—"
}

function clientDate(value) {
    if (!value) return "—"
    const date = new Date(value)
    return Number.isNaN(date.getTime())
        ? String(value)
        : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function createProductCard(product) {
    const card = document.createElement("article")
    card.className = "card client-product-card"

    const visual = document.createElement("div")
    visual.className = "client-product-visual"
    if (product.imagem) {
        try {
            const imageUrl = new URL(product.imagem, window.location.origin)
            if (["http:", "https:"].includes(imageUrl.protocol)) {
                const image = document.createElement("img")
                image.src = imageUrl.href
                image.alt = `Imagem de ${product.nome}`
                image.loading = "lazy"
                image.addEventListener("error", () => {
                    image.replaceWith(productPlaceholder())
                }, { once: true })
                visual.append(image)
            } else {
                visual.append(productPlaceholder())
            }
        } catch (error) {
            visual.append(productPlaceholder())
        }
    } else {
        visual.append(productPlaceholder())
    }

    const body = document.createElement("div")
    body.className = "client-product-body"
    const title = document.createElement("h3")
    title.textContent = product.nome || "Produto"
    const description = document.createElement("p")
    description.textContent = product.descricao || "Produto disponível para compra no atacado."
    const price = document.createElement("strong")
    price.className = "client-product-price"
    price.textContent = clientMoney(product.preco_atacado)
    const meta = document.createElement("div")
    meta.className = "client-product-meta"
    const stockText = document.createElement("span")
    stockText.textContent = `${product.estoque} disponíveis`
    const minText = document.createElement("span")
    minText.textContent = `Mínimo: ${product.min_pedido}`
    meta.append(stockText, minText)

    const button = document.createElement("button")
    button.type = "button"
    button.className = "button button-primary add-cart-button"
    button.textContent = Number(product.estoque) <= 0 ? "Sem estoque" : "Adicionar ao carrinho"
    button.disabled = Number(product.estoque) <= 0
    button.addEventListener("click", () => addToCart(product))

    body.append(title, description, price, meta, button)
    card.append(visual, body)
    return card
}

function productPlaceholder() {
    const placeholder = document.createElement("span")
    placeholder.className = "product-placeholder"
    placeholder.textContent = "▦"
    placeholder.setAttribute("aria-hidden", "true")
    return placeholder
}

function renderClientProducts() {
    const grid = clientById("client-products")
    const search = clientById("client-product-search").value.trim().toLocaleLowerCase("pt-BR")
    const matching = clientState.products.filter((product) =>
        `${product.nome || ""} ${product.descricao || ""}`.toLocaleLowerCase("pt-BR").includes(search)
    )
    grid.replaceChildren(...matching.map(createProductCard))
    clientById("client-products-empty").hidden = matching.length > 0
}

function addToCart(product) {
    const existing = clientState.cart.get(Number(product.id))
    const currentQuantity = existing?.quantidade || 0
    const startingQuantity = Math.max(1, Number(product.min_pedido) || 1)
    const nextQuantity = currentQuantity ? currentQuantity + 1 : startingQuantity

    if (nextQuantity > Number(product.estoque)) {
        clientMessage("checkout-feedback", `Estoque insuficiente para ${product.nome}.`, true)
        return
    }

    clientState.cart.set(Number(product.id), { product, quantidade: nextQuantity })
    clientMessage("checkout-feedback", "")
    renderCart()
}

function updateCartQuantity(productId, quantity) {
    const entry = clientState.cart.get(productId)
    if (!entry) return

    const minimum = Number(entry.product.min_pedido) || 1
    if (quantity < minimum) {
        clientState.cart.delete(productId)
    } else if (quantity > Number(entry.product.estoque)) {
        clientMessage("checkout-feedback", `Estoque máximo para ${entry.product.nome}: ${entry.product.estoque}.`, true)
        return
    } else {
        entry.quantidade = quantity
        clientState.cart.set(productId, entry)
    }
    clientMessage("checkout-feedback", "")
    renderCart()
}

function renderCart() {
    const container = clientById("cart-items")
    container.replaceChildren()
    let totalQuantity = 0
    let total = 0

    clientState.cart.forEach(({ product, quantidade }, id) => {
        totalQuantity += quantidade
        total += Number(product.preco_atacado) * quantidade

        const row = document.createElement("div")
        row.className = "cart-row"
        const details = document.createElement("div")
        const title = document.createElement("strong")
        title.textContent = product.nome
        const unit = document.createElement("small")
        unit.textContent = `${clientMoney(product.preco_atacado)} por unidade`
        details.append(title, unit)

        const quantity = document.createElement("div")
        quantity.className = "cart-quantity"
        const decrease = document.createElement("button")
        decrease.type = "button"
        decrease.setAttribute("aria-label", `Diminuir quantidade de ${product.nome}`)
        decrease.textContent = "−"
        decrease.addEventListener("click", () => updateCartQuantity(id, quantidade - 1))
        const value = document.createElement("span")
        value.textContent = String(quantidade)
        const increase = document.createElement("button")
        increase.type = "button"
        increase.setAttribute("aria-label", `Aumentar quantidade de ${product.nome}`)
        increase.textContent = "+"
        increase.disabled = quantidade >= Number(product.estoque)
        increase.addEventListener("click", () => updateCartQuantity(id, quantidade + 1))
        quantity.append(decrease, value, increase)
        row.append(details, quantity)
        container.append(row)
    })

    clientById("cart-count").textContent = String(totalQuantity)
    clientById("cart-items-count").textContent = `${clientState.cart.size} ${clientState.cart.size === 1 ? "item" : "itens"}`
    clientById("cart-total").textContent = clientMoney(total)
    clientById("cart-empty").hidden = clientState.cart.size > 0
    clientById("checkout-button").disabled = clientState.cart.size === 0
}

function renderClientOrders() {
    const container = clientById("client-orders")
    container.replaceChildren()
    clientState.orders.forEach((order) => {
        const row = document.createElement("article")
        row.className = "client-order-row"
        const details = document.createElement("div")
        const title = document.createElement("strong")
        title.textContent = `Pedido #${order.id}`
        const date = document.createElement("small")
        date.textContent = clientDate(order.created_at)
        details.append(title, date)
        const meta = document.createElement("div")
        meta.className = "client-order-meta"
        const badge = document.createElement("span")
        badge.className = `status-badge ${(order.status || "Pendente").toLocaleLowerCase("pt-BR")}`
        badge.textContent = order.status || "Pendente"
        const total = document.createElement("strong")
        total.textContent = clientMoney(order.valor_total)
        meta.append(badge, total)
        row.append(details, meta)
        container.append(row)
    })
    clientById("client-orders-empty").hidden = clientState.orders.length > 0
}

async function loadClientProducts() {
    try {
        const data = await clientRequest("/products")
        clientState.products = unwrapClientRows(data)
        renderClientProducts()
    } catch (error) {
        clientMessage("catalog-feedback", `Não foi possível carregar o catálogo: ${error.message}`, true)
    }
}

async function loadClientOrders() {
    try {
        clientState.orders = unwrapClientRows(await clientRequest("/orders"))
        renderClientOrders()
        clientMessage("orders-feedback", "")
    } catch (error) {
        clientMessage("orders-feedback", `Não foi possível carregar seus pedidos: ${error.message}`, true)
    }
}

clientById("client-product-search").addEventListener("input", renderClientProducts)
clientById("refresh-orders").addEventListener("click", loadClientOrders)

clientById("checkout-button").addEventListener("click", async (event) => {
    const button = event.currentTarget
    button.disabled = true
    clientMessage("checkout-feedback", "")
    try {
        const items = [...clientState.cart.entries()].map(([product_id, item]) => ({
            product_id,
            quantidade: item.quantidade
        }))
        const result = await clientRequest("/orders", {
            method: "POST",
            body: JSON.stringify({ items })
        })
        clientState.cart.clear()
        renderCart()
        clientMessage("checkout-feedback", `${result.sucesso || "Pedido criado."} Número: #${result.id}.`)
        await Promise.all([loadClientProducts(), loadClientOrders()])
    } catch (error) {
        clientMessage("checkout-feedback", error.message, true)
        await loadClientProducts()
    } finally {
        button.disabled = clientState.cart.size === 0
    }
})

document.querySelector("[data-logout]").addEventListener("click", async () => {
    try {
        await clientRequest("/auth/logout", { method: "POST" })
    } finally {
        window.location.replace("/")
    }
})

async function startClientPortal() {
    try {
        const session = await clientRequest("/auth/me")
        if (session.usuario.role !== "client") {
            window.location.replace(session.usuario.role === "admin" ? "/pages/admin.html" : "/")
            return
        }
        clientState.user = session.usuario
        clientById("account-name").textContent = session.usuario.nome_empresa
        clientById("welcome-name").textContent = session.usuario.nome_empresa
        await Promise.all([loadClientProducts(), loadClientOrders()])
        renderCart()
    } catch (error) {
        window.location.replace("/")
    }
}

startClientPortal()
