const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));

let tasks = [];
let taskId = 1;

app.get('/', (req, res) => {
   res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.use(express.static('public'));

app.get('/tasks', (req, res) => {
   res.json(tasks);
});


app.post('/add-task', (req, res) => {
    const taskText = req.body.task;
    tasks.push({ id: taskId++, text: taskText });
    res.redirect('/');
});


app.post('/delete-task/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex !== -1) {
        tasks.splice(taskIndex, 1);
    }
    res.redirect('/');
});

app.post('/toggle-task/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        task.completed = !task.completed;
    }
    res.redirect('/');
});




app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});