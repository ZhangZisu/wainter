const path = require("path")
const fs = require("fs")

const log = require("debug")("wainter")
const app = require("express")()
let server
if (process.env.HTTPS) {
    const credentials = { key: fs.readFileSync(process.env.KEY), cert: fs.readFileSync(process.env.CERT) }
    server = require("https").createServer(credentials, app)
    server.listen(parseInt(process.env.PORT) || 443)
} else {
    server = require("http").createServer(app)
    server.listen(parseInt(process.env.PORT) || 80)
}
const io = require("socket.io")(server)

const width = parseInt(process.env.IMG_WIDTH) || 600
const height = parseInt(process.env.IMG_HEIGHT) || 400
const colors = 32

let img

if (fs.existsSync("dump.json")) {
    img = JSON.parse(fs.readFileSync("dump.json").toString())
} else {
    img = [...Array(width)].map(() => [...Array(height)].map(() => 0))
}

const valid = (x, max) => {
    return (typeof x === "number") && x >= 0 && x < max && x == Math.floor(x)
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"))
})

io.on('connection', (socket) => {
    log('a user connected')
    socket.emit("init", { width, height, img })
    socket.count = 0
    socket.start = +new Date()
    socket.on("draw", (data) => {
        const span = Math.floor((+new Date) - socket.start) / 1000
        if (socket.count >= span) return
        socket.count++
        const { x, y, color } = data
        if (!valid(x, width)) return
        if (!valid(y, height)) return
        if (!valid(color, colors)) return
        img[x][y] = color
        socket.broadcast.emit("update", data)
    })
})

process.on("SIGINT", () => {
    fs.writeFileSync("dump.json", JSON.stringify(img))
    process.exit(0)
})