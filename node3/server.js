const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));


app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false
}));


const users = [];


function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}


app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/profile');
    } else {
        res.redirect('/login');
    }
});


app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});


app.post('/register', (req, res) => {
    const { username, password } = req.body;

    if (users.find(user => user.username === username)) {
        return res.send("Пользователь с таким именем уже существует");
    }

    users.push({ username, password });
    res.redirect('/login');
});


app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});


app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const user = users.find(user => user.username === username && user.password === password);

    if (user) {
        req.session.user = user;
        res.redirect('/profile');
    } else {
        res.send('Неверное имя пользователя или пароль');
    }
});


app.get('/profile', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'profile.html'));
});


app.get('/edit-profile', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'edit-profile.html'));
});


app.post('/edit-profile', isAuthenticated, (req, res) => {
    const { newUsername, newPassword } = req.body;
    const currentUser = req.session.user;
    

    if (newUsername !== currentUser.username && users.find(user => user.username === newUsername)) {
        return res.send("Пользователь с таким именем уже существует");
    }
    

    const userIndex = users.findIndex(user => user.username === currentUser.username);
    if (userIndex !== -1) {
        users[userIndex].username = newUsername;
        users[userIndex].password = newPassword;
    }
    

    req.session.user = { username: newUsername, password: newPassword };
    
    res.redirect('/profile');
});


app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});