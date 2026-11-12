import app  from "./src/app.js"

const PORT = 3000
const server =  app

server.listen(PORT, ()=>{
    console.log(`O servidor está rodando em http://localhost:${PORT}`)
})
