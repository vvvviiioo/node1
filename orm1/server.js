const express = require("express");
const path = require("path");
const crypto = require("crypto");
const session = require("express-session");
const { Sequelize, DataTypes, Op } = require("sequelize");

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

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.resolve(__dirname, "auth.db"),
  logging: false
});

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  image: {
    type: DataTypes.STRING,
    defaultValue: "https://via.placeholder.com/150"
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  tableName: 'users'
});

const UserLogin = sequelize.define('UserLogin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  login_time: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  ip_address: {
    type: DataTypes.STRING
  },
  user_agent: {
    type: DataTypes.TEXT
  }
}, {
  timestamps: false,
  tableName: 'user_logins',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['login_time']
    }
  ]
});

User.hasMany(UserLogin, { foreignKey: 'user_id', as: 'logins' });
UserLogin.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

const sanitizeString = (str) => {
  if (!str) return "";
  if (typeof str !== "string") return String(str);
  return str.replace(/'/g, "''").replace(/[;\\]/g, "").trim();
};

const sanitizeEmail = (email) => {
  return sanitizeString(email).toLowerCase();
};

async function initDatabase() {
  try {
    await sequelize.sync({ force: false });
    console.log("База данных синхронизирована");

    const userCount = await User.count();
    
    if (userCount === 0) {
      await insertTestUsers();
    }
  } catch (error) {
    console.error("Ошибка при инициализации базы данных:", error);
  }
}

async function logUserLogin(userId, req) {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    await UserLogin.create({
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent
    });
    
    console.log(`Записан вход пользователя ${userId}`);
  } catch (error) {
    console.error("Ошибка при записи входа пользователя:", error);
  }
}

async function insertTestUsers() {
  try {
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

    await User.bulkCreate(testUsers);
    console.log("Тестовые пользователи добавлены");
  } catch (error) {
    console.error("Ошибка при добавлении тестовых пользователей:", error);
  }
}

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }
  next();
};

app.post("/api/auth/register", async (req, res) => {
  try {
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

    const user = await User.create({
      username: sanitizeString(username),
      email: sanitizeEmail(email),
      password: hashedPassword,
      image: image || "https://via.placeholder.com/150"
    });

    req.session.userId = user.id;
    await logUserLogin(user.id, req);

    res.status(201).json({
      message: "Регистрация успешна",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        image: user.image
      }
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: "Пользователь с таким email уже существует" });
    }
    console.error("Ошибка при регистрации:", error);
    res.status(500).json({ error: "Ошибка при регистрации" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email и пароль обязательны" });
    }

    const hashedPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    const user = await User.findOne({
      where: {
        email: sanitizeEmail(email),
        password: hashedPassword
      }
    });

    if (!user) {
      return res.status(401).json({ error: "Неверный email или пароль" });
    }

    req.session.userId = user.id;
    await logUserLogin(user.id, req);
    
    res.json({
      message: "Вход выполнен успешно",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        image: user.image
      }
    });
  } catch (error) {
    console.error("Ошибка при входе:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
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

app.get("/api/auth/check", async (req, res) => {
  if (!req.session.userId) {
    return res.json({ authenticated: false });
  }

  try {
    const user = await User.findByPk(req.session.userId, {
      attributes: ['id', 'username', 'email', 'image']
    });

    if (!user) {
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
  } catch (error) {
    console.error("Ошибка при проверке аутентификации:", error);
    res.json({ authenticated: false });
  }
});

app.get("/api/auth/login-history", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    
    const logins = await UserLogin.findAll({
      where: { user_id: req.session.userId },
      order: [['login_time', 'DESC']],
      limit: limit,
      attributes: ['login_time', 'ip_address', 'user_agent']
    });
    
    res.json(logins);
  } catch (error) {
    console.error("Ошибка при получении истории входов:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/users", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const users = await User.findAll({
      limit: limit,
      attributes: ['id', 'username', 'email', 'image', 'created_at'],
      order: [['created_at', 'DESC']]
    });

    res.json(users);
  } catch (error) {
    console.error("Ошибка при получении списка пользователей:", error);
    res.status(500).json({ error: "Ошибка базы данных" });
  }
});

app.get("/api/admin/login-stats", requireAuth, async (req, res) => {
  try {
    if (req.session.userId !== 2) {
      return res.status(403).json({ error: "Доступ запрещен" });
    }
    
    const stats = await User.findAll({
      attributes: [
        'username',
        'email',
        [sequelize.fn('COUNT', sequelize.col('logins.id')), 'login_count'],
        [sequelize.fn('MAX', sequelize.col('logins.login_time')), 'last_login']
      ],
      include: [{
        model: UserLogin,
        as: 'logins',
        attributes: []
      }],
      group: ['User.id'],
      order: [[sequelize.literal('login_count'), 'DESC']]
    });
    
    res.json(stats);
  } catch (error) {
    console.error("Ошибка при получении статистики:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/admin/all-logins", requireAuth, async (req, res) => {
  try {
    if (req.session.userId !== 2) {
      return res.status(403).json({ error: "Доступ запрещен" });
    }
    
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    
    const logins = await UserLogin.findAll({
      include: [{
        model: User,
        as: 'user',
        attributes: ['username', 'email']
      }],
      order: [['login_time', 'DESC']],
      limit: limit,
      attributes: ['login_time', 'ip_address', 'user_agent']
    });
    
    res.json(logins);
  } catch (error) {
    console.error("Ошибка при получении истории входов:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.use(express.static(__dirname));
app.use("/style", express.static(path.join(__dirname, "style")));
app.use("/js", express.static(path.join(__dirname, "js")));

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

app.get("/admin", requireAuth, (req, res) => {
  if (req.session.userId !== 2) {
    return res.status(403).send("Доступ запрещен. Только для администратора.");
  }
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.use((req, res) => {
  res.status(404).json({ error: "Страница не найдена" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`Сервер запущен на http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Ошибка при запуске сервера:", error);
  }
}

startServer();