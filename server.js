const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/") {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: "online",
      toko: "Next Game",
      message: "Backend Next Game berhasil berjalan!"
    }));
    return;
  }

  if (req.url === "/api/status") {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: "success",
      message: "Server Next Game aktif"
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({
    status: "error",
    message: "Halaman tidak ditemukan"
  }));
});

server.listen(PORT, () => {
  console.log(Next Game server berjalan di port ${PORT});
});
