const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(
  session({
    secret: "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false,
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

const dbPath = path.resolve(__dirname, "auth.db");
const db = new sqlite3.Database(dbPath);


const sanitizeString = (str) => {
  if (!str) return "";
  if (typeof str !== "string") return String(str);
  return str.replace(/'/g, "''").replace(/[;\\]/g, "").trim();
};

const sanitizeEmail = (email) => {
  return sanitizeString(email).toLowerCase();
};


function initDatabase() {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        console.error("Ошибка при создании таблицы users:", err);
      } else {
        console.log("Таблица users готова");
        db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
          if (!err && row.count === 0) {
            insertTestUsers();
          }
        });
      }
    }
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS user_logins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    (err) => {
      if (err) {
        console.error("Ошибка при создании таблицы user_logins:", err);
      } else {
        console.log("Таблица user_logins готова");
        db.run("CREATE INDEX IF NOT EXISTS idx_user_logins_user_id ON user_logins(user_id)");
        db.run("CREATE INDEX IF NOT EXISTS idx_user_logins_login_time ON user_logins(login_time)");
      }
    }
  );
}


function logUserLogin(userId, req) {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  db.run(
    "INSERT INTO user_logins (user_id, ip_address, user_agent) VALUES (?, ?, ?)",
    [userId, ip, userAgent],
    (err) => {
      if (err) {
        console.error("Ошибка при записи входа пользователя:", err);
      } else {
        console.log(`Записан вход пользователя ${userId}`);
      }
    }
  );
}


function insertTestUsers() {
  const testUsers = [
    {
      username: "test_user",
      email: "test@example.com",
      password: crypto.createHash("sha256").update("password123").digest("hex"),
      image: "https://via.placeholder.com/150",
    },
    {
      username: "admin",
      email: "admin@example.com", 
      password: crypto.createHash("sha256").update("admin123").digest("hex"),
      image: "https://via.placeholder.com/150",
    }
  ];

  const stmt = db.prepare(
    "INSERT INTO users (username, email, password, image) VALUES (?, ?, ?, ?)"
  );

  testUsers.forEach((user) => {
    stmt.run(
      sanitizeString(user.username),
      sanitizeEmail(user.email),
      user.password,
      user.image
    );
  });

  stmt.finalize();
  console.log("Тестовые пользователи добавлены");
}

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }
  next();
};



app.post("/api/auth/register", (req, res) => {
  const { username, email, password, image } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Все поля обязательны для заполнения" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Пароль должен содержать минимум 6 символов" });
  }

  const hashedPassword = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  db.run(
    "INSERT INTO users (username, email, password, image) VALUES (?, ?, ?, ?)",
    [
      sanitizeString(username),
      sanitizeEmail(email),
      hashedPassword,
      image || "https://via.placeholder.com/150"
    ],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(400).json({ error: "Пользователь с таким email уже существует" });
        }
        return res.status(500).json({ error: "Ошибка при регистрации" });
      }
      
      req.session.userId = this.lastID;

      logUserLogin(this.lastID, req);
      
      res.status(201).json({
        message: "Регистрация успешна",
        user: {
          id: this.lastID,
          username: sanitizeString(username),
          email: sanitizeEmail(email),
          image: image || "https://via.placeholder.com/150"
        }
      });
    }
  );
});


app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email и пароль обязательны" });
  }

  const hashedPassword = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  db.get(
    "SELECT * FROM users WHERE email = ? AND password = ?",
    [sanitizeEmail(email), hashedPassword],
    (err, user) => {
      if (err) {
        console.error("Ошибка базы данных:", err);
        return res.status(500).json({ error: "Ошибка сервера" });
      }

      if (!user) {
        return res.status(401).json({ error: "Неверный email или пароль" });
      }

      req.session.userId = user.id;
      
      logUserLogin(user.id, req);
      
      res.json({
        message: "Вход выполнен успешно",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          image: user.image
        }
      });
    }
  );
});


app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Ошибка при выходе" });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Выход выполнен успешно" });
  });
});

app.get("/api/auth/check", (req, res) => {
  if (!req.session.userId) {
    return res.json({ authenticated: false });
  }

  db.get(
    "SELECT id, username, email, image FROM users WHERE id = ?",
    [req.session.userId],
    (err, user) => {
      if (err || !user) {
        return res.json({ authenticated: false });
      }

      res.json({
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          image: user.image
        }
      });
    }
  );
});

app.get("/api/auth/login-history", requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  
  const sql = `
    SELECT ul.login_time, ul.ip_address, ul.user_agent 
    FROM user_logins ul 
    WHERE ul.user_id = ? 
    ORDER BY ul.login_time DESC 
    LIMIT ?
  `;
  
  db.all(sql, [req.session.userId, limit], (err, logins) => {
    if (err) {
      console.error("Ошибка при получении истории входов:", err);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
    
    res.json(logins);
  });
});


app.get("/api/users", requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  db.all(
    "SELECT id, username, email, image, created_at FROM users LIMIT ?",
    [limit],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: "Ошибка базы данных" });
      }
      res.json(users);
    }
  );
});


app.use(express.static(__dirname));
app.use("/styles", express.static(path.join(__dirname, "style")));


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "register.html"));
});


app.get("/dashboard", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});


app.use((req, res) => {
  res.status(404).json({ error: "Страница не найдена" });
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});


initDatabase();

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});